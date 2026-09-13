import apiClient from "./apiClient";

export const getVendorServices = async ({ status = "active", search = "" } = {}) => {
  const response = await apiClient.get("/vendor/services", {
    params: { status, search },
  });
  return response.data.data;
};

export const getServiceOptions = async () => {
  const response = await apiClient.get("/vendor/services/options");
  return response.data.data;
};

const buildFormData = (form, image) => {
  const data = new FormData();
  Object.entries(form).forEach(([key, value]) => data.append(key, value ?? ""));
  if (image) data.append("image", image);
  return data;
};

export const createVendorService = async ({ form, image }) => {
  const response = await apiClient.post(
    "/vendor/services",
    buildFormData(form, image)
  );
  return response.data;
};

export const updateVendorService = async ({ id, form, image }) => {
  const response = await apiClient.put(
    `/vendor/services/${id}`,
    buildFormData(form, image)
  );
  return response.data;
};

export const changeVendorServiceStatus = async (id, status) => {
  const response = await apiClient.patch(`/vendor/services/${id}/status`, { status });
  return response.data;
};
