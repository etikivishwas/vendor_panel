const express = require("express");
const {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} = require("../controllers/vendorPasswordResetController");

const router = express.Router();

router.post("/request", requestPasswordReset);
router.get("/validate", validateResetToken);
router.post("/reset", resetPassword);

module.exports = router;
