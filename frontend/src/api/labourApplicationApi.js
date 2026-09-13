import apiClient from "./apiClient";

export const getLabourApplication = async () => {
  const response = await apiClient.get("/vendor/labour-application");
  return response.data.data;
};

export const saveLabourDraft = async (form) => {
  const response = await apiClient.put(
    "/vendor/labour-application/draft",
    form
  );
  return response.data;
};

export const submitLabourApplication = async (form) => {
  const response = await apiClient.post(
    "/vendor/labour-application/submit",
    form
  );
  return response.data;
};
