
const { pool } = require("../config/db");
const cloudinary = require("../config/cloudinary");

const normalizeNullableText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
};


const MAX_SPECIAL_HOURS = 20;

const DATE_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

const normalizeTime = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, 5);
};

const getLocalTodayValue = () => {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    today.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isRealCalendarDate = (value) => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const parseSpecialHours = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      const error = new Error(
        "Special hours must contain valid JSON"
      );

      error.status = 400;
      throw error;
    }
  }

  if (!Array.isArray(parsedValue)) {
    const error = new Error(
      "Special hours must be an array"
    );

    error.status = 400;
    throw error;
  }

  if (
    parsedValue.length >
    MAX_SPECIAL_HOURS
  ) {
    const error = new Error(
      `A maximum of ${MAX_SPECIAL_HOURS} special-hour entries is allowed`
    );

    error.status = 400;
    throw error;
  }

  const usedDates = new Set();
  const todayValue = getLocalTodayValue();

  return parsedValue.map((entry, index) => {
    const entryNumber = index + 1;

    const date = String(
      entry?.date || ""
    ).trim();

    const label = String(
      entry?.label || ""
    ).trim();

    const isClosed =
      entry?.isClosed === true ||
      entry?.isClosed === "true" ||
      entry?.isClosed === 1 ||
      entry?.isClosed === "1";

    const openingTime = isClosed
      ? ""
      : normalizeTime(
        entry?.openingTime
      );

    const closingTime = isClosed
      ? ""
      : normalizeTime(
        entry?.closingTime
      );

    if (!isRealCalendarDate(date)) {
      const error = new Error(
        `Special-hours entry ${entryNumber} has an invalid date`
      );

      error.status = 400;
      throw error;
    }

    if (date < todayValue) {
      const error = new Error(
        `Special-hours entry ${entryNumber} cannot use a past date`
      );

      error.status = 400;
      throw error;
    }

    if (usedDates.has(date)) {
      const error = new Error(
        `Special hours have already been added for ${date}`
      );

      error.status = 400;
      throw error;
    }

    usedDates.add(date);

    if (label.length > 100) {
      const error = new Error(
        `The event name in special-hours entry ${entryNumber} cannot exceed 100 characters`
      );

      error.status = 400;
      throw error;
    }

    if (!isClosed) {
      if (
        !TIME_PATTERN.test(openingTime) ||
        !TIME_PATTERN.test(closingTime)
      ) {
        const error = new Error(
          `Special-hours entry ${entryNumber} must use valid 24-hour opening and closing times`
        );

        error.status = 400;
        throw error;
      }

      if (openingTime === closingTime) {
        const error = new Error(
          `Opening and closing times cannot be the same in special-hours entry ${entryNumber}`
        );

        error.status = 400;
        throw error;
      }
    }

    return {
      date,
      label,
      isClosed,
      openingTime,
      closingTime,
    };
  });
};


const getAuthenticatedVendorId = async (
  connection,
  vendorAccountId
) => {
  const [accountRows] = await connection.execute(
    `
      SELECT
        id,
        existing_vendor_id
      FROM vendor_panel_accounts
      WHERE id = ?
        AND status = 'active'
      LIMIT 1
    `,
    [vendorAccountId]
  );

  if (!accountRows.length) {
    const error = new Error("Vendor account not found");
    error.status = 404;
    throw error;
  }

  const existingVendorId =
    accountRows[0].existing_vendor_id;

  if (!existingVendorId) {
    const error = new Error(
      "This account is not linked to a vendor record"
    );

    error.status = 409;
    throw error;
  }

  return Number(existingVendorId);
};

