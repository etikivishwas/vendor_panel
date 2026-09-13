const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getSubscriptions,
  createCheckout,
  getCheckout,
  updatePaymentMethod,
} = require("../controllers/subscriptionController");

const router = express.Router();
router.get("/", authenticateVendor, getSubscriptions);
router.post("/plans/:planId/checkout", authenticateVendor, createCheckout);
router.get("/checkout/:token", authenticateVendor, getCheckout);
router.patch("/checkout/:token/payment-method", authenticateVendor, updatePaymentMethod);
module.exports = router;
