const express = require("express");

const {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  createVerificationOrder,
  verifyVerificationPayment,
} = require(
  "../controllers/razorpayPaymentController.js"
);

const {
  authenticateVendor,
} = require(
  "../middleware/authMiddleware.js"
);

const router = express.Router();

router.post(
  "/subscriptions/:token/order",
  authenticateVendor,
  createSubscriptionOrder
);

router.post(
  "/subscriptions/:token/verify",
  authenticateVendor,
  verifySubscriptionPayment
);

router.post(
  "/verifications/:token/order",
  authenticateVendor,
  createVerificationOrder
);

router.post(
  "/verifications/:token/verify",
  authenticateVendor,
  verifyVerificationPayment
);

module.exports = router;
