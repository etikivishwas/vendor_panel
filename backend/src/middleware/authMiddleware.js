const jwt = require("jsonwebtoken");

const authenticateVendor = (
  req,
  res,
  next
) => {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return res.status(401).json({
      success: false,
      message:
        "Authentication token is required",
      code:
        "VENDOR_TOKEN_REQUIRED",
    });
  }

  const token = authorization
    .slice(7)
    .trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message:
        "Authentication token is empty",
      code:
        "VENDOR_TOKEN_EMPTY",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (
      decoded.role !== "vendor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Vendor access is required",
        code:
          "VENDOR_ROLE_REQUIRED",
      });
    }

    const vendorId = Number(
      decoded.vendorId
    );

    const accountId = Number(
      decoded.accountId
    );

    if (
      !Number.isInteger(vendorId) ||
      vendorId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token does not contain a valid vendor ID",
        code:
          "INVALID_VENDOR_ID",
      });
    }

    req.vendor = {
      id: vendorId,

      accountId:
        Number.isInteger(
          accountId
        ) && accountId > 0
          ? accountId
          : null,

      email:
        decoded.email || null,

      role:
        decoded.role,
    };

    return next();
  } catch (error) {
    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your vendor session has expired. Please log in again.",
        code:
          "VENDOR_TOKEN_EXPIRED",
      });
    }

    if (
      error.name ===
      "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "The vendor authentication token is invalid. Please log in again.",
        code:
          "VENDOR_TOKEN_INVALID",
      });
    }

    console.error(
      "Vendor authentication error:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        "Vendor authentication failed",
      code:
        "VENDOR_AUTHENTICATION_FAILED",
    });
  }
};

module.exports = {
  authenticateVendor,
};