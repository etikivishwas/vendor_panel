const { pool } = require("../config/db");

const industrySectors = new Set([
  "manufacturing",
  "construction",
  "retail",
  "hospitality",
  "healthcare",
  "education",
  "information_technology",
  "professional_services",
  "transport_logistics",
  "other",
]);

const getVendorId = async (connection, accountId) => {
  const [rows] = await connection.execute(
    `SELECT existing_vendor_id
     FROM vendor_panel_accounts
     WHERE id = ? AND status = 'active'
     LIMIT 1`,
    [accountId]
  );

  if (!rows.length) {
    const error = new Error("Vendor account not found");
    error.status = 404;
    throw error;
  }

  if (!rows[0].existing_vendor_id) {
    const error = new Error("This account is not linked to a vendor record");
    error.status = 409;
    throw error;
  }

  return Number(rows[0].existing_vendor_id);
};

const text = (value) => String(value || "").trim();
const nullable = (value) => text(value) || null;
const nonNegativeInteger = (value, label) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed < 0) {
    const error = new Error(`${label} must be a non-negative whole number`);
    error.status = 400;
    throw error;
  }
  return parsed;
};

const parsePayload = (body, requireComplete = false) => {
  const payload = {
    businessName: text(body.businessName),
    registrationNumber: text(body.registrationNumber).toUpperCase(),
    industrySector: text(body.industrySector),
    primaryContactName: text(body.primaryContactName),
    emailAddress: text(body.emailAddress).toLowerCase(),
    phoneNumber: text(body.phoneNumber),
    maleEmployees: nonNegativeInteger(body.maleEmployees, "Male employee count"),
    femaleEmployees: nonNegativeInteger(body.femaleEmployees, "Female employee count"),
    permanentEmployees: nonNegativeInteger(
      body.permanentEmployees,
      "Permanent employee count"
    ),
    contractEmployees: nonNegativeInteger(
      body.contractEmployees,
      "Contract employee count"
    ),
    registeredAddress: text(body.registeredAddress),
    cityDistrict: text(body.cityDistrict),
    stateProvince: text(body.stateProvince),
    postalCode: text(body.postalCode),
    operatingStatus:
      body.operatingStatus === true ||
      body.operatingStatus === "true" ||
      body.operatingStatus === 1 ||
      body.operatingStatus === "1",
  };

  const fields = [
    [payload.businessName, 200, "Business name"],
    [payload.registrationNumber, 100, "Registration number"],
    [payload.primaryContactName, 150, "Primary contact name"],
    [payload.emailAddress, 190, "Email address"],
    [payload.phoneNumber, 20, "Phone number"],
    [payload.registeredAddress, 500, "Registered address"],
    [payload.cityDistrict, 120, "City / District"],
    [payload.stateProvince, 120, "State / Province"],
    [payload.postalCode, 20, "Postal code"],
  ];

  fields.forEach(([value, limit, label]) => {
    if (value.length > limit) {
      const error = new Error(`${label} cannot exceed ${limit} characters`);
      error.status = 400;
      throw error;
    }
  });

  if (payload.industrySector && !industrySectors.has(payload.industrySector)) {
    const error = new Error("Select a valid industry sector");
    error.status = 400;
    throw error;
  }

  if (
    payload.emailAddress &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.emailAddress)
  ) {
    const error = new Error("Enter a valid email address");
    error.status = 400;
    throw error;
  }

  if (
    payload.phoneNumber &&
    !/^\+?[0-9 ()-]{10,20}$/.test(payload.phoneNumber)
  ) {
    const error = new Error("Enter a valid phone number");
    error.status = 400;
    throw error;
  }

  if (requireComplete) {
    const required = [
      [payload.businessName, "Business name"],
      [payload.registrationNumber, "Registration number"],
      [payload.industrySector, "Industry sector"],
      [payload.primaryContactName, "Primary contact name"],
      [payload.emailAddress, "Email address"],
      [payload.phoneNumber, "Phone number"],
      [payload.registeredAddress, "Registered address"],
      [payload.cityDistrict, "City / District"],
      [payload.stateProvince, "State / Province"],
      [payload.postalCode, "Postal code"],
    ];

    const missing = required.find(([value]) => !value);
    if (missing) {
      const error = new Error(`${missing[1]} is required`);
      error.status = 400;
      throw error;
    }

    const genderTotal = payload.maleEmployees + payload.femaleEmployees;
    const contractTotal =
      payload.permanentEmployees + payload.contractEmployees;

    if (genderTotal <= 0) {
      const error = new Error("Enter at least one employee");
      error.status = 400;
      throw error;
    }

    if (genderTotal !== contractTotal) {
      const error = new Error(
        "Gender employee total must match permanent and contract employee total"
      );
      error.status = 400;
      throw error;
    }
  }

  return payload;
};

