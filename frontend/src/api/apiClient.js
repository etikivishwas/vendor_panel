import axios from "axios";

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api",

  timeout: 15000,

  headers: {
    Accept: "application/json",
  },
});

const getVendorToken = () => {
  const storedToken =
    localStorage.getItem(
      "vendorToken"
    );

  if (!storedToken) {
    return null;
  }

  return storedToken
    .replace(/^Bearer\s+/i, "")
    .trim();
};

apiClient.interceptors.request.use(
  (config) => {
    const token = getVendorToken();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    const status =
      error.response?.status;

    const code =
      error.response?.data?.code;

    if (status === 401) {
      localStorage.removeItem(
        "vendorToken"
      );

      localStorage.removeItem(
        "vendor"
      );

      /*
        Avoid redirecting repeatedly if the
        current page is already the login page.
      */
      if (
        window.location.pathname !==
        "/login"
      ) {
        const message =
          error.response?.data?.message ||
          "Your vendor session has expired. Please log in again.";

        sessionStorage.setItem(
          "vendorLoginMessage",
          message
        );

        window.location.replace(
          "/login"
        );
      }
    }

    if (
      status === 403 &&
      code === "VENDOR_ROLE_REQUIRED"
    ) {
      localStorage.removeItem(
        "vendorToken"
      );

      localStorage.removeItem(
        "vendor"
      );

      window.location.replace(
        "/login"
      );
    }

    return Promise.reject(error);
  }
);

export default apiClient;