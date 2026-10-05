const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { pool } = require("../config/db");

const SETUP_TOKEN_EXPIRY_HOURS = 24;

exports.setupPassword = async (req, res, next) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Setup token and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const [accounts] = await pool.execute(
      `
        SELECT
          id,
          email,
          status,
          setup_token_hash,
          setup_token_expires_at
        FROM vendor_panel_accounts
        WHERE setup_token_hash = ?
        LIMIT 1
      `,
      [tokenHash]
    );

    if (!accounts.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired setup link.",
      });
    }

    const account = accounts[0];

    if (account.status !== "pending_setup") {
      return res.status(400).json({
        success: false,
        message: "This vendor account has already been activated.",
      });
    }

    if (
      !account.setup_token_expires_at ||
      new Date(account.setup_token_expires_at) < new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "This setup link has expired.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.execute(
      `
        UPDATE vendor_panel_accounts
        SET
          password_hash = ?,
          status = 'active',
          email_verified = 1,
          setup_token_hash = NULL,
          setup_token_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [passwordHash, account.id]
    );

    return res.status(200).json({
      success: true,
      message: "Password created successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};