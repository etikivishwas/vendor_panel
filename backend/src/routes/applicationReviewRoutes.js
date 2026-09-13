const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getApplicationReview,
  createVerificationPaymentSession,
} = require("../controllers/applicationReviewController");

const router = express.Router();
router.get("/", authenticateVendor, getApplicationReview);
router.post("/payment-session", authenticateVendor, createVerificationPaymentSession);
module.exports = router;
