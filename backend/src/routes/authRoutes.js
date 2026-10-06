const express = require("express");

const {
  loginVendor,
  setupPassword,
} = require("../controllers/authController");

const router = express.Router();

router.get("/login", (req, res) => {
  res.status(405).json({
    success: false,
    message: "Use POST /api/vendor/auth/login to log in",
  });
});

router.post("/login", loginVendor);

router.post("/setup-password", setupPassword);

module.exports = router;