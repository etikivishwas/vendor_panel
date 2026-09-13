const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

const normalizeNullableText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
};

const removeUploadedFile = (file) => {
  if (!file || !file.path) {
    return;
  }

  fs.unlink(file.path, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error(
        "Unable to remove uploaded file:",
        error.message
      );
    }
  });
};

const removeOldLocalLogo = (imageUrl) => {
  if (
    !imageUrl ||
    !imageUrl.startsWith("/uploads/vendor-logos/")
  ) {
    return;
  }

  const filename = path.basename(imageUrl);

  const fullPath = path.join(
    process.cwd(),
    "uploads",
    "vendor-logos",
    filename
  );

  fs.unlink(fullPath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error(
        "Unable to remove old logo:",
        error.message
      );
    }
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

    const vendorId = await getAuthenticatedVendorId(
      connection,
      req.vendor.id
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
      [vendorId, req.vendor.id]
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

    const description = normalizeNullableText(
      req.body.description
    );

    if (!businessName) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Business name is required",
      });
    }

    if (businessName.length > 150) {
      removeUploadedFile(req.file);

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
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Please select a valid category",
      });
    }

    if (!phone) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    if (phone.length > 20) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message:
          "Phone number cannot exceed 20 characters",
      });
    }

    if (whatsapp.length > 20) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message:
          "WhatsApp number cannot exceed 20 characters",
      });
    }

    if (!address) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Street address is required",
      });
    }

    if (address.length > 255) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message:
          "Street address cannot exceed 255 characters",
      });
    }

    if (!city) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "City is required",
      });
    }

    if (city.length > 100) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "City cannot exceed 100 characters",
      });
    }

    if (!postalCode) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Postal code is required",
      });
    }

    if (postalCode.length > 20) {
      removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message:
          "Postal code cannot exceed 20 characters",
      });
    }

    if (description && description.length > 255) {
      removeUploadedFile(req.file);

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
      req.vendor.id
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

    const newImageUrl = req.file
      ? `/uploads/vendor-logos/${req.file.filename}`
      : previousImageUrl;

    const [updateResult] = await connection.execute(
      `
        UPDATE vendors
        SET
          name = ?,
          service_type = ?,
          category_id = ?,
          description = ?,
          image_url = ?,
          phone = ?,
          whatsapp = ?,
          address = ?,
          city = ?,
          postal_code = ?
        WHERE id = ?
          AND is_active = 1
      `,
      [
        businessName,
        selectedCategory.name,
        categoryId,
        description,
        newImageUrl,
        phone,
        whatsapp || phone,
        address,
        city,
        postalCode,
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
      [businessName, req.vendor.id]
    );

    await connection.commit();
    transactionStarted = false;

    if (
      req.file &&
      previousImageUrl &&
      previousImageUrl !== newImageUrl
    ) {
      removeOldLocalLogo(previousImageUrl);
    }

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

    removeUploadedFile(req.file);
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