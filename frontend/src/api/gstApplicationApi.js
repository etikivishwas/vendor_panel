import apiClient from "./apiClient";

export const getGstApplication = async () => {
  const response = await apiClient.get("/vendor/gst-application");
  return response.data.data;
};

export const saveGstStep = async (step, form) => {
  const response = await apiClient.put(`/vendor/gst-application/step/${step}`, form);
  return response.data;
};

export const saveGstDraft = async (form, currentStep) => {
  const response = await apiClient.put("/vendor/gst-application/draft", {
    ...form,
    currentStep,
  });
  return response.data;
};

export const submitGstApplication = async (form) => {
  const response = await apiClient.post("/vendor/gst-application/submit", form);
  return response.data;
};
