const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const sslCaPath = process.env.DB_SSL_CA
  ? path.resolve(process.cwd(), process.env.DB_SSL_CA)
  : null;

const sslConfig = {
  minVersion: "TLSv1.2",
  rejectUnauthorized: true,
};

if (sslCaPath && fs.existsSync(sslCaPath)) {
  sslConfig.ca = fs.readFileSync(sslCaPath, "utf8");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 4000,

  ssl: sslConfig,

  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 300000,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  decimalNumbers: true,
  timezone: "Z",
});

const testConnection = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT DATABASE() AS database_name, VERSION() AS database_version"
    );

    console.log("MySQL/TiDB database connected successfully");
    console.log("Database:", rows[0].database_name);
    console.log("Version:", rows[0].database_version);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  pool,
  testConnection,
};