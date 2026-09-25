const path = require("path");
const multer = require("multer");

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedMimeTypes.has(file.mimetype) ||
    !allowedExtensions.has(extension)
  ) {
    const error = new Error(
      "Only PDF, JPG, JPEG, PNG, and WebP files are allowed"
    );
    error.status = 400;
    return callback(error);
  }

  callback(null, true);
};

const uploadVerificationDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3,
  },
});

module.exports = { uploadVerificationDocuments };