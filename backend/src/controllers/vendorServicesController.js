const { pool } = require("../config/db");
const cloudinary = require("../config/cloudinary");

const validStatuses = new Set(["active", "draft", "archived"]);
const validPricingTypes = new Set(["fixed", "starting_from", "range", "quote"]);



const getVendorId = async (connection, accountId) => {
  const [rows] = await connection.execute(
    `SELECT existing_vendor_id FROM vendor_panel_accounts
     WHERE id = ? AND status = 'active' LIMIT 1`,
    [accountId]
  );
  if (!rows.length) {
    const error = new Error("Vendor account not found");
    error.status = 404;
    throw error;
  }
  if (!rows[0].existing_vendor_id) {
    const error = new Error("This account is not linked to a vendor record");
    error.status = 409;
    throw error;
  }
  return Number(rows[0].existing_vendor_id);
};

const parsePrice = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const validatePayload = (body) => {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const status = String(body.status || "draft").trim();
  const pricingType = String(body.pricingType || "fixed").trim();
  const categoryId = Number(body.categoryId);
  const serviceId = body.serviceId ? Number(body.serviceId) : null;
  const priceMin = parsePrice(body.priceMin);
  const priceMax = parsePrice(body.priceMax);

  if (!name || name.length > 150) throw Object.assign(new Error("Service name is required and must not exceed 150 characters"), { status: 400 });
  if (!Number.isInteger(categoryId) || categoryId <= 0) throw Object.assign(new Error("A valid category is required"), { status: 400 });
  if (serviceId !== null && (!Number.isInteger(serviceId) || serviceId <= 0)) throw Object.assign(new Error("The selected catalog service is invalid"), { status: 400 });
  if (description.length > 1000) throw Object.assign(new Error("Description cannot exceed 1000 characters"), { status: 400 });
  if (!validStatuses.has(status)) throw Object.assign(new Error("Invalid service status"), { status: 400 });
  if (!validPricingTypes.has(pricingType)) throw Object.assign(new Error("Invalid pricing type"), { status: 400 });
  if (Number.isNaN(priceMin) || Number.isNaN(priceMax) || priceMin < 0 || priceMax < 0) throw Object.assign(new Error("Prices must be valid positive numbers"), { status: 400 });
  if (pricingType !== "quote" && priceMin === null) throw Object.assign(new Error("A minimum price is required"), { status: 400 });
  if (pricingType === "range" && priceMax === null) throw Object.assign(new Error("A maximum price is required for range pricing"), { status: 400 });
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) throw Object.assign(new Error("Maximum price cannot be lower than minimum price"), { status: 400 });

  return { name, description: description || null, status, pricingType, categoryId, serviceId, priceMin, priceMax };
};

