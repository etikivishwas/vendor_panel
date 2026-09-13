const crypto = require("crypto");
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

const calculateFees = (setting) => {
  const registrationFee = Number(setting.registration_fee);
  const processingFee = Number(setting.processing_fee);
  const taxableAmount = registrationFee + processingFee;
  const taxRate = Number(setting.tax_rate);
  const taxAmount = Number((taxableAmount * taxRate / 100).toFixed(2));
  const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

  return {
    registrationFee,
    processingFee,
    taxableAmount,
    taxRate,
    taxAmount,
    totalAmount,
  };
};

const getApplicationReview = async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [submissionRows] = await connection.execute(
      `SELECT id, status, submitted_at, reviewed_at, reviewer_remarks
       FROM vendor_verification_submissions
       WHERE vendor_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [vendorId]
    );

    if (!submissionRows.length) {
      throw Object.assign(
        new Error("Submit the required documents before opening application review"),
        { status: 404 }
      );
    }

    const [vendorRows] = await connection.execute(
      `SELECT
         v.id,
         v.name AS company_name,
         v.OWNER_NAME AS applicant_name,
         v.phone,
         v.address,
         v.city,
         v.postal_code,
         v.PLAN AS vendor_plan,
         vpa.email
       FROM vendors v
       INNER JOIN vendor_panel_accounts vpa
         ON vpa.existing_vendor_id = v.id
       WHERE v.id = ? AND vpa.id = ?
       LIMIT 1`,
      [vendorId, req.vendor.id]
    );

    const [documentRows] = await connection.execute(
      `SELECT document_type, original_file_name, review_status,
              reviewer_remarks, updated_at
       FROM vendor_verification_documents
       WHERE vendor_id = ?
       ORDER BY id`,
      [vendorId]
    );

    const [feeRows] = await connection.execute(
      `SELECT id, certificate_type, service_level, validity_period,
              registration_fee, processing_fee, tax_rate
       FROM verification_fee_settings
       WHERE is_active = 1
       ORDER BY id
       LIMIT 1`
    );

    if (!feeRows.length) {
      throw Object.assign(new Error("Verification fee configuration is missing"), {
        status: 500,
      });
    }

    const submission = submissionRows[0];
    const vendor = vendorRows[0] || {};
    const fee = feeRows[0];
    const fees = calculateFees(fee);
    const documentsApproved =
      submission.status === "approved" &&
      documentRows.length >= 3 &&
      documentRows.every((document) => document.review_status === "approved");

    return res.json({
      success: true,
      data: {
        submission: {
          id: Number(submission.id),
          status: submission.status,
          submittedAt: submission.submitted_at,
          reviewedAt: submission.reviewed_at,
          reviewerRemarks: submission.reviewer_remarks || "",
          documentsApproved,
          paymentEnabled: documentsApproved,
        },
        certificate: {
          type: fee.certificate_type,
          serviceLevel: fee.service_level,
          validityPeriod: fee.validity_period,
        },
        applicant: {
          fullName: vendor.applicant_name || "Not provided",
          emailAddress: vendor.email || "Not provided",
          phoneNumber: vendor.phone || "Not provided",
          role: "Authorized Business Representative",
        },
        business: {
          companyName: vendor.company_name || "Not provided",
          registrationNumber: `TEDO-V-${String(vendorId).padStart(6, "0")}`,
          industry: vendor.vendor_plan || "Service Provider",
          registeredAddress: [vendor.address, vendor.city, vendor.postal_code]
            .filter(Boolean)
            .join(", ") || "Not provided",
        },
        documents: documentRows.map((document) => ({
          documentType: document.document_type,
          originalFileName: document.original_file_name,
          reviewStatus: document.review_status,
          reviewerRemarks: document.reviewer_remarks || "",
          updatedAt: document.updated_at,
        })),
        fees,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const createVerificationPaymentSession = async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const vendorId = await getVendorId(connection, req.vendor.id);

    const [submissionRows] = await connection.execute(
      `SELECT id, status
       FROM vendor_verification_submissions
       WHERE vendor_id = ?
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [vendorId]
    );

    if (!submissionRows.length || submissionRows[0].status !== "approved") {
      throw Object.assign(
        new Error("Payment is available only after document verification"),
        { status: 403 }
      );
    }

    const [documentRows] = await connection.execute(
      `SELECT review_status
       FROM vendor_verification_documents
       WHERE vendor_id = ?`,
      [vendorId]
    );

    if (
      documentRows.length < 3 ||
      !documentRows.every((document) => document.review_status === "approved")
    ) {
      throw Object.assign(
        new Error("All required documents must be approved before payment"),
        { status: 403 }
      );
    }

    const [feeRows] = await connection.execute(
      `SELECT id, registration_fee, processing_fee, tax_rate
       FROM verification_fee_settings
       WHERE is_active = 1
       ORDER BY id
       LIMIT 1`
    );

    if (!feeRows.length) {
      throw Object.assign(new Error("Verification fee configuration is missing"), {
        status: 500,
      });
    }

    await connection.execute(
      `UPDATE vendor_verification_payment_sessions
       SET status = 'cancelled'
       WHERE vendor_id = ?
         AND status IN ('pending', 'payment_initiated')`,
      [vendorId]
    );

    const fees = calculateFees(feeRows[0]);
    const token = crypto.randomBytes(24).toString("hex");

    await connection.execute(
      `INSERT INTO vendor_verification_payment_sessions
       (payment_token, vendor_id, submission_id, fee_setting_id,
        registration_fee, processing_fee, taxable_amount, tax_rate,
        tax_amount, total_amount, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending',
               DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [
        token,
        vendorId,
        submissionRows[0].id,
        feeRows[0].id,
        fees.registrationFee,
        fees.processingFee,
        fees.taxableAmount,
        fees.taxRate,
        fees.taxAmount,
        fees.totalAmount,
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Verification payment session created",
      data: { paymentToken: token },
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getApplicationReview,
  createVerificationPaymentSession,
};
