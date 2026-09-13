const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "vendor-logos"
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

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

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const originalExtension = path
      .extname(file.originalname)
      .toLowerCase();

    const extension = allowedExtensions.has(originalExtension)
      ? originalExtension
      : ".jpg";

    const vendorAccountId = req.vendor?.id || "unknown";

    const safeFilename = [
      "vendor",
      vendorAccountId,
      Date.now(),
    ].join("-");

    callback(null, `${safeFilename}${extension}`);
  },
});

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