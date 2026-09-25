require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const {
  pool,
  testConnection,
} = require("./src/config/db");

const authRoutes = require("./src/routes/authRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const profileRoutes = require("./src/routes/profileRoutes");
const documentVerificationRoutes = require(
  "./src/routes/documentVerificationRoutes"
);
const vendorServicesRoutes = require(
  "./src/routes/vendorServicesRoutes"
);
const msmeApplicationRoutes = require(
  "./src/routes/msmeApplicationRoutes"
);
const labourApplicationRoutes = require(
  "./src/routes/labourApplicationRoutes"
);
const gstApplicationRoutes = require(
  "./src/routes/gstApplicationRoutes"
);
const subscriptionRoutes = require(
  "./src/routes/subscriptionRoutes"
);
const applicationReviewRoutes = require(
  "./src/routes/applicationReviewRoutes"
);
const vendorNotificationRoutes = require(
  "./src/routes/vendorNotificationRoutes"
);
const verificationPaymentRoutes = require(
  "./src/routes/verificationPaymentRoutes"
);
const razorpayWebhookRoutes = require(
  "./src/routes/razorpayWebhookRoutes.js"
);
const razorpayPaymentRoutes = require(
  "./src/routes/razorpayPaymentRoutes.js"
);

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:5174",
    ].filter(Boolean),
    credentials: true,
  })
);

/* Must be before express.json(). */
app.use(
  "/api/razorpay/webhook",
  razorpayWebhookRoutes
);

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(morgan("dev"));

app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads")
  )
);

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Vendor Panel API",
  });
});

app.get("/favicon.ico", (req, res) => {
  return res.status(204).end();
});

app.get("/api/health", async (req, res, next) => {
  try {
    const [result] = await pool.query(
      "SELECT NOW() AS database_time"
    );

    return res.status(200).json({
      success: true,
      message: "Vendor panel API is running",
      databaseConnected: true,
      databaseTime: result[0].database_time,
    });
  } catch (error) {
    return next(error);
  }
});

app.use("/api/vendor/auth", authRoutes);
app.use("/api/vendor/dashboard", dashboardRoutes);
app.use("/api/vendor/profile", profileRoutes);
app.use(
  "/api/vendor/document-verification",
  documentVerificationRoutes
);
app.use("/api/vendor/services", vendorServicesRoutes);
app.use(
  "/api/vendor/msme-application",
  msmeApplicationRoutes
);
app.use(
  "/api/vendor/labour-application",
  labourApplicationRoutes
);
app.use(
  "/api/vendor/gst-application",
  gstApplicationRoutes
);
app.use(
  "/api/vendor/subscriptions",
  subscriptionRoutes
);
app.use(
  "/api/vendor/application-review",
  applicationReviewRoutes
);
app.use(
  "/api/vendor/notifications",
  vendorNotificationRoutes
);
app.use(
  "/api/vendor/verification-payment",
  verificationPaymentRoutes
);
app.use("/api/razorpay", razorpayPaymentRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Each document must be smaller than 10 MB",
    });
  }

  if (error.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large",
    });
  }

  return res
    .status(error.status || error.statusCode || 500)
    .json({
      success: false,
      message:
        process.env.NODE_ENV === "production"
          ? "An internal server error occurred"
          : error.message || "An unexpected error occurred",
    });
});

const startServer = async () => {
  try {
    await testConnection();

    app.listen(port, () => {
      console.log(
        `Vendor API running on http://localhost:${port}`
      );
      console.log(
        `Health check: http://localhost:${port}/api/health`
      );
      console.log(
        `Razorpay webhook: http://localhost:${port}/api/razorpay/webhook`
      );
    });
  } catch (error) {
    console.error(
      "Server could not start:",
      error.message
    );
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(
    `${signal} received. Closing database pool.`
  );

  try {
    await pool.end();
    console.log("Database pool closed successfully.");
    process.exit(0);
  } catch (error) {
    console.error(
      "Error while closing database pool:",
      error
    );
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
