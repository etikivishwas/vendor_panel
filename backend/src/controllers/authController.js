const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const loginVendor = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const [vendors] = await pool.execute(
      `
        SELECT
          id,
          business_name,
          contact_name,
          email,
          password_hash,
          avatar_url,
          status
        FROM vendor_panel_accounts
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    if (!vendors.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const vendor = vendors[0];

    if (vendor.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Vendor account is not active",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      vendor.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        vendorId: vendor.id,
        email: vendor.email,
        role: "vendor",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      }
    );

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          contactName: vendor.contact_name,
          email: vendor.email,
          avatarUrl: vendor.avatar_url,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loginVendor,
};