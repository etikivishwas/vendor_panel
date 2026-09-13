const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getGstApplication,
  saveGstStep,
  saveGstDraft,
  submitGstApplication,
} = require("../controllers/gstApplicationController");

const router = express.Router();

router.get("/", authenticateVendor, getGstApplication);
router.put("/draft", authenticateVendor, saveGstDraft);
router.put("/step/:step", authenticateVendor, saveGstStep);
router.post("/submit", authenticateVendor, submitGstApplication);

module.exports = router;
