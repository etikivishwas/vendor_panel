const express = require("express");

const {
  getVendorProfile,
  updateVendorProfile,
} = require("../controllers/profileController");

const {
  reverseGeocodeVendorLocation,
} = require("../controllers/locationController");

const {
  authenticateVendor,
} = require("../middleware/authMiddleware");

const {
  uploadVendorLogo,
} = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticateVendor,
  getVendorProfile
);

router.put(
  "/",
  authenticateVendor,
  uploadVendorLogo.single("logo"),
  updateVendorProfile
);

router.get(
  "/reverse-geocode",
  authenticateVendor,
  reverseGeocodeVendorLocation
);

module.exports = router;