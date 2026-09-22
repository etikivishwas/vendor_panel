require("dotenv").config();

const {
  pool: db,
} = require("../config/db.js");

const {
  razorpay,
  razorpayKeyId,
  razorpayKeySecret,
} = require("../config/razorpay.js");

const {
  verifyCheckoutSignature,
  verifyWebhookSignature,
} = require("../utils/razorpaySignatures.js");

const currency = String(
  process.env.RAZORPAY_CURRENCY || "INR"
).trim();

const getVendorId = (req) => {
  const vendorId = Number(req.vendor?.id);

  return Number.isInteger(vendorId) && vendorId > 0
    ? vendorId
    : null;
};

const moneyToPaise = (amount) => {
  const numeric = Number(amount);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Invalid payment amount");
  }

  return Math.round(numeric * 100);
};

const normalizeMethod = (method, allowed) =>
  allowed.includes(method) ? method : allowed[0];

const createReceipt = (prefix, id) =>
  `${prefix}_${id}_${Date.now()}`.slice(0, 40);

const getRazorpayError = (error, fallback) =>
  error?.error?.description || error?.message || fallback;

const createSubscriptionOrder = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication is required.",
      });
    }

    const token = String(req.params.token || "").trim();

    const [rows] = await db.query(
      `
        SELECT
          c.id,
          c.checkout_token,
          c.vendor_id,
          c.plan_id,
          c.subtotal,
          c.total_amount,
          c.payment_method,
          c.status,
          c.expires_at,
          c.provider_order_id,
          p.name AS plan_name,
          v.name AS business_name,
          v.email,
          v.phone
        FROM vendor_subscription_checkouts c
        INNER JOIN subscription_plans p
          ON p.id = c.plan_id
        INNER JOIN vendors v
          ON v.id = c.vendor_id
        WHERE c.checkout_token = ?
          AND c.vendor_id = ?
        LIMIT 1
      `,
      [token, vendorId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Subscription checkout was not found.",
      });
    }

    const checkout = rows[0];

    if (checkout.status === "paid") {
      return res.status(409).json({
        success: false,
        message: "This checkout is already paid.",
      });
    }

    if (["cancelled", "failed", "expired"].includes(checkout.status)) {
      return res.status(409).json({
        success: false,
        message: `This checkout is ${checkout.status}.`,
      });
    }

    if (new Date(checkout.expires_at).getTime() <= Date.now()) {
      await db.query(
        `
          UPDATE vendor_subscription_checkouts
          SET status = 'expired'
          WHERE id = ?
        `,
        [checkout.id]
      );

      return res.status(410).json({
        success: false,
        message: "This checkout has expired.",
      });
    }

    const amount = moneyToPaise(checkout.total_amount);
    let order;

    if (checkout.provider_order_id) {
      order = await razorpay.orders.fetch(
        checkout.provider_order_id
      );

      if (
        Number(order.amount) !== amount ||
        order.currency !== currency
      ) {
        return res.status(409).json({
          success: false,
          message: "The stored Razorpay order does not match this checkout.",
        });
      }
    } else {
      order = await razorpay.orders.create({
        amount,
        currency,
        receipt: createReceipt("sub", checkout.id),
        notes: {
          purpose: "vendor_subscription",
          checkout_id: String(checkout.id),
          vendor_id: String(vendorId),
          plan_id: String(checkout.plan_id),
        },
      });

      await db.query(
        `
          UPDATE vendor_subscription_checkouts
          SET
            status = 'payment_initiated',
            payment_provider = 'razorpay',
            provider_order_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND status <> 'paid'
        `,
        [order.id, checkout.id]
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        keyId: razorpayKeyId,
        orderId: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        paymentMethod: normalizeMethod(
          checkout.payment_method,
          ["upi", "card"]
        ),
        name: "Vendor Subscription",
        description: `${checkout.plan_name} subscription plan`,
        prefill: {
          name: checkout.business_name || "",
          email: checkout.email || "",
          contact: checkout.phone || "",
        },
      },
    });
  } catch (error) {
    console.error(
      "Create subscription Razorpay order error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message: getRazorpayError(
        error,
        "Unable to create Razorpay order."
      ),
    });
  }
};