const mapApplication = (row) => ({
  id: Number(row.id),
  businessName: row.business_name || "",
  registrationNumber: row.registration_number || "",
  industrySector: row.industry_sector || "",
  primaryContactName: row.primary_contact_name || "",
  emailAddress: row.email_address || "",
  phoneNumber: row.phone_number || "",
  maleEmployees: Number(row.male_employees || 0),
  femaleEmployees: Number(row.female_employees || 0),
  permanentEmployees: Number(row.permanent_employees || 0),
  contractEmployees: Number(row.contract_employees || 0),
  registeredAddress: row.registered_address || "",
  cityDistrict: row.city_district || "",
  stateProvince: row.state_province || "",
  postalCode: row.postal_code || "",
  operatingStatus: Boolean(row.operating_status),
  status: row.status,
  submittedAt: row.submitted_at,
  reviewerRemarks: row.reviewer_remarks || "",
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getLabourApplication = async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [applicationRows] = await connection.execute(
      `SELECT * FROM vendor_labour_applications
       WHERE vendor_id = ? LIMIT 1`,
      [vendorId]
    );

    const [profileRows] = await connection.execute(
      `SELECT
         v.name AS business_name,
         v.OWNER_NAME AS contact_name,
         v.phone,
         v.address,
         v.city,
         v.postal_code,
         vpa.email
       FROM vendors v
       INNER JOIN vendor_panel_accounts vpa
         ON vpa.existing_vendor_id = v.id
       WHERE v.id = ? AND vpa.id = ?
       LIMIT 1`,
      [vendorId, req.vendor.id]
    );

    const profile = profileRows[0] || {};

    return res.json({
      success: true,
      data: {
        application: applicationRows.length
          ? mapApplication(applicationRows[0])
          : null,
        defaults: {
          businessName: profile.business_name || "",
          primaryContactName: profile.contact_name || "",
          emailAddress: profile.email || "",
          phoneNumber: profile.phone || "",
          registeredAddress: profile.address || "",
          cityDistrict: profile.city || "",
          postalCode: profile.postal_code || "",
          operatingStatus: true,
        },
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const saveApplication = async (req, res, next, finalSubmission) => {
  let connection;

  try {
    const payload = parsePayload(req.body, finalSubmission);
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const status = finalSubmission ? "submitted" : "draft";

    await connection.execute(
      `INSERT INTO vendor_labour_applications (
         vendor_id,
         business_name,
         registration_number,
         industry_sector,
         primary_contact_name,
         email_address,
         phone_number,
         male_employees,
         female_employees,
         permanent_employees,
         contract_employees,
         registered_address,
         city_district,
         state_province,
         postal_code,
         operating_status,
         status,
         submitted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         business_name = VALUES(business_name),
         registration_number = VALUES(registration_number),
         industry_sector = VALUES(industry_sector),
         primary_contact_name = VALUES(primary_contact_name),
         email_address = VALUES(email_address),
         phone_number = VALUES(phone_number),
         male_employees = VALUES(male_employees),
         female_employees = VALUES(female_employees),
         permanent_employees = VALUES(permanent_employees),
         contract_employees = VALUES(contract_employees),
         registered_address = VALUES(registered_address),
         city_district = VALUES(city_district),
         state_province = VALUES(state_province),
         postal_code = VALUES(postal_code),
         operating_status = VALUES(operating_status),
         status = VALUES(status),
         submitted_at = VALUES(submitted_at),
         reviewer_remarks = NULL,
         reviewed_at = NULL`,
      [
        vendorId,
        nullable(payload.businessName),
        nullable(payload.registrationNumber),
        nullable(payload.industrySector),
        nullable(payload.primaryContactName),
        nullable(payload.emailAddress),
        nullable(payload.phoneNumber),
        payload.maleEmployees,
        payload.femaleEmployees,
        payload.permanentEmployees,
        payload.contractEmployees,
        nullable(payload.registeredAddress),
        nullable(payload.cityDistrict),
        nullable(payload.stateProvince),
        nullable(payload.postalCode),
        payload.operatingStatus ? 1 : 0,
        status,
        finalSubmission ? new Date() : null,
      ]
    );

    return res.status(finalSubmission ? 200 : 201).json({
      success: true,
      message: finalSubmission
        ? "Labour certificate application submitted successfully"
        : "Labour certificate application draft saved successfully",
      data: { status },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const saveLabourDraft = (req, res, next) =>
  saveApplication(req, res, next, false);

const submitLabourApplication = (req, res, next) =>
  saveApplication(req, res, next, true);

module.exports = {
  getLabourApplication,
  saveLabourDraft,
  submitLabourApplication,
};
