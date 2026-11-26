const express = require("express");

const {
  getVendorReviews,
  replyToVendorReview,
} = require(
  "../controllers/vendorReviewController"
);

const {
  authenticateVendor,
} = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

router.use(authenticateVendor);

router.get(
  "/reviews",
  getVendorReviews
);

router.put(
  "/reviews/:reviewId/reply",
  replyToVendorReview
);

module.exports = router;