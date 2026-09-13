const express = require("express");
const {
  getDashboard,
} = require("../controllers/dashboardController");
const {
  authenticateVendor,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateVendor, getDashboard);

module.exports = router;