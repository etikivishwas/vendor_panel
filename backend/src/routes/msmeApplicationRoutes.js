const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const {
  getMsmeApplication,
  saveMsmeDraft,
  submitMsmeApplication,
} = require("../controllers/msmeApplicationController");

const router = express.Router();

router.get("/", authenticateVendor, getMsmeApplication);
router.put("/draft", authenticateVendor, saveMsmeDraft);
router.post("/submit", authenticateVendor, submitMsmeApplication);

module.exports = router;
