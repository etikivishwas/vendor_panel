const express = require("express");
const { authenticateVendor } = require("../middleware/authMiddleware");
const { uploadServiceImage } = require("../middleware/serviceImageUploadMiddleware");
const {
  getVendorServices,
  getServiceOptions,
  createVendorService,
  updateVendorService,
  changeServiceStatus,
} = require("../controllers/vendorServicesController");

const router = express.Router();
router.get("/options", authenticateVendor, getServiceOptions);
router.get("/", authenticateVendor, getVendorServices);
router.post("/", authenticateVendor, uploadServiceImage.single("image"), createVendorService);
router.put("/:id", authenticateVendor, uploadServiceImage.single("image"), updateVendorService);
router.patch("/:id/status", authenticateVendor, changeServiceStatus);
module.exports = router;
