const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const { uploadVerificationDocuments } = require("../middleware/documentUploadMiddleware");
const {
  getDocumentVerification,
  submitDocumentVerification,
} = require("../controllers/documentVerificationController");

const router = express.Router();

router.get("/", authenticateVendor, getDocumentVerification);

router.post(
  "/submit",
  authenticateVendor,
  uploadVerificationDocuments.fields([
    { name: "gstCertificate", maxCount: 1 },
    { name: "msmeCertificate", maxCount: 1 },
    { name: "identityProof", maxCount: 1 },
  ]),
  submitDocumentVerification
);

module.exports = router;
