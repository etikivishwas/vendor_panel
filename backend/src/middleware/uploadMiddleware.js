const path = require("path");
const multer = require("multer");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const validMimeType = allowedMimeTypes.has(file.mimetype);
  const validExtension = allowedExtensions.has(extension);

  if (!validMimeType || !validExtension) {
    const error = new Error(
      "Only JPG, JPEG, PNG, and WebP images are allowed"
    );

    error.status = 400;
    return callback(error);
  }

  callback(null, true);
};

const uploadVendorLogo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadVendorLogo,
};