const getVendorProfile = async (req, res, next) => {

  let connection;

  try {
    connection = await pool.getConnection();
    console.log("=== PROFILE AUTH ===");
    console.log("req.vendor:", req.vendor);
    console.log("req.vendor.accountId:", req.vendor?.accountId);
    const vendorId = await getAuthenticatedVendorId(
      connection,
      req.vendor.accountId
    );

    const [vendorRows] = await connection.execute(
      `
        SELECT
          v.id,
          v.name,
          v.OWNER_NAME AS owner_name,
          v.service_type,
          v.category_id,
          vc.name AS category_name,
          v.PLAN AS plan_name,
          v.description,
          v.opening_time,
          v.closing_time,
          v.special_hours,
          v.rating,
          v.is_verified,
          v.is_premium,
          v.image_url,
          v.phone,
          v.whatsapp,
          v.address,
          v.city,
          v.postal_code,
          v.latitude,
          v.longitude,
          v.is_active,
          v.created_at,
          v.updated_at,
          vpa.email
        FROM vendors v
        INNER JOIN vendor_panel_accounts vpa
          ON vpa.existing_vendor_id = v.id
        LEFT JOIN vendor_categories vc
          ON vc.id = v.category_id
        WHERE v.id = ?
          AND vpa.id = ?
        LIMIT 1
      `,
      [vendorId, req.vendor.accountId]
    );

    if (!vendorRows.length) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const [categoryRows] = await connection.execute(
      `
        SELECT
          id,
          name,
          icon,
          description
        FROM vendor_categories
        WHERE status = 'active'
        ORDER BY sort_order ASC, name ASC
      `
    );

    const profile = vendorRows[0];

    /*
     * MySQL may return a JSON column either as an already
     * parsed JavaScript value or as a JSON string, depending
     * on the database driver and configuration.
     */
    let specialHours = [];

    if (Array.isArray(profile.special_hours)) {
      specialHours = profile.special_hours;
    } else if (profile.special_hours) {
      try {
        specialHours = JSON.parse(
          profile.special_hours
        );
      } catch (parseError) {
        console.error(
          "Unable to parse vendor special hours:",
          parseError.message
        );

        specialHours = [];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          id: Number(profile.id),
          businessName: profile.name || "",
          ownerName: profile.owner_name || "",
          email: profile.email || "",
          serviceType: profile.service_type || "",
          categoryId: profile.category_id
            ? Number(profile.category_id)
            : null,
          categoryName: profile.category_name || "",
          planName: profile.plan_name || "",
          description: profile.description || "",

          openingTime: normalizeTime(
            profile.opening_time
          ),

          closingTime: normalizeTime(
            profile.closing_time
          ),

          specialHours,

          rating: Number(profile.rating || 0),
          verified: Boolean(profile.is_verified),
          premium: Boolean(profile.is_premium),
          imageUrl: profile.image_url || "",
          phone: profile.phone || "",
          whatsapp: profile.whatsapp || "",
          address: profile.address || "",
          city: profile.city || "",
          postalCode: profile.postal_code || "",
          latitude:
            profile.latitude !== null
              ? Number(profile.latitude)
              : null,
          longitude:
            profile.longitude !== null
              ? Number(profile.longitude)
              : null,
          active: Boolean(profile.is_active),
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },

        categories: categoryRows.map((category) => ({
          id: Number(category.id),
          name: category.name,
          icon: category.icon,
          description: category.description,
        })),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const updateVendorProfile = async (req, res, next) => {
  let connection;
  let transactionStarted = false;
  let previousImageUrl = null;

  try {
    const businessName = String(
      req.body.businessName || ""
    ).trim();

    const categoryId = Number(req.body.categoryId);

    const phone = String(req.body.phone || "").trim();

    const whatsapp = String(
      req.body.whatsapp || ""
    ).trim();

    const address = String(
      req.body.address || ""
    ).trim();

    const city = String(req.body.city || "").trim();

    const postalCode = String(
      req.body.postalCode || ""
    ).trim();

    const latitude = Number(
      req.body.latitude
    );

    const longitude = Number(
      req.body.longitude
    );

    const description = normalizeNullableText(
      req.body.description
    );

    const openingTime = normalizeTime(
      req.body.openingTime
    );

    const closingTime = normalizeTime(
      req.body.closingTime
    );

    let specialHours;

    try {
      specialHours = parseSpecialHours(
        req.body.specialHours
      );
    } catch (validationError) {
      return res.status(
        validationError.status || 400
      ).json({
        success: false,
        message: validationError.message,
      });
    }

    if (
      !TIME_PATTERN.test(openingTime) ||
      !TIME_PATTERN.test(closingTime)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Regular opening and closing times must use valid 24-hour values",
      });
    }

    if (openingTime === closingTime) {
      return res.status(400).json({
        success: false,
        message:
          "Regular opening and closing times cannot be the same",
      });
    }

    if (!businessName) {
      return res.status(400).json({
        success: false,
        message: "Business name is required",
      });
    }

    if (businessName.length > 150) {
      return res.status(400).json({
        success: false,
        message:
          "Business name cannot exceed 150 characters",
      });
    }

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid category",
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    if (phone.length > 20) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number cannot exceed 20 characters",
      });
    }

    if (whatsapp.length > 20) {
      return res.status(400).json({
        success: false,
        message:
          "WhatsApp number cannot exceed 20 characters",
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Street address is required",
      });
    }

    if (address.length > 255) {
      return res.status(400).json({
        success: false,
        message:
          "Street address cannot exceed 255 characters",
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required",
      });
    }

    if (city.length > 100) {
      return res.status(400).json({
        success: false,
        message: "City cannot exceed 100 characters",
      });
    }

    if (!postalCode) {
      return res.status(400).json({
        success: false,
        message: "Postal code is required",
      });
    }

    if (postalCode.length > 20) {
      return res.status(400).json({
        success: false,
        message:
          "Postal code cannot exceed 20 characters",
      });
    }

    if (
      req.body.latitude === undefined ||
      req.body.latitude === null ||
      String(req.body.latitude).trim() === "" ||
      req.body.longitude === undefined ||
      req.body.longitude === null ||
      String(req.body.longitude).trim() === "" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Select a valid business location on the map",
      });
    }

    if (description && description.length > 255) {
      return res.status(400).json({
        success: false,
        message:
          "Business description cannot exceed 255 characters",
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const vendorId = await getAuthenticatedVendorId(
      connection,
      req.vendor.accountId
    );

    const [categoryRows] = await connection.execute(
      `
        SELECT
          id,
          name
        FROM vendor_categories
        WHERE id = ?
          AND status = 'active'
        LIMIT 1
      `,
      [categoryId]
    );

    if (!categoryRows.length) {
      const error = new Error(
        "The selected category is invalid or inactive"
      );

      error.status = 400;
      throw error;
    }

    const selectedCategory = categoryRows[0];

    const [vendorRows] = await connection.execute(
      `
        SELECT
          id,
          image_url
        FROM vendors
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [vendorId]
    );

    if (!vendorRows.length) {
      const error = new Error("Vendor profile not found");
      error.status = 404;
      throw error;
    }

    previousImageUrl = vendorRows[0].image_url || null;

    let newImageUrl = previousImageUrl;

    if (req.file) {
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "milieu/vendor-logos",
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

      newImageUrl = cloudinaryResult.secure_url;
    }

    const [updateResult] =
      await connection.execute(
        `
      UPDATE vendors
      SET
        name = ?,
        category_id = ?,
        service_type = ?,
        image_url = ?,
        description = ?,
        phone = ?,
        whatsapp = ?,
        address = ?,
        city = ?,
        postal_code = ?,
        latitude = ?,
        longitude = ?,
        opening_time = ?,
        closing_time = ?,
        special_hours = ?
      WHERE id = ?
        AND is_active = 1
    `,
        [
          businessName,
          selectedCategory.id,
          categoryId,
          description,
          newImageUrl,
          phone,
          whatsapp || phone,
          address,
          city,
          postalCode,
          latitude,
          longitude,
          openingTime,
          closingTime,
          JSON.stringify(specialHours),
          vendorId,
        ]
      );

    if (!updateResult.affectedRows) {
      const error = new Error(
        "Active vendor profile not found"
      );

      error.status = 404;
      throw error;
    }

    await connection.execute(
      `
        UPDATE vendor_panel_accounts
        SET business_name = ?
        WHERE id = ?
      `,
      [businessName, req.vendor.accountId]
    );

    await connection.commit();
    transactionStarted = false;



    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        profile: {
          id: vendorId,
          businessName,
          categoryId,
          categoryName: selectedCategory.name,
          phone,
          whatsapp: whatsapp || phone,
          address,
          city,
          postalCode,
          description: description || "",
          imageUrl: newImageUrl || "",
          openingTime,
          closingTime,
          specialHours,
        },
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Profile rollback failed:",
          rollbackError.message
        );
      }
    }


    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getVendorProfile,
  updateVendorProfile,
};