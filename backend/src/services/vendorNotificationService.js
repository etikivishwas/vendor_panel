const REVIEW_URL = "/document-verification/application-review";

const notificationTemplates = {
  pending_review: {
    type: "verification_submitted",
    title: "Documents submitted for review",
    message:
      "Your business documents were submitted successfully. Please wait while the verification team reviews them.",
  },
  approved: {
    type: "verification_approved",
    title: "Documents verified",
    message:
      "Your submitted documents have been verified. Payment is now available from Application Review.",
  },
  rejected: {
    type: "verification_rejected",
    title: "Document changes required",
    message:
      "The verification team requested changes to one or more documents. Open Application Review for details.",
  },
};

const createVerificationNotification = async (
  connection,
  { vendorId, submissionId, status }
) => {
  const template = notificationTemplates[status];
  if (!template) return;

  const eventKey = `verification:${submissionId}:${status}`;

  await connection.execute(
    `INSERT INTO vendor_panel_notifications
       (vendor_id, event_key, notification_type, title, message,
        action_url, is_read)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE event_key = event_key`,
    [
      vendorId,
      eventKey,
      template.type,
      template.title,
      template.message,
      REVIEW_URL,
    ]
  );
};

const syncVerificationNotifications = async (connection, vendorId) => {
  const [rows] = await connection.execute(
    `SELECT id, status
     FROM vendor_verification_submissions
     WHERE vendor_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [vendorId]
  );

  if (!rows.length) return;

  await createVerificationNotification(connection, {
    vendorId,
    submissionId: Number(rows[0].id),
    status: rows[0].status,
  });
};

module.exports = {
  createVerificationNotification,
  syncVerificationNotifications,
};
