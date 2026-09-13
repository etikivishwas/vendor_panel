import apiClient from "./apiClient";

export const getApplicationReview = async () => {
  const response = await apiClient.get("/vendor/application-review");
  return response.data.data;
};

export const createVerificationPaymentSession = async () => {
  const response = await apiClient.post(
    "/vendor/application-review/payment-session"
  );
  return response.data;
};
