import apiClient from "./apiClient";

export const getVendorRegistrationCategories = async () => {
  const response = await apiClient.get("/vendor/register-interest/categories");
  return response.data.data;
};

export const submitVendorRegistration = async (form) => {
  const response = await apiClient.post("/vendor/register-interest", form);
  return response.data;
};
