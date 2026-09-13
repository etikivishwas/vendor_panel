const { pool } = require("../config/db");

const getVendorId = async (connection, accountId) => {
  const [rows] = await connection.execute(
    `SELECT existing_vendor_id
     FROM vendor_panel_accounts
     WHERE id = ? AND status = 'active'
     LIMIT 1`,
    [accountId]
  );

  if (!rows.length) {
    throw Object.assign(new Error("Vendor account not found"), { status: 404 });
  }

  if (!rows[0].existing_vendor_id) {
    throw Object.assign(
      new Error("This account is not linked to a vendor record"),
      { status: 409 }
    );
  }

  return Number(rows[0].existing_vendor_id);
};

const mapPayment = (row) => ({
  paymentToken: row.payment_token,
  status: row.session_status,
  expiresAt: row.expires_at,
  certificateType: row.certificate_type,
  serviceLevel: row.service_level,
  validityPeriod: row.validity_period,
  registrationFee: Number(row.registration_fee),
  processingFee: Number(row.processing_fee),
  taxableAmount: Number(row.taxable_amount),
  taxRate: Number(row.tax_rate),
  taxAmount: Number(row.tax_amount),
  totalAmount: Number(row.total_amount),
  paymentMethod: row.payment_method || "upi",
  upiId: row.upi_id || "",
  paymentDetailStatus: row.detail_status || "draft",
});

const getVerificationPayment = async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const token = String(req.params.token || "").trim();

    const [rows] = await connection.execute(
      `SELECT
         session.id AS payment_session_id,
         session.payment_token,
         session.status AS session_status,
         session.expires_at,
         session.registration_fee,
         session.processing_fee,
         session.taxable_amount,
         session.tax_rate,
         session.tax_amount,
         session.total_amount,
         fee.certificate_type,
         fee.service_level,
         fee.validity_period,
         detail.payment_method,
         detail.upi_id,
         detail.status AS detail_status
       FROM vendor_verification_payment_sessions session
       INNER JOIN verification_fee_settings fee
         ON fee.id = session.fee_setting_id
       LEFT JOIN vendor_verification_payment_details detail
         ON detail.payment_session_id = session.id
       WHERE session.payment_token = ? AND session.vendor_id = ?
       LIMIT 1`,
      [token, vendorId]
    );

    if (!rows.length) {
      throw Object.assign(new Error("Payment session not found"), { status: 404 });
    }

    const row = rows[0];

    if (
      row.session_status === "pending" &&
      new Date(row.expires_at).getTime() < Date.now()
    ) {
      await connection.execute(
        `UPDATE vendor_verification_payment_sessions
         SET status = 'expired'
         WHERE id = ?`,
        [row.payment_session_id]
      );
      row.session_status = "expired";
    }

    return res.json({
      success: true,
      data: mapPayment(row),
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const updateVerificationPayment = async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    const paymentMethod = String(req.body.paymentMethod || "").trim();
    const upiId = String(req.body.upiId || "").trim().toLowerCase();

    if (!["upi", "card", "net_banking"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid payment method",
      });
    }

    if (
      paymentMethod === "upi" &&
      upiId &&
      !/^[a-z0-9._-]{2,256}@[a-z]{2,64}$/.test(upiId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid UPI ID, for example name@bank",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const vendorId = await getVendorId(connection, req.vendor.id);
    const token = String(req.params.token || "").trim();

    const [sessionRows] = await connection.execute(
      `SELECT id, status, expires_at
       FROM vendor_verification_payment_sessions
       WHERE payment_token = ? AND vendor_id = ?
       LIMIT 1
       FOR UPDATE`,
      [token, vendorId]
    );

    if (!sessionRows.length) {
      throw Object.assign(new Error("Payment session not found"), { status: 404 });
    }

    const session = sessionRows[0];

    if (session.status !== "pending") {
      throw Object.assign(
        new Error(`This payment session is ${session.status}`),
        { status: 409 }
      );
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await connection.execute(
        `UPDATE vendor_verification_payment_sessions
         SET status = 'expired'
         WHERE id = ?`,
        [session.id]
      );
      throw Object.assign(new Error("Payment session has expired"), {
        status: 410,
      });
    }

    await connection.execute(
      `INSERT INTO vendor_verification_payment_details
       (payment_session_id, vendor_id, payment_method, upi_id, status)
       VALUES (?, ?, ?, ?, 'ready')
       ON DUPLICATE KEY UPDATE
         payment_method = VALUES(payment_method),
         upi_id = VALUES(upi_id),
         status = 'ready'`,
      [
        session.id,
        vendorId,
        paymentMethod,
        paymentMethod === "upi" && upiId ? upiId : null,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      message: "Payment preference saved",
      data: { paymentMethod, upiId },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getVerificationPayment,
  updateVerificationPayment,
};
