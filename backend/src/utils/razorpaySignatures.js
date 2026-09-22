const crypto = require("crypto");

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyCheckoutSignature = ({
  orderId,
  paymentId,
  signature,
  secret,
}) => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return safeCompare(expectedSignature, signature);
};

const verifyWebhookSignature = ({
  rawBody,
  signature,
  secret,
}) => {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return safeCompare(expectedSignature, signature);
};

module.exports = {
  verifyCheckoutSignature,
  verifyWebhookSignature,
};
