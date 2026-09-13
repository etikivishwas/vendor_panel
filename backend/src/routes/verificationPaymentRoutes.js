const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getVerificationPayment,
  updateVerificationPayment,
} = require("../controllers/verificationPaymentController");

const router = express.Router();

router.get("/:token", authenticateVendor, getVerificationPayment);
router.patch("/:token", authenticateVendor, updateVerificationPayment);

module.exports = router;