const verifySubscriptionPayment = async (req, res) => {
  let connection;

  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication is required.",
      });
    }

    const token = String(req.params.token || "").trim();
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(422).json({
        success: false,
        message: "Incomplete Razorpay payment response.",
      });
    }

    if (
      !verifyCheckoutSignature({
        orderId,
        paymentId,
        signature,
        secret: razorpayKeySecret,
      })
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
    }

    const payment = await razorpay.payments.fetch(paymentId);

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          id,
          vendor_id,
          plan_id,
          subtotal,
          total_amount,
          status,
          provider_order_id
        FROM vendor_subscription_checkouts
        WHERE checkout_token = ?
          AND vendor_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [token, vendorId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Subscription checkout was not found.",
      });
    }

    const checkout = rows[0];

    if (checkout.status === "paid") {
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: "Payment was already verified.",
        data: { paymentId },
      });
    }

    const validRemotePayment =
      payment.order_id === checkout.provider_order_id &&
      orderId === checkout.provider_order_id &&
      Number(payment.amount) === moneyToPaise(checkout.total_amount) &&
      payment.currency === currency &&
      ["authorized", "captured"].includes(payment.status);

    if (!validRemotePayment) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Razorpay payment details do not match this checkout.",
      });
    }

    await connection.query(
      `
        UPDATE vendor_subscription_checkouts
        SET
          status = 'paid',
          payment_provider = 'razorpay',
          provider_payment_id = ?,
          paid_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [paymentId, checkout.id]
    );

    await connection.query(
      `
        UPDATE vendor_subscriptions
        SET
          status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
        WHERE vendor_id = ?
          AND status = 'active'
      `,
      [vendorId]
    );

    await connection.query(
      `
        INSERT INTO vendor_subscriptions (
          vendor_id,
          plan_id,
          amount,
          start_date,
          expiry_date,
          status
        )
        VALUES (
          ?,
          ?,
          ?,
          CURDATE(),
          DATE_ADD(CURDATE(), INTERVAL 1 MONTH),
          'active'
        )
      `,
      [vendorId, checkout.plan_id, checkout.subtotal]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Subscription payment verified successfully.",
      data: { paymentId, orderId },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    console.error("Verify subscription payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify subscription payment.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const createVerificationOrder = async (req, res) => {
  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication is required.",
      });
    }

    const token = String(req.params.token || "").trim();

    const [rows] = await db.query(
      `
        SELECT
          s.id,
          s.payment_token,
          s.vendor_id,
          s.total_amount,
          s.status,
          s.expires_at,
          s.provider_order_id,
          d.payment_method,
          v.name AS business_name,
          v.email,
          v.phone
        FROM vendor_verification_payment_sessions s
        LEFT JOIN vendor_verification_payment_details d
          ON d.payment_session_id = s.id
        INNER JOIN vendors v
          ON v.id = s.vendor_id
        WHERE s.payment_token = ?
          AND s.vendor_id = ?
        LIMIT 1
      `,
      [token, vendorId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Verification payment was not found.",
      });
    }

    const session = rows[0];

    if (session.status === "paid") {
      return res.status(409).json({
        success: false,
        message: "This verification payment is already paid.",
      });
    }

    if (["cancelled", "failed", "expired"].includes(session.status)) {
      return res.status(409).json({
        success: false,
        message: `This payment is ${session.status}.`,
      });
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await db.query(
        `
          UPDATE vendor_verification_payment_sessions
          SET status = 'expired'
          WHERE id = ?
        `,
        [session.id]
      );

      return res.status(410).json({
        success: false,
        message: "This payment session has expired.",
      });
    }

    const amount = moneyToPaise(session.total_amount);
    let order;

    if (session.provider_order_id) {
      order = await razorpay.orders.fetch(
        session.provider_order_id
      );

      if (
        Number(order.amount) !== amount ||
        order.currency !== currency
      ) {
        return res.status(409).json({
          success: false,
          message: "The stored Razorpay order does not match this payment.",
        });
      }
    } else {
      order = await razorpay.orders.create({
        amount,
        currency,
        receipt: createReceipt("verify", session.id),
        notes: {
          purpose: "vendor_verification",
          payment_session_id: String(session.id),
          vendor_id: String(vendorId),
        },
      });

      await db.query(
        `
          UPDATE vendor_verification_payment_sessions
          SET
            status = 'payment_initiated',
            payment_provider = 'razorpay',
            provider_order_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND status <> 'paid'
        `,
        [order.id, session.id]
      );

      await db.query(
        `
          UPDATE vendor_verification_payment_details
          SET
            status = 'payment_initiated',
            updated_at = CURRENT_TIMESTAMP
          WHERE payment_session_id = ?
        `,
        [session.id]
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        keyId: razorpayKeyId,
        orderId: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        paymentMethod: normalizeMethod(
          session.payment_method,
          ["upi", "card", "net_banking"]
        ),
        name: "Vendor Verification",
        description: "Vendor verification payment",
        prefill: {
          name: session.business_name || "",
          email: session.email || "",
          contact: session.phone || "",
        },
      },
    });
  } catch (error) {
    console.error(
      "Create verification Razorpay order error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message: getRazorpayError(
        error,
        "Unable to create Razorpay order."
      ),
    });
  }
};

const verifyVerificationPayment = async (req, res) => {
  let connection;

  try {
    const vendorId = getVendorId(req);

    if (!vendorId) {
      return res.status(401).json({
        success: false,
        message: "Vendor authentication is required.",
      });
    }

    const token = String(req.params.token || "").trim();
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(422).json({
        success: false,
        message: "Incomplete Razorpay payment response.",
      });
    }

    if (
      !verifyCheckoutSignature({
        orderId,
        paymentId,
        signature,
        secret: razorpayKeySecret,
      })
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
    }

    const payment = await razorpay.payments.fetch(paymentId);

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          id,
          vendor_id,
          submission_id,
          total_amount,
          status,
          provider_order_id
        FROM vendor_verification_payment_sessions
        WHERE payment_token = ?
          AND vendor_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [token, vendorId]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Verification payment was not found.",
      });
    }

    const session = rows[0];

    if (session.status === "paid") {
      await connection.commit();
      return res.status(200).json({
        success: true,
        message: "Payment was already verified.",
        data: { paymentId },
      });
    }

    const validRemotePayment =
      payment.order_id === session.provider_order_id &&
      orderId === session.provider_order_id &&
      Number(payment.amount) === moneyToPaise(session.total_amount) &&
      payment.currency === currency &&
      ["authorized", "captured"].includes(payment.status);

    if (!validRemotePayment) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Razorpay payment details do not match this verification session.",
      });
    }

    await connection.query(
      `
        UPDATE vendor_verification_payment_sessions
        SET
          status = 'paid',
          payment_provider = 'razorpay',
          provider_payment_id = ?,
          paid_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [paymentId, session.id]
    );

    await connection.query(
      `
        UPDATE vendor_verification_payment_details
        SET
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
        WHERE payment_session_id = ?
      `,
      [session.id]
    );

    await connection.query(
      `
        UPDATE vendor_verification_submissions
        SET
          status = 'pending_review',
          submitted_at = COALESCE(submitted_at, NOW()),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND vendor_id = ?
      `,
      [session.submission_id, vendorId]
    );

    await connection.query(
      `
        INSERT INTO vendor_panel_verifications (
          vendor_id,
          verification_status
        )
        VALUES (?, 'pending')
        ON DUPLICATE KEY UPDATE
          verification_status = 'pending',
          updated_at = CURRENT_TIMESTAMP
      `,
      [vendorId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Verification payment verified successfully.",
      data: { paymentId, orderId },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    console.error("Verify verification payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify verification payment.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const processWebhookPayment = async ({
  orderId,
  paymentId,
  status,
}) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const checkoutStatus =
      status === "captured" ? "paid" : "failed";

    await connection.query(
      `
        UPDATE vendor_subscription_checkouts
        SET
          status = ?,
          provider_payment_id = COALESCE(provider_payment_id, ?),
          paid_at = CASE
            WHEN ? = 'paid' THEN COALESCE(paid_at, NOW())
            ELSE paid_at
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE provider_order_id = ?
          AND status <> 'paid'
      `,
      [checkoutStatus, paymentId, checkoutStatus, orderId]
    );

    await connection.query(
      `
        UPDATE vendor_verification_payment_sessions
        SET
          status = ?,
          provider_payment_id = COALESCE(provider_payment_id, ?),
          paid_at = CASE
            WHEN ? = 'paid' THEN COALESCE(paid_at, NOW())
            ELSE paid_at
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE provider_order_id = ?
          AND status <> 'paid'
      `,
      [checkoutStatus, paymentId, checkoutStatus, orderId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get("x-razorpay-signature");
    const eventId = req.get("x-razorpay-event-id") || null;
    const webhookSecret = String(
      process.env.RAZORPAY_WEBHOOK_SECRET || ""
    ).trim();

    if (!webhookSecret) {
      console.error(
        "RAZORPAY_WEBHOOK_SECRET is missing from backend/.env"
      );
      return res.status(500).send(
        "Webhook is not configured"
      );
    }

    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).send(
        "Invalid webhook request"
      );
    }

    if (
      !verifyWebhookSignature({
        rawBody: req.body,
        signature,
        secret: webhookSecret,
      })
    ) {
      return res.status(400).send(
        "Invalid webhook signature"
      );
    }

    const event = JSON.parse(
      req.body.toString("utf8")
    );

    if (eventId) {
      const [result] = await db.query(
        `
          INSERT IGNORE INTO razorpay_webhook_events (
            event_id,
            event_type,
            payload_json
          )
          VALUES (?, ?, ?)
        `,
        [
          eventId,
          event.event || "unknown",
          JSON.stringify(event),
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(200).json({
          received: true,
          duplicate: true,
        });
      }
    }

    if (
      ["payment.captured", "payment.failed"].includes(
        event.event
      )
    ) {
      const entity = event.payload?.payment?.entity;

      if (entity?.order_id && entity?.id) {
        await processWebhookPayment({
          orderId: entity.order_id,
          paymentId: entity.id,
          status:
            event.event === "payment.captured"
              ? "captured"
              : "failed",
        });
      }
    }

    if (eventId) {
      await db.query(
        `
          UPDATE razorpay_webhook_events
          SET processed_at = NOW()
          WHERE event_id = ?
        `,
        [eventId]
      );
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).send(
      "Webhook processing failed"
    );
  }
};

module.exports = {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  createVerificationOrder,
  verifyVerificationPayment,
  handleRazorpayWebhook,
};
