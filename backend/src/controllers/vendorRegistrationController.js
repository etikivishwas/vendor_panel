const bcrypt = require("bcrypt");
const { pool } = require("../config/db");

const text = (value) => String(value || "").trim();
const emailValue = (value) => text(value).toLowerCase();
const digits = (value) => String(value || "").replace(/\D/g, "");

const allowedExperience = new Set([
  "less_than_1",
  "1_3",
  "3_5",
  "5_10",
  "more_than_10",
]);

const parseTime = (value, fallback) => {
  const source = text(value) || fallback;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(source)
    ? `${source}:00`
    : null;
};

const validatePassword = (password) => {
  if (password.length < 8 || password.length > 72) {
    return "Password must contain 8 to 72 characters";
  }
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/\d/.test(password)) return "Password must include a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character";
  return "";
};

const getRegistrationCategories = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT id, name, description
       FROM vendor_categories
       WHERE status = 'active'
       ORDER BY sort_order, name`
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        description: row.description || "",
      })),
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const registerVendor = async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    const payload = {
      businessName: text(req.body.businessName),
      ownerName: text(req.body.ownerName),
      categoryId: Number(req.body.categoryId),
      serviceType: text(req.body.serviceType),
      description: text(req.body.description),
      yearsOfExperience: text(req.body.yearsOfExperience),
      minimumPrice: Number(req.body.minimumPrice || 0),
      maximumPrice: Number(req.body.maximumPrice || 0),
      openingTime: parseTime(req.body.openingTime, "09:00"),
      closingTime: parseTime(req.body.closingTime, "18:00"),
      phone: digits(req.body.phone),
      whatsapp: digits(req.body.whatsapp || req.body.phone),
      address: text(req.body.address),
      city: text(req.body.city),
      state: text(req.body.state),
      postalCode: text(req.body.postalCode),
      landmark: text(req.body.landmark),
      email: emailValue(req.body.email),
      password: String(req.body.password || ""),
      confirmPassword: String(req.body.confirmPassword || ""),
      privacyAccepted: Boolean(req.body.privacyAccepted),
      termsAccepted: Boolean(req.body.termsAccepted),
    };

    const required = [
      [payload.businessName, "Business name"],
      [payload.ownerName, "Owner or contact name"],
      [payload.serviceType, "Primary service"],
      [payload.description, "Business description"],
      [payload.phone, "Phone number"],
      [payload.address, "Business address"],
      [payload.city, "City"],
      [payload.state, "State"],
      [payload.postalCode, "Postal code"],
      [payload.email, "Email address"],
    ];

    const missing = required.find(([value]) => !value);
    if (missing) {
      return res.status(400).json({ success: false, message: `${missing[1]} is required` });
    }

    if (!Number.isInteger(payload.categoryId) || payload.categoryId <= 0) {
      return res.status(400).json({ success: false, message: "Select a valid service category" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    if (!/^\d{10,15}$/.test(payload.phone)) {
      return res.status(400).json({ success: false, message: "Phone number must contain 10 to 15 digits" });
    }

    if (payload.whatsapp && !/^\d{10,15}$/.test(payload.whatsapp)) {
      return res.status(400).json({ success: false, message: "WhatsApp number must contain 10 to 15 digits" });
    }

    if (!/^\d{4,10}$/.test(payload.postalCode)) {
      return res.status(400).json({ success: false, message: "Enter a valid postal code" });
    }

    if (payload.yearsOfExperience && !allowedExperience.has(payload.yearsOfExperience)) {
      return res.status(400).json({ success: false, message: "Select valid experience" });
    }

    if (
      !Number.isFinite(payload.minimumPrice) ||
      !Number.isFinite(payload.maximumPrice) ||
      payload.minimumPrice < 0 ||
      payload.maximumPrice < payload.minimumPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "Maximum price must be equal to or greater than minimum price",
      });
    }

    if (!payload.openingTime || !payload.closingTime) {
      return res.status(400).json({ success: false, message: "Enter valid business hours" });
    }

    const passwordError = validatePassword(payload.password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    if (payload.password !== payload.confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    if (!payload.privacyAccepted || !payload.termsAccepted) {
      return res.status(400).json({
        success: false,
        message: "Accept the Privacy Policy and Terms of Service",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [categoryRows] = await connection.execute(
      `SELECT id, name FROM vendor_categories
       WHERE id = ? AND status = 'active' LIMIT 1`,
      [payload.categoryId]
    );

    if (!categoryRows.length) {
      throw Object.assign(new Error("Selected category is unavailable"), { status: 400 });
    }

    const [duplicateRows] = await connection.execute(
      `SELECT email FROM vendor_panel_accounts WHERE email = ? LIMIT 1`,
      [payload.email]
    );

    if (duplicateRows.length) {
      throw Object.assign(
        new Error("An account already exists for this email. Please sign in or reset the password."),
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const [vendorResult] = await connection.execute(
      `INSERT INTO vendors
       (name, owner_name, service_type, category_id, PLAN, description,
        years_of_experience, minimum_price, maximum_price, opening_time,
        closing_time, registration_status, submitted_at, is_verified,
        is_premium, phone, whatsapp, email, address, city, state,
        postal_code, landmark, is_active, listing_type)
       VALUES (?, ?, ?, ?, 'Free Listing', ?, ?, ?, ?, ?, ?, 'submitted',
               NOW(), 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'General Listing')`,
      [
        payload.businessName,
        payload.ownerName,
        payload.serviceType,
        payload.categoryId,
        payload.description,
        payload.yearsOfExperience || null,
        payload.minimumPrice,
        payload.maximumPrice,
        payload.openingTime,
        payload.closingTime,
        payload.phone,
        payload.whatsapp || payload.phone,
        payload.email,
        payload.address,
        payload.city,
        payload.state,
        payload.postalCode,
        payload.landmark || null,
      ]
    );

    const vendorId = Number(vendorResult.insertId);

    await connection.execute(
      `INSERT INTO vendor_panel_accounts
       (existing_vendor_id, business_name, contact_name, email,
        password_hash, status, email_verified)
       VALUES (?, ?, ?, ?, ?, 'active', 0)`,
      [
        vendorId,
        payload.businessName,
        payload.ownerName,
        payload.email,
        passwordHash,
      ]
    );

    await connection.execute(
      `INSERT INTO vendor_registration_consents
       (vendor_id, privacy_accepted, terms_accepted, accepted_at)
       VALUES (?, 1, 1, NOW())`,
      [vendorId]
    );

    const applicationReference = `TEDO-V-${String(vendorId).padStart(6, "0")}`;

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Vendor registration submitted successfully",
      data: {
        vendorId,
        applicationReference,
        email: payload.email,
        registrationStatus: "submitted",
        accountStatus: "active",
      },
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      error.status = 409;
      error.message = "A vendor account already exists for the supplied details";
    }

    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getRegistrationCategories,
  registerVendor,
};
