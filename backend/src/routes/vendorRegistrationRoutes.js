const express = require("express");
const {
  getRegistrationCategories,
  registerVendor,
} = require("../controllers/vendorRegistrationController");

const router = express.Router();

router.get("/categories", getRegistrationCategories);
router.post("/", registerVendor);

module.exports = router;
