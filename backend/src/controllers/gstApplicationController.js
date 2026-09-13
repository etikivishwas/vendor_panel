const { pool } = require("../config/db");

const constitutionTypes = new Set([
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "public_limited",
  "huf",
  "trust",
  "society",
  "government",
  "other",
]);

const premisesTypes = new Set([
  "owned",
  "rented",
  "leased",
  "consent",
  "shared",
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
const digits = (value) => String(value || "").replace(/\D/g, "");
const pan = (value) => text(value).toUpperCase();

const parsePayload = (body) => ({
  tradeName: text(body.tradeName),
  legalBusinessName: text(body.legalBusinessName),
  businessPan: pan(body.businessPan),
  constitutionType: text(body.constitutionType),
  stateJurisdiction: text(body.stateJurisdiction),
  businessActivity: text(body.businessActivity),
  commencementDate: text(body.commencementDate),
  applicantName: text(body.applicantName),
  applicantDesignation: text(body.applicantDesignation),
  applicantPan: pan(body.applicantPan),
  aadhaarNumber: digits(body.aadhaarNumber),
  mobileNumber: text(body.mobileNumber),
  emailAddress: text(body.emailAddress).toLowerCase(),
  addressLine1: text(body.addressLine1),
  addressLine2: text(body.addressLine2),
  cityDistrict: text(body.cityDistrict),
  stateProvince: text(body.stateProvince),
  postalCode: text(body.postalCode),
  premisesType: text(body.premisesType),
  declarationAccepted:
    body.declarationAccepted === true ||
    body.declarationAccepted === "true" ||
    body.declarationAccepted === 1 ||
    body.declarationAccepted === "1",
});

const validatePan = (value, label) => {
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
    const error = new Error(`Enter a valid ${label}`);
    error.status = 400;
    throw error;
  }
};

const validateStep = (payload, step) => {
  if (step === 1) {
    if (!payload.tradeName) throw Object.assign(new Error("Trade name is required"), { status: 400 });
    if (!payload.legalBusinessName) throw Object.assign(new Error("Legal business name is required"), { status: 400 });
    validatePan(payload.businessPan, "business PAN");
    if (!constitutionTypes.has(payload.constitutionType)) {
      throw Object.assign(new Error("Select a valid constitution of business"), { status: 400 });
    }
    if (!payload.stateJurisdiction) throw Object.assign(new Error("State / Jurisdiction is required"), { status: 400 });
    if (!payload.businessActivity) throw Object.assign(new Error("Business activity is required"), { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.commencementDate)) {
      throw Object.assign(new Error("Commencement date is required"), { status: 400 });
    }
  }

  if (step === 2) {
    if (!payload.applicantName) throw Object.assign(new Error("Applicant name is required"), { status: 400 });
    if (!payload.applicantDesignation) throw Object.assign(new Error("Applicant designation is required"), { status: 400 });
    validatePan(payload.applicantPan, "applicant PAN");
    if (!/^\d{12}$/.test(payload.aadhaarNumber)) {
      throw Object.assign(new Error("Aadhaar number must contain 12 digits"), { status: 400 });
    }
  }

  if (step === 3) {
    if (!/^\+?[0-9 ()-]{10,20}$/.test(payload.mobileNumber)) {
      throw Object.assign(new Error("Enter a valid mobile number"), { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.emailAddress)) {
      throw Object.assign(new Error("Enter a valid email address"), { status: 400 });
    }
    if (!payload.addressLine1) throw Object.assign(new Error("Address line 1 is required"), { status: 400 });
    if (!payload.cityDistrict) throw Object.assign(new Error("City / District is required"), { status: 400 });
    if (!payload.stateProvince) throw Object.assign(new Error("State / Province is required"), { status: 400 });
    if (!payload.postalCode) throw Object.assign(new Error("Postal code is required"), { status: 400 });
    if (!premisesTypes.has(payload.premisesType)) {
      throw Object.assign(new Error("Select a valid nature of premises"), { status: 400 });
    }
  }
};

const validateLengths = (payload) => {
  const fields = [
    [payload.tradeName, 200, "Trade name"],
    [payload.legalBusinessName, 200, "Legal business name"],
    [payload.stateJurisdiction, 100, "State / Jurisdiction"],
    [payload.businessActivity, 150, "Business activity"],
    [payload.applicantName, 150, "Applicant name"],
    [payload.applicantDesignation, 100, "Applicant designation"],
    [payload.mobileNumber, 20, "Mobile number"],
    [payload.emailAddress, 190, "Email address"],
    [payload.addressLine1, 255, "Address line 1"],
    [payload.addressLine2, 255, "Address line 2"],
    [payload.cityDistrict, 120, "City / District"],
    [payload.stateProvince, 100, "State / Province"],
    [payload.postalCode, 20, "Postal code"],
  ];

  fields.forEach(([value, limit, label]) => {
    if (value.length > limit) {
      throw Object.assign(new Error(`${label} cannot exceed ${limit} characters`), { status: 400 });
    }
  });
};

const mapApplication = (row) => ({
  id: Number(row.id),
  tradeName: row.trade_name || "",
  legalBusinessName: row.legal_business_name || "",
  businessPan: row.business_pan || "",
  constitutionType: row.constitution_type || "",
  stateJurisdiction: row.state_jurisdiction || "",
  businessActivity: row.business_activity || "",
  commencementDate: row.commencement_date || "",
  applicantName: row.applicant_name || "",
  applicantDesignation: row.applicant_designation || "",
  applicantPan: row.applicant_pan || "",
  aadhaarNumber: row.aadhaar_number || "",
  mobileNumber: row.mobile_number || "",
  emailAddress: row.email_address || "",
  addressLine1: row.address_line_1 || "",
  addressLine2: row.address_line_2 || "",
  cityDistrict: row.city_district || "",
  stateProvince: row.state_province || "",
  postalCode: row.postal_code || "",
  premisesType: row.premises_type || "",
  currentStep: Number(row.current_step || 1),
  declarationAccepted: Boolean(row.declaration_accepted),
  status: row.status,
  submittedAt: row.submitted_at,
  reviewerRemarks: row.reviewer_remarks || "",
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getGstApplication = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [applicationRows] = await connection.execute(
      `SELECT * FROM vendor_gst_applications WHERE vendor_id = ? LIMIT 1`,
      [vendorId]
    );

    const [profileRows] = await connection.execute(
      `SELECT
         v.name,
         v.OWNER_NAME,
         v.phone,
         v.address,
         v.city,
         v.postal_code,
         vpa.email
       FROM vendors v
       INNER JOIN vendor_panel_accounts vpa ON vpa.existing_vendor_id = v.id
       WHERE v.id = ? AND vpa.id = ? LIMIT 1`,
      [vendorId, req.vendor.id]
    );

    const profile = profileRows[0] || {};
    return res.json({
      success: true,
      data: {
        application: applicationRows.length ? mapApplication(applicationRows[0]) : null,
        defaults: {
          tradeName: profile.name || "",
          legalBusinessName: profile.name || "",
          applicantName: profile.OWNER_NAME || "",
          mobileNumber: profile.phone || "",
          emailAddress: profile.email || "",
          addressLine1: profile.address || "",
          cityDistrict: profile.city || "",
          postalCode: profile.postal_code || "",
        },
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const upsertApplication = async (connection, vendorId, payload, currentStep, status, submittedAt) => {
  await connection.execute(
    `INSERT INTO vendor_gst_applications (
       vendor_id, trade_name, legal_business_name, business_pan,
       constitution_type, state_jurisdiction, business_activity,
       commencement_date, applicant_name, applicant_designation,
       applicant_pan, aadhaar_number, mobile_number, email_address,
       address_line_1, address_line_2, city_district, state_province,
       postal_code, premises_type, current_step, declaration_accepted,
       status, submitted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       trade_name = VALUES(trade_name),
       legal_business_name = VALUES(legal_business_name),
       business_pan = VALUES(business_pan),
       constitution_type = VALUES(constitution_type),
       state_jurisdiction = VALUES(state_jurisdiction),
       business_activity = VALUES(business_activity),
       commencement_date = VALUES(commencement_date),
       applicant_name = VALUES(applicant_name),
       applicant_designation = VALUES(applicant_designation),
       applicant_pan = VALUES(applicant_pan),
       aadhaar_number = VALUES(aadhaar_number),
       mobile_number = VALUES(mobile_number),
       email_address = VALUES(email_address),
       address_line_1 = VALUES(address_line_1),
       address_line_2 = VALUES(address_line_2),
       city_district = VALUES(city_district),
       state_province = VALUES(state_province),
       postal_code = VALUES(postal_code),
       premises_type = VALUES(premises_type),
       current_step = VALUES(current_step),
       declaration_accepted = VALUES(declaration_accepted),
       status = VALUES(status),
       submitted_at = VALUES(submitted_at),
       reviewer_remarks = NULL,
       reviewed_at = NULL`,
    [
      vendorId,
      nullable(payload.tradeName), nullable(payload.legalBusinessName), nullable(payload.businessPan),
      nullable(payload.constitutionType), nullable(payload.stateJurisdiction), nullable(payload.businessActivity),
      nullable(payload.commencementDate), nullable(payload.applicantName), nullable(payload.applicantDesignation),
      nullable(payload.applicantPan), nullable(payload.aadhaarNumber), nullable(payload.mobileNumber),
      nullable(payload.emailAddress), nullable(payload.addressLine1), nullable(payload.addressLine2),
      nullable(payload.cityDistrict), nullable(payload.stateProvince), nullable(payload.postalCode),
      nullable(payload.premisesType), currentStep, payload.declarationAccepted ? 1 : 0,
      status, submittedAt,
    ]
  );
};

const saveGstStep = async (req, res, next) => {
  let connection;
  try {
    const step = Number(req.params.step);
    if (![1, 2, 3, 4].includes(step)) {
      return res.status(400).json({ success: false, message: "Invalid application step" });
    }

    const payload = parsePayload(req.body);
    validateLengths(payload);
    if (step <= 3) validateStep(payload, step);

    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const nextStep = Math.min(step + 1, 4);
    await upsertApplication(connection, vendorId, payload, nextStep, "draft", null);

    return res.json({
      success: true,
      message: `Step ${step} saved successfully`,
      data: { currentStep: nextStep, status: "draft" },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const saveGstDraft = async (req, res, next) => {
  let connection;
  try {
    const payload = parsePayload(req.body);
    validateLengths(payload);
    const currentStep = Math.min(Math.max(Number(req.body.currentStep) || 1, 1), 4);

    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    await upsertApplication(connection, vendorId, payload, currentStep, "draft", null);

    return res.json({ success: true, message: "GST application draft saved", data: { currentStep } });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const submitGstApplication = async (req, res, next) => {
  let connection;
  try {
    const payload = parsePayload(req.body);
    validateLengths(payload);
    validateStep(payload, 1);
    validateStep(payload, 2);
    validateStep(payload, 3);

    if (!payload.declarationAccepted) {
      throw Object.assign(new Error("Accept the declaration before submitting"), { status: 400 });
    }

    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    await upsertApplication(connection, vendorId, payload, 4, "submitted", new Date());

    return res.json({
      success: true,
      message: "GST certificate application submitted successfully",
      data: { status: "submitted" },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getGstApplication,
  saveGstStep,
  saveGstDraft,
  submitGstApplication,
};
