import apiClient from "./apiClient";

export const getVendorProfile = async () => {
  const response = await apiClient.get(
    "/vendor/profile"
  );

  return response.data.data;
};

export const updateVendorProfile = async ({
  form,
  logo,
}) => {
  const formData = new FormData();

  formData.append(
    "businessName",
    form.businessName
  );

  formData.append(
    "categoryId",
    form.categoryId
  );

  formData.append("phone", form.phone);

  formData.append(
    "whatsapp",
    form.whatsapp
  );

  formData.append("address", form.address);
  formData.append("city", form.city);

  formData.append(
    "postalCode",
    form.postalCode
  );

  formData.append(
    "description",
    form.description
  );

  if (logo) {
    formData.append("logo", logo);
  }

  const response = await apiClient.put(
    "/vendor/profile",
    formData
  );

  return response.data;
};