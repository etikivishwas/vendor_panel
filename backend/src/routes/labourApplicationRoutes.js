const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getLabourApplication,
  saveLabourDraft,
  submitLabourApplication,
} = require("../controllers/labourApplicationController");

const router = express.Router();

router.get("/", authenticateVendor, getLabourApplication);
router.put("/draft", authenticateVendor, saveLabourDraft);
router.post("/submit", authenticateVendor, submitLabourApplication);

module.exports = router;
