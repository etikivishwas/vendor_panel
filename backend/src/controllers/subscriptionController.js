const crypto = require("crypto");
const { pool } = require("../config/db");

const getVendorId = async (connection, accountId) => {
  const [rows] = await connection.execute(
    `SELECT existing_vendor_id FROM vendor_panel_accounts
     WHERE id = ? AND status = 'active' LIMIT 1`,
    [accountId]
  );

  if (!rows.length) throw Object.assign(new Error("Vendor account not found"), { status: 404 });
  if (!rows[0].existing_vendor_id) {
    throw Object.assign(new Error("This account is not linked to a vendor record"), { status: 409 });
  }
  return Number(rows[0].existing_vendor_id);
};

const getCanonicalPlans = async (connection) => {
  const [rows] = await connection.execute(
    `SELECT MIN(id) AS id, name, MAX(tier_label) AS tier_label,
            MAX(description) AS description, MAX(billing_period) AS billing_period,
            MAX(price) AS price, MAX(is_featured) AS is_featured,
            MIN(sort_order) AS sort_order
     FROM subscription_plans
     WHERE is_active = 1
     GROUP BY LOWER(TRIM(name)), name
     ORDER BY MIN(sort_order), MAX(price)`
  );
  return rows;
};

const getSubscriptions = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const planRows = await getCanonicalPlans(connection);
    const planIds = planRows.map((row) => Number(row.id));
    let featureRows = [];

    if (planIds.length) {
      const placeholders = planIds.map(() => "?").join(",");
      [featureRows] = await connection.execute(
        `SELECT plan_id, feature_key, feature_label, feature_value, sort_order
         FROM subscription_plan_features
         WHERE plan_id IN (${placeholders})
         ORDER BY sort_order, id`,
        planIds
      );
    }

    const featureMap = new Map();
    featureRows.forEach((row) => {
      const planId = Number(row.plan_id);
      if (!featureMap.has(planId)) featureMap.set(planId, []);
      if (!featureMap.get(planId).some((item) => item.key === row.feature_key)) {
        featureMap.get(planId).push({
          key: row.feature_key,
          label: row.feature_label,
          value: row.feature_value,
          sortOrder: Number(row.sort_order),
        });
      }
    });

    const [currentRows] = await connection.execute(
      `SELECT vs.id, vs.plan_id, vs.amount, vs.start_date, vs.expiry_date,
              vs.status, sp.name AS plan_name
       FROM vendor_subscriptions vs
       INNER JOIN subscription_plans sp ON sp.id = vs.plan_id
       WHERE vs.vendor_id = ? AND vs.status = 'active'
         AND vs.expiry_date >= CURRENT_DATE
       ORDER BY vs.id DESC LIMIT 1`,
      [vendorId]
    );

    const plans = planRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      tierLabel: row.tier_label,
      description: row.description || "",
      billingPeriod: row.billing_period,
      price: Number(row.price),
      featured: Boolean(row.is_featured),
      sortOrder: Number(row.sort_order),
      features: featureMap.get(Number(row.id)) || [],
    }));

    const current = currentRows[0];
    const canonicalCurrent = current
      ? plans.find((plan) => plan.name.trim().toLowerCase() === current.plan_name.trim().toLowerCase())
      : null;

    return res.json({
      success: true,
      data: {
        plans,
        currentSubscription: current
          ? {
              id: Number(current.id),
              planId: canonicalCurrent?.id || Number(current.plan_id),
              planName: current.plan_name,
              amount: Number(current.amount),
              startDate: current.start_date,
              expiryDate: current.expiry_date,
              status: current.status,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const createCheckout = async (req, res, next) => {
  let connection;
  try {
    const requestedPlanId = Number(req.params.planId);
    if (!Number.isInteger(requestedPlanId) || requestedPlanId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid subscription plan" });
    }

    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [requestedRows] = await connection.execute(
      `SELECT id, name FROM subscription_plans
       WHERE id = ? AND is_active = 1 LIMIT 1`,
      [requestedPlanId]
    );
    if (!requestedRows.length) throw Object.assign(new Error("Subscription plan not found"), { status: 404 });

    const [planRows] = await connection.execute(
      `SELECT id, name, tier_label, description, billing_period, price
       FROM subscription_plans
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_active = 1
       ORDER BY id LIMIT 1`,
      [requestedRows[0].name]
    );
    const plan = planRows[0];

    const [currentRows] = await connection.execute(
      `SELECT sp.name FROM vendor_subscriptions vs
       INNER JOIN subscription_plans sp ON sp.id = vs.plan_id
       WHERE vs.vendor_id = ? AND vs.status = 'active'
         AND vs.expiry_date >= CURRENT_DATE
       ORDER BY vs.id DESC LIMIT 1`,
      [vendorId]
    );
    if (currentRows[0]?.name.trim().toLowerCase() === plan.name.trim().toLowerCase()) {
      throw Object.assign(new Error("This is already your current plan"), { status: 409 });
    }

    await connection.execute(
      `UPDATE vendor_subscription_checkouts
       SET status = 'cancelled'
       WHERE vendor_id = ? AND status IN ('pending','payment_initiated')`,
      [vendorId]
    );

    const subtotal = Number(plan.price);
    const taxRate = 18;
    const taxAmount = Number((subtotal * taxRate / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));
    const token = crypto.randomBytes(24).toString("hex");

    await connection.execute(
      `INSERT INTO vendor_subscription_checkouts
       (checkout_token, vendor_id, plan_id, subtotal, tax_rate,
        tax_amount, total_amount, payment_method, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'upi', 'pending',
               DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [token, vendorId, plan.id, subtotal, taxRate, taxAmount, totalAmount]
    );

    return res.status(201).json({
      success: true,
      message: "Checkout created successfully",
      data: { checkoutToken: token },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const getCheckout = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const token = String(req.params.token || "").trim();

    const [rows] = await connection.execute(
      `SELECT c.id, c.checkout_token, c.subtotal, c.tax_rate, c.tax_amount,
              c.total_amount, c.payment_method, c.status, c.expires_at,
              p.id AS plan_id, p.name AS plan_name, p.description,
              p.billing_period
       FROM vendor_subscription_checkouts c
       INNER JOIN subscription_plans p ON p.id = c.plan_id
       WHERE c.checkout_token = ? AND c.vendor_id = ? LIMIT 1`,
      [token, vendorId]
    );

    if (!rows.length) throw Object.assign(new Error("Checkout not found"), { status: 404 });
    const row = rows[0];
    if (new Date(row.expires_at) < new Date() && row.status === "pending") {
      await connection.execute(
        `UPDATE vendor_subscription_checkouts SET status = 'expired' WHERE id = ?`,
        [row.id]
      );
      row.status = "expired";
    }

    return res.json({
      success: true,
      data: {
        checkoutToken: row.checkout_token,
        plan: {
          id: Number(row.plan_id),
          name: row.plan_name,
          description: row.description || "",
          billingPeriod: row.billing_period,
        },
        subtotal: Number(row.subtotal),
        taxRate: Number(row.tax_rate),
        taxAmount: Number(row.tax_amount),
        totalAmount: Number(row.total_amount),
        paymentMethod: row.payment_method,
        status: row.status,
        expiresAt: row.expires_at,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const updatePaymentMethod = async (req, res, next) => {
  let connection;
  try {
    const method = String(req.body.paymentMethod || "");
    if (!["card", "upi"].includes(method)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const [result] = await connection.execute(
      `UPDATE vendor_subscription_checkouts
       SET payment_method = ?
       WHERE checkout_token = ? AND vendor_id = ? AND status = 'pending'`,
      [method, req.params.token, vendorId]
    );
    if (!result.affectedRows) throw Object.assign(new Error("Checkout cannot be updated"), { status: 409 });
    return res.json({ success: true, message: "Payment method updated" });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getSubscriptions,
  createCheckout,
  getCheckout,
  updatePaymentMethod,
};
