import apiClient from "./apiClient";

export const getSubscriptions = async () => {
  const response = await apiClient.get("/vendor/subscriptions");
  return response.data.data;
};

export const createSubscriptionCheckout = async (planId) => {
  const response = await apiClient.post(
    `/vendor/subscriptions/plans/${planId}/checkout`
  );
  return response.data;
};

export const getSubscriptionCheckout = async (token) => {
  const response = await apiClient.get(
    `/vendor/subscriptions/checkout/${token}`
  );
  return response.data.data;
};

export const updateCheckoutPaymentMethod = async (token, paymentMethod) => {
  const response = await apiClient.patch(
    `/vendor/subscriptions/checkout/${token}/payment-method`,
    { paymentMethod }
  );
  return response.data;
};
