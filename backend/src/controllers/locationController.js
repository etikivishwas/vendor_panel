const axios = require("axios");

const coordinateCache = new Map();
let lastNominatimRequestAt = 0;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const validateCoordinates = (latitude, longitude) => {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const getCity = (address = {}) =>
  address.city ||
  address.town ||
  address.municipality ||
  address.village ||
  address.county ||
  "";

const getStreetAddress = (address = {}, displayName = "") => {
  const firstLine = [
    address.house_number,
    address.road || address.pedestrian || address.residential,
    address.neighbourhood || address.suburb,
  ]
    .filter(Boolean)
    .join(", ");

  if (firstLine) {
    return firstLine.slice(0, 255);
  }

  return String(displayName || "").slice(0, 255);
};

const reverseGeocodeVendorLocation = async (req, res, next) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    if (!validateCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required",
      });
    }

    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const cached = coordinateCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000) {
      return res.status(200).json({
        success: true,
        data: cached.data,
      });
    }

    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < 1100) {
      await sleep(1100 - elapsed);
    }

    lastNominatimRequestAt = Date.now();

    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          format: "jsonv2",
          lat: latitude,
          lon: longitude,
          addressdetails: 1,
          zoom: 18,
        },
        headers: {
          "User-Agent":
            process.env.NOMINATIM_USER_AGENT ||
            "TedoBizzVendorPortal/1.0 (support@example.com)",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        timeout: 10000,
      }
    );

    const result = response.data || {};
    const addressParts = result.address || {};

    const data = {
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7)),
      address: getStreetAddress(addressParts, result.display_name),
      city: getCity(addressParts),
      displayName: result.display_name || "",
    };

    coordinateCache.set(cacheKey, {
      cachedAt: Date.now(),
      data,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error.response?.status) {
      return res.status(502).json({
        success: false,
        message: "The map address service is temporarily unavailable",
      });
    }

    next(error);
  }
};

module.exports = {
  reverseGeocodeVendorLocation,
};
