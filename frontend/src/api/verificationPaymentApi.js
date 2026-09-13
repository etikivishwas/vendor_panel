import apiClient from "./apiClient";

export const getVerificationPayment = async (token) => {
  const response = await apiClient.get(
    `/vendor/verification-payment/${token}`
  );
  return response.data.data;
};

export const saveVerificationPaymentPreference = async (
  token,
  paymentMethod,
  upiId
) => {
  const response = await apiClient.patch(
    `/vendor/verification-payment/${token}`,
    { paymentMethod, upiId }
  );
  return response.data;
};
