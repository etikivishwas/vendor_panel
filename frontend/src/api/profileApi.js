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

  formData.append(
    "phone",
    form.phone
  );

  formData.append(
    "whatsapp",
    form.whatsapp
  );

  formData.append(
    "address",
    form.address
  );

  formData.append(
    "city",
    form.city
  );

  formData.append(
    "postalCode",
    form.postalCode
  );

  formData.append(
    "latitude",
    String(form.latitude)
  );

  formData.append(
    "longitude",
    String(form.longitude)
  );

  formData.append(
    "description",
    form.description
  );

  formData.append(
    "openingTime",
    form.openingTime
  );

  formData.append(
    "closingTime",
    form.closingTime
  );

  formData.append(
    "specialHours",
    JSON.stringify(
      form.specialHours
    )
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

export const reverseGeocodeVendorLocation =
  async ({
    latitude,
    longitude,
  }) => {
    const response = await apiClient.get(
      "/vendor/profile/reverse-geocode",
      {
        params: {
          latitude,
          longitude,
        },
      }
    );

    return response.data;
  };