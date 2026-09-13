const { pool } = require("../config/db");

const organizationTypes = new Set([
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "public_limited",
  "trust",
  "society",
  "other",
]);

const majorActivities = new Set(["manufacturing", "services", "trading"]);

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

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
const normalizePan = (value) => String(value || "").trim().toUpperCase();
const normalizeText = (value) => String(value || "").trim();

const parsePayload = (body, finalSubmission) => {
  const payload = {
    enterpriseName: normalizeText(body.enterpriseName),
    businessPan: normalizePan(body.businessPan),
    organizationType: normalizeText(body.organizationType),
    majorActivity: normalizeText(body.majorActivity),
    aadhaarNumber: normalizeDigits(body.aadhaarNumber),
    applicantName: normalizeText(body.applicantName),
    mobileNumber: normalizeText(body.mobileNumber),
    emailAddress: normalizeText(body.emailAddress).toLowerCase(),
    commencementDate: normalizeText(body.commencementDate),
    employeeCount: Number(body.employeeCount),
    plantMachineryInvestment: Number(body.plantMachineryInvestment || 0),
    annualTurnover: Number(body.annualTurnover || 0),
    declarationAccepted:
      body.declarationAccepted === true ||
      body.declarationAccepted === "true" ||
      body.declarationAccepted === 1 ||
      body.declarationAccepted === "1",
  };

  if (!payload.enterpriseName || payload.enterpriseName.length > 200) {
    throw Object.assign(
      new Error("Enterprise name is required and must not exceed 200 characters"),
      { status: 400 }
    );
  }

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(payload.businessPan)) {
    throw Object.assign(new Error("Enter a valid 10-character business PAN"), {
      status: 400,
    });
  }

  if (!organizationTypes.has(payload.organizationType)) {
    throw Object.assign(new Error("Select a valid organization type"), {
      status: 400,
    });
  }

  if (!majorActivities.has(payload.majorActivity)) {
    throw Object.assign(new Error("Select a major business activity"), {
      status: 400,
    });
  }

  if (!/^\d{12}$/.test(payload.aadhaarNumber)) {
    throw Object.assign(new Error("Aadhaar number must contain 12 digits"), {
      status: 400,
    });
  }

  if (!payload.applicantName || payload.applicantName.length > 150) {
    throw Object.assign(new Error("Applicant name is required"), { status: 400 });
  }

  if (!/^\+?[0-9 ]{10,20}$/.test(payload.mobileNumber)) {
    throw Object.assign(new Error("Enter a valid mobile number"), { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.emailAddress)) {
    throw Object.assign(new Error("Enter a valid email address"), { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.commencementDate)) {
    throw Object.assign(new Error("Date of commencement is required"), {
      status: 400,
    });
  }

  if (!Number.isInteger(payload.employeeCount) || payload.employeeCount < 0) {
    throw Object.assign(new Error("Employee count must be a valid whole number"), {
      status: 400,
    });
  }

  if (
    !Number.isFinite(payload.plantMachineryInvestment) ||
    payload.plantMachineryInvestment < 0 ||
    !Number.isFinite(payload.annualTurnover) ||
    payload.annualTurnover < 0
  ) {
    throw Object.assign(new Error("Investment and turnover must be valid values"), {
      status: 400,
    });
  }

  if (finalSubmission && !payload.declarationAccepted) {
    throw Object.assign(
      new Error("Accept the declaration before submitting the application"),
      { status: 400 }
    );
  }

  return payload;
};

const mapApplication = (row) => ({
  id: Number(row.id),
  enterpriseName: row.enterprise_name,
  businessPan: row.business_pan,
  organizationType: row.organization_type,
  majorActivity: row.major_activity,
  aadhaarNumber: row.aadhaar_number,
  applicantName: row.applicant_name,
  mobileNumber: row.mobile_number,
  emailAddress: row.email_address,
  commencementDate: row.commencement_date,
  employeeCount: Number(row.employee_count),
  plantMachineryInvestment: Number(row.plant_machinery_investment),
  annualTurnover: Number(row.annual_turnover),
  declarationAccepted: Boolean(row.declaration_accepted),
  status: row.status,
  submittedAt: row.submitted_at,
  reviewerRemarks: row.reviewer_remarks || "",
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getMsmeApplication = async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [applicationRows] = await connection.execute(
      `SELECT * FROM vendor_msme_applications
       WHERE vendor_id = ? LIMIT 1`,
      [vendorId]
    );

    const [profileRows] = await connection.execute(
      `SELECT
         v.name AS enterprise_name,
         v.OWNER_NAME AS applicant_name,
         v.phone AS mobile_number,
         vpa.email AS email_address
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
          enterpriseName: profile.enterprise_name || "",
          applicantName: profile.applicant_name || "",
          mobileNumber: profile.mobile_number || "",
          emailAddress: profile.email_address || "",
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
      `INSERT INTO vendor_msme_applications (
         vendor_id,
         enterprise_name,
         business_pan,
         organization_type,
         major_activity,
         aadhaar_number,
         applicant_name,
         mobile_number,
         email_address,
         commencement_date,
         employee_count,
         plant_machinery_investment,
         annual_turnover,
         declaration_accepted,
         status,
         submitted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enterprise_name = VALUES(enterprise_name),
         business_pan = VALUES(business_pan),
         organization_type = VALUES(organization_type),
         major_activity = VALUES(major_activity),
         aadhaar_number = VALUES(aadhaar_number),
         applicant_name = VALUES(applicant_name),
         mobile_number = VALUES(mobile_number),
         email_address = VALUES(email_address),
         commencement_date = VALUES(commencement_date),
         employee_count = VALUES(employee_count),
         plant_machinery_investment = VALUES(plant_machinery_investment),
         annual_turnover = VALUES(annual_turnover),
         declaration_accepted = VALUES(declaration_accepted),
         status = VALUES(status),
         submitted_at = VALUES(submitted_at),
         reviewer_remarks = NULL,
         reviewed_at = NULL`,
      [
        vendorId,
        payload.enterpriseName,
        payload.businessPan,
        payload.organizationType,
        payload.majorActivity,
        payload.aadhaarNumber,
        payload.applicantName,
        payload.mobileNumber,
        payload.emailAddress,
        payload.commencementDate,
        payload.employeeCount,
        payload.plantMachineryInvestment,
        payload.annualTurnover,
        payload.declarationAccepted ? 1 : 0,
        status,
        finalSubmission ? new Date() : null,
      ]
    );

    return res.status(finalSubmission ? 200 : 201).json({
      success: true,
      message: finalSubmission
        ? "MSME / Udyam application submitted successfully"
        : "MSME / Udyam draft saved successfully",
      data: { status },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const saveMsmeDraft = (req, res, next) =>
  saveApplication(req, res, next, false);

const submitMsmeApplication = (req, res, next) =>
  saveApplication(req, res, next, true);

module.exports = {
  getMsmeApplication,
  saveMsmeDraft,
  submitMsmeApplication,
};
