const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const {
  sendVendorPasswordResetEmail,
} = require("../services/vendorPasswordResetEmailService");

const text = (value) => String(value || "").trim();
const normalizeEmail = (value) => text(value).toLowerCase();
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const validatePassword = (password) => {
  if (password.length < 8 || password.length > 72) {
    return "Password must contain 8 to 72 characters";
  }
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/\d/.test(password)) return "Password must include a number";
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a special character";
  }
  return "";
};

const requestPasswordReset = async (req, res, next) => {
  let connection;

  try {
    const email = normalizeEmail(req.body.email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid vendor email address",
      });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT id, contact_name, email, status
       FROM vendor_panel_accounts
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const genericMessage =
      "If a vendor account exists for this email, a reset link has been sent.";

    if (!rows.length || !["active", "pending_setup"].includes(rows[0].status)) {
      return res.json({ success: true, message: genericMessage });
    }

    const account = rows[0];
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    await connection.beginTransaction();

    await connection.execute(
      `UPDATE vendor_password_reset_tokens
       SET used_at = NOW()
       WHERE vendor_panel_account_id = ? AND used_at IS NULL`,
      [account.id]
    );

    await connection.execute(
      `INSERT INTO vendor_password_reset_tokens
       (vendor_panel_account_id, token_hash, expires_at, requested_ip)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?)`,
      [account.id, tokenHash, req.ip || null]
    );

    const emailResult = await sendVendorPasswordResetEmail({
      email: account.email,
      contactName: account.contact_name,
      rawToken,
    });

    await connection.commit();

    return res.json({
      success: true,
      message: genericMessage,
      data:
        process.env.NODE_ENV !== "production" &&
        emailResult.developmentResetUrl
          ? { developmentResetUrl: emailResult.developmentResetUrl }
          : undefined,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const validateResetToken = async (req, res, next) => {
  let connection;

  try {
    const token = text(req.query.token);
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Password reset link is invalid",
      });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT reset.id
       FROM vendor_password_reset_tokens reset
       INNER JOIN vendor_panel_accounts account
         ON account.id = reset.vendor_panel_account_id
       WHERE reset.token_hash = ?
         AND reset.used_at IS NULL
         AND reset.expires_at > NOW()
         AND account.status IN ('active', 'pending_setup')
       LIMIT 1`,
      [hashToken(token)]
    );

    return res.json({
      success: true,
      data: { valid: rows.length > 0 },
      message: rows.length ? "Reset link is valid" : "Reset link is invalid or expired",
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const resetPassword = async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    const token = text(req.body.token);
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Password reset link is invalid",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirmation do not match",
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.execute(
      `SELECT reset.id AS reset_id, account.id AS account_id
       FROM vendor_password_reset_tokens reset
       INNER JOIN vendor_panel_accounts account
         ON account.id = reset.vendor_panel_account_id
       WHERE reset.token_hash = ?
         AND reset.used_at IS NULL
         AND reset.expires_at > NOW()
         AND account.status IN ('active', 'pending_setup')
       LIMIT 1
       FOR UPDATE`,
      [hashToken(token)]
    );

    if (!rows.length) {
      throw Object.assign(new Error("Password reset link is invalid or expired"), {
        status: 400,
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await connection.execute(
      `UPDATE vendor_panel_accounts
       SET password_hash = ?, updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, rows[0].account_id]
    );

    await connection.execute(
      `UPDATE vendor_password_reset_tokens
       SET used_at = NOW()
       WHERE vendor_panel_account_id = ? AND used_at IS NULL`,
      [rows[0].account_id]
    );

    await connection.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      message: "Password updated successfully. You can now sign in.",
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
};
