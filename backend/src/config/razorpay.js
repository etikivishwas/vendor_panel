require("dotenv").config();

const Razorpay = require("razorpay");

const razorpayKeyId = String(
  process.env.RAZORPAY_KEY_ID || ""
).trim();

const razorpayKeySecret = String(
  process.env.RAZORPAY_KEY_SECRET || ""
).trim();

if (!razorpayKeyId) {
  throw new Error(
    "RAZORPAY_KEY_ID is missing from backend/.env"
  );
}

if (!razorpayKeySecret) {
  throw new Error(
    "RAZORPAY_KEY_SECRET is missing from backend/.env"
  );
}

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

module.exports = {
  razorpay,
  razorpayKeyId,
  razorpayKeySecret,
};
