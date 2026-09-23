const cloudinary = require("../config/cloudinary");

const { pool } = require("../config/db");
const {
  createVerificationNotification,
} = require("../services/vendorNotificationService");

const documentDefinitions = [
  { field: "gstCertificate", type: "gst_certificate", label: "GST Certificate" },
  { field: "msmeCertificate", type: "msme_certificate", label: "MSME Certificate" },
  { field: "identityProof", type: "identity_proof", label: "Other Identity Proof" },
];



const findVendorId = async (connection, accountId) => {
  const [rows] = await connection.execute(
    `SELECT existing_vendor_id FROM vendor_panel_accounts
     WHERE id = ? AND status = 'active' LIMIT 1`,
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

const getDocumentVerification = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const vendorId = await findVendorId(connection, req.vendor.id);

    const [submissionRows] = await connection.execute(
      `SELECT status, submitted_at, reviewed_at, reviewer_remarks
       FROM vendor_verification_submissions WHERE vendor_id = ? LIMIT 1`,
      [vendorId]
    );

    const [documentRows] = await connection.execute(
      `SELECT id, document_type, original_file_name, file_url, mime_type,
              file_size, vendor_remarks, review_status, reviewer_remarks,
              created_at, updated_at
       FROM vendor_verification_documents
       WHERE vendor_id = ? ORDER BY id`,
      [vendorId]
    );

    const submission = submissionRows[0] || {
      status: "not_submitted",
      submitted_at: null,
      reviewed_at: null,
      reviewer_remarks: null,
    };

    return res.json({
      success: true,
      data: {
        status: submission.status,
        submittedAt: submission.submitted_at,
        reviewedAt: submission.reviewed_at,
        reviewerRemarks: submission.reviewer_remarks,
        documents: documentRows.map((row) => ({
          id: Number(row.id),
          documentType: row.document_type,
          originalFileName: row.original_file_name,
          fileUrl: row.file_url,
          mimeType: row.mime_type,
          fileSize: Number(row.file_size),
          remarks: row.vendor_remarks || "",
          reviewStatus: row.review_status,
          reviewerRemarks: row.reviewer_remarks || "",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const submitDocumentVerification = async (req, res, next) => {
  
  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const vendorId = await findVendorId(connection, req.vendor.id);

    const [existingRows] = await connection.execute(
      `SELECT document_type FROM vendor_verification_documents WHERE vendor_id = ?`,
      [vendorId]
    );
    const existingTypes = new Set(existingRows.map((row) => row.document_type));

    const remarks = {
      gst_certificate: String(req.body.gstRemarks || "").trim(),
      msme_certificate: String(req.body.msmeRemarks || "").trim(),
      identity_proof: String(req.body.identityRemarks || "").trim(),
    };

    for (const definition of documentDefinitions) {
      const file = req.files?.[definition.field]?.[0];
      if (!file && !existingTypes.has(definition.type)) {
        const error = new Error(`${definition.label} is required`);
        error.status = 400;
        throw error;
      }

      if (remarks[definition.type].length > 500) {
        const error = new Error(`${definition.label} remarks cannot exceed 500 characters`);
        error.status = 400;
        throw error;
      }

     if (file) {
  const cloudinaryResult = await new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: "milieu/vendor-documents",
      resource_type: "image",
      use_filename: true,
      unique_filename: true,
    },
    (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    }
  );

  stream.end(file.buffer);
});

const fileUrl = cloudinaryResult.secure_url;
const storedFileName = cloudinaryResult.public_id;

  await connection.execute(
    `INSERT INTO vendor_verification_documents
       (vendor_id, document_type, original_file_name, stored_file_name,
        file_url, mime_type, file_size, vendor_remarks, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
     ON DUPLICATE KEY UPDATE
       original_file_name = VALUES(original_file_name),
       stored_file_name = VALUES(stored_file_name),
       file_url = VALUES(file_url),
       mime_type = VALUES(mime_type),
       file_size = VALUES(file_size),
       vendor_remarks = VALUES(vendor_remarks),
       review_status = 'pending', reviewer_remarks = NULL, reviewed_at = NULL`,
    [
      vendorId,
      definition.type,
      file.originalname,
      storedFileName,
      fileUrl,
      file.mimetype,
      file.size,
      remarks[definition.type] || null,
    ]
  );
} else {
        await connection.execute(
          `UPDATE vendor_verification_documents
           SET vendor_remarks = ?, review_status = 'pending',
               reviewer_remarks = NULL, reviewed_at = NULL
           WHERE vendor_id = ? AND document_type = ?`,
          [remarks[definition.type] || null, vendorId, definition.type]
        );
      }
    }

    await connection.execute(
      `INSERT INTO vendor_verification_submissions
         (vendor_id, status, submitted_at, reviewed_at, reviewer_remarks)
       VALUES (?, 'pending_review', NOW(), NULL, NULL)
       ON DUPLICATE KEY UPDATE
         status = 'pending_review', submitted_at = NOW(),
         reviewed_at = NULL, reviewer_remarks = NULL`,
      [vendorId]
    );
    const [submissionRows] =
      await connection.execute(
        `SELECT id
     FROM vendor_verification_submissions
     WHERE vendor_id = ?
     ORDER BY id DESC
     LIMIT 1`,
        [vendorId]
      );

    await createVerificationNotification(
      connection,
      {
        vendorId,
        submissionId: Number(
          submissionRows[0].id
        ),
        status: "pending_review",
      }
    );

    await connection.execute(
      `INSERT INTO vendor_panel_verifications
         (vendor_id, verification_status, verified_at, expires_at)
       VALUES (?, 'pending', NULL, NULL)
       ON DUPLICATE KEY UPDATE
         verification_status = 'pending', verified_at = NULL`,
      [vendorId]
    );

    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Documents submitted for review successfully",
      data: { status: "pending_review" },
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    
    next(error);
  } finally {
    if (connection) connection.release();
  }
};


module.exports = {
  getDocumentVerification,
  submitDocumentVerification,
};
