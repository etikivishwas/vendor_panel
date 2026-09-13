const { pool } = require("../config/db");
const {
  syncVerificationNotifications,
} = require("../services/vendorNotificationService");

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

const mapNotification = (row) => ({
  id: Number(row.id),
  type: row.notification_type,
  title: row.title,
  message: row.message,
  actionUrl: row.action_url || "",
  isRead: Boolean(row.is_read),
  readAt: row.read_at,
  createdAt: row.created_at,
});

const getNotifications = async (req, res, next) => {
  let connection;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    /* This makes approval/rejection notifications robust even when the admin
       workflow was implemented before the notification feature. */
    await syncVerificationNotifications(connection, vendorId);

    const [rows] = await connection.execute(
      `SELECT id, notification_type, title, message, action_url,
              is_read, read_at, created_at
       FROM vendor_panel_notifications
       WHERE vendor_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit}`,
      [vendorId]
    );

    const [countRows] = await connection.execute(
      `SELECT COUNT(*) AS unread_count
       FROM vendor_panel_notifications
       WHERE vendor_id = ? AND is_read = 0`,
      [vendorId]
    );

    return res.json({
      success: true,
      data: {
        notifications: rows.map(mapNotification),
        unreadCount: Number(countRows[0].unread_count),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const markNotificationRead = async (req, res, next) => {
  let connection;

  try {
    const notificationId = Number(req.params.notificationId);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification",
      });
    }

    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [result] = await connection.execute(
      `UPDATE vendor_panel_notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE id = ? AND vendor_id = ?`,
      [notificationId, vendorId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    await connection.execute(
      `UPDATE vendor_panel_notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE vendor_id = ? AND is_read = 0`,
      [vendorId]
    );

    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