const mapService = (row) => ({
  id: Number(row.id),
  serviceId: row.service_id ? Number(row.service_id) : null,
  categoryId: Number(row.category_id),
  categoryName: row.category_name,
  name: row.name,
  description: row.description || "",
  pricingType: row.pricing_type,
  priceMin: row.price_min === null ? null : Number(row.price_min),
  priceMax: row.price_max === null ? null : Number(row.price_max),
  imageUrl: row.image_url || "",
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getVendorServices = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);
    const status = String(req.query.status || "all");
    const search = String(req.query.search || "").trim();

    const conditions = ["vs.vendor_id = ?"];
    const params = [vendorId];
    if (status !== "all") {
      if (!validStatuses.has(status)) return res.status(400).json({ success: false, message: "Invalid status filter" });
      conditions.push("vs.status = ?");
      params.push(status);
    }
    if (search) {
      conditions.push("(vs.name LIKE ? OR vs.description LIKE ? OR sc.name LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const [rows] = await connection.execute(
      `SELECT vs.*, sc.name AS category_name
       FROM vendor_services vs
       INNER JOIN service_categories sc ON sc.id = vs.category_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY vs.sort_order ASC, vs.updated_at DESC`,
      params
    );

    const [countRows] = await connection.execute(
      `SELECT status, COUNT(*) AS total FROM vendor_services
       WHERE vendor_id = ? GROUP BY status`,
      [vendorId]
    );
    const counts = { active: 0, draft: 0, archived: 0 };
    countRows.forEach((row) => { counts[row.status] = Number(row.total); });

    return res.json({ success: true, data: { services: rows.map(mapService), counts } });
  } catch (error) {
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const getServiceOptions = async (req, res, next) => {
  try {
    const [categories] = await pool.execute(
      `SELECT id, name FROM service_categories
       WHERE is_active = 1 ORDER BY name ASC`
    );
    const [services] = await pool.execute(
      `SELECT id, category_id, name, description FROM services
       WHERE is_active = 1 ORDER BY name ASC`
    );
    return res.json({
      success: true,
      data: {
        categories: categories.map((row) => ({ id: Number(row.id), name: row.name })),
        catalogServices: services.map((row) => ({
          id: Number(row.id), categoryId: Number(row.category_id), name: row.name, description: row.description || "",
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createVendorService = async (req, res, next) => {
  let connection;
  try {
    const payload = validatePayload(req.body);
    connection = await pool.getConnection();
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [categoryRows] = await connection.execute(
      `SELECT id FROM service_categories WHERE id = ? AND is_active = 1 LIMIT 1`,
      [payload.categoryId]
    );
    if (!categoryRows.length) throw Object.assign(new Error("Selected category is inactive or invalid"), { status: 400 });

    if (payload.serviceId) {
      const [serviceRows] = await connection.execute(
        `SELECT id FROM services WHERE id = ? AND category_id = ? AND is_active = 1 LIMIT 1`,
        [payload.serviceId, payload.categoryId]
      );
      if (!serviceRows.length) throw Object.assign(new Error("Selected catalog service does not belong to this category"), { status: 400 });
    }

    let imageUrl = null;

if (req.file) {
  const cloudinaryResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "milieu/service-images",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(req.file.buffer);
  });

  imageUrl = cloudinaryResult.secure_url;
}
    const [result] = await connection.execute(
      `INSERT INTO vendor_services
       (vendor_id, service_id, category_id, name, description, pricing_type,
        price_min, price_max, image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, payload.serviceId, payload.categoryId, payload.name, payload.description,
       payload.pricingType, payload.priceMin, payload.priceMax, imageUrl, payload.status]
    );

    return res.status(201).json({ success: true, message: "Service created successfully", data: { id: Number(result.insertId) } });
  } catch (error) {
    
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const updateVendorService = async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  let oldImageUrl = null;
  try {
    const serviceRecordId = Number(req.params.id);
    if (!Number.isInteger(serviceRecordId) || serviceRecordId <= 0) throw Object.assign(new Error("Invalid service ID"), { status: 400 });
    const payload = validatePayload(req.body);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const vendorId = await getVendorId(connection, req.vendor.id);

    const [existingRows] = await connection.execute(
      `SELECT image_url FROM vendor_services WHERE id = ? AND vendor_id = ? LIMIT 1 FOR UPDATE`,
      [serviceRecordId, vendorId]
    );
    if (!existingRows.length) throw Object.assign(new Error("Service not found"), { status: 404 });
    oldImageUrl = existingRows[0].image_url;

    let imageUrl = oldImageUrl;

if (req.file) {
  const cloudinaryResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "milieu/service-images",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(req.file.buffer);
  });

  imageUrl = cloudinaryResult.secure_url;
}
    await connection.execute(
      `UPDATE vendor_services SET service_id = ?, category_id = ?, name = ?,
       description = ?, pricing_type = ?, price_min = ?, price_max = ?,
       image_url = ?, status = ? WHERE id = ? AND vendor_id = ?`,
      [payload.serviceId, payload.categoryId, payload.name, payload.description,
       payload.pricingType, payload.priceMin, payload.priceMax, imageUrl,
       payload.status, serviceRecordId, vendorId]
    );

    await connection.commit();
    transactionStarted = false;
    

    return res.json({ success: true, message: "Service updated successfully" });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
   
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const changeServiceStatus = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "");
    if (!Number.isInteger(id) || !validStatuses.has(status)) return res.status(400).json({ success: false, message: "Invalid service ID or status" });

    const connection = await pool.getConnection();
    try {
      const vendorId = await getVendorId(connection, req.vendor.id);
      const [result] = await connection.execute(
        `UPDATE vendor_services SET status = ? WHERE id = ? AND vendor_id = ?`,
        [status, id, vendorId]
      );
      if (!result.affectedRows) return res.status(404).json({ success: false, message: "Service not found" });
      return res.json({ success: true, message: `Service moved to ${status}` });
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendorServices,
  getServiceOptions,
  createVendorService,
  updateVendorService,
  changeServiceStatus,
};
