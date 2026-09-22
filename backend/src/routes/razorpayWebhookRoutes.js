const express = require("express");

const {
  handleRazorpayWebhook,
} = require(
  "../controllers/razorpayPaymentController.js"
);

const router = express.Router();

router.post(
  "/",
  express.raw({
    type: "application/json",
  }),
  handleRazorpayWebhook
);

module.exports = router;
