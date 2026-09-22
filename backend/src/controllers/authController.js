const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  pool,
} = require("../config/db");

const loginVendor = async (
  req,
  res,
  next
) => {
  try {
    const email = String(
      req.body.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      req.body.password || ""
    );

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const [accounts] =
      await pool.execute(
        `
          SELECT
            vpa.id AS account_id,
            vpa.existing_vendor_id,
            vpa.business_name,
            vpa.contact_name,
            vpa.email,
            vpa.password_hash,
            vpa.avatar_url,
            vpa.status,
            vpa.email_verified,
            v.id AS vendor_id,
            v.name AS vendor_name,
            v.is_active,
            v.registration_status
          FROM vendor_panel_accounts vpa
          INNER JOIN vendors v
            ON v.id =
              vpa.existing_vendor_id
          WHERE vpa.email = ?
          LIMIT 1
        `,
        [email]
      );

    if (!accounts.length) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    const account = accounts[0];

    if (
      account.status !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Vendor account is not active",
      });
    }

    if (
      !account.existing_vendor_id ||
      !account.vendor_id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This vendor-panel account is not connected to a valid vendor profile",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        account.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    /*
      IMPORTANT:

      vendorId must be vendors.id, which is
      vendor_panel_accounts.existing_vendor_id.

      Do not use vendor_panel_accounts.id as
      vendorId.
    */
    const vendorId = Number(
      account.existing_vendor_id
    );

    const accountId = Number(
      account.account_id
    );

    const token = jwt.sign(
      {
        vendorId,
        accountId,
        email: account.email,
        role: "vendor",
      },
      process.env.JWT_SECRET,
      {
        expiresIn:
          process.env
            .JWT_EXPIRES_IN ||
          "1d",
      }
    );

    await pool.execute(
      `
        UPDATE vendor_panel_accounts
        SET
          last_login_at = NOW(),
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [accountId]
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        vendor: {
          id: vendorId,
          accountId,
          businessName:
            account.business_name,
          contactName:
            account.contact_name,
          email:
            account.email,
          avatarUrl:
            account.avatar_url,
          emailVerified:
            Boolean(
              account.email_verified
            ),
          isActive:
            Boolean(
              account.is_active
            ),
          registrationStatus:
            account.registration_status,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  loginVendor,
};