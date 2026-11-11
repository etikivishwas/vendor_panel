import apiClient from "./apiClient";

export const requestVendorPasswordReset = async (email) => {
  const response = await apiClient.post("/vendor/password-reset/request", {
    email,
  });
  return response.data;
};

export const validateVendorPasswordResetToken = async (token) => {
  const response = await apiClient.get(
    `/vendor/password-reset/validate?token=${encodeURIComponent(token)}`
  );
  return response.data;
};

export const resetVendorPassword = async (
  token,
  password,
  confirmPassword
) => {
  const response = await apiClient.post("/vendor/password-reset/reset", {
    token,
    password,
    confirmPassword,
  });
  return response.data;
};
