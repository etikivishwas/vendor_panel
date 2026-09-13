const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/vendorNotificationController");

const router = express.Router();

router.get("/", authenticateVendor, getNotifications);
router.patch("/read-all", authenticateVendor, markAllNotificationsRead);
router.patch(
  "/:notificationId/read",
  authenticateVendor,
  markNotificationRead
);

module.exports = router;
