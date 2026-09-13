import apiClient from "./apiClient";

export const getMsmeApplication = async () => {
  const response = await apiClient.get("/vendor/msme-application");
  return response.data.data;
};

export const saveMsmeDraft = async (form) => {
  const response = await apiClient.put(
    "/vendor/msme-application/draft",
    form
  );
  return response.data;
};

export const submitMsmeApplication = async (form) => {
  const response = await apiClient.post(
    "/vendor/msme-application/submit",
    form
  );
  return response.data;
};
