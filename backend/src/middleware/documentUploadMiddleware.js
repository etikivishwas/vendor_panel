const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(process.cwd(), "uploads", "vendor-documents");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeExtension = allowedExtensions.has(extension) ? extension : ".bin";
    callback(null, `vendor-${req.vendor.id}-${file.fieldname}-${Date.now()}${safeExtension}`);
  },
});

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    const error = new Error("Only PDF, JPG, JPEG, PNG, and WebP files are allowed");
    error.status = 400;
    return callback(error);
  }
  callback(null, true);
};

const uploadVerificationDocuments = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

module.exports = { uploadVerificationDocuments };
