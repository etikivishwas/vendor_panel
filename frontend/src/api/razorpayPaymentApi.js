import apiClient from "./apiClient";

const post = async (
  path,
  body = {}
) => {
  const response = await apiClient.post(
    path,
    body
  );

  return response.data.data;
};

export const createSubscriptionRazorpayOrder = (
  token
) => {
  return post(
    `/razorpay/subscriptions/${encodeURIComponent(
      token
    )}/order`
  );
};

export const verifySubscriptionRazorpayPayment = (
  token,
  paymentResponse
) => {
  return post(
    `/razorpay/subscriptions/${encodeURIComponent(
      token
    )}/verify`,
    paymentResponse
  );
};

export const createVerificationRazorpayOrder = (
  token
) => {
  return post(
    `/razorpay/verifications/${encodeURIComponent(
      token
    )}/order`
  );
};

export const verifyVerificationRazorpayPayment = (
  token,
  paymentResponse
) => {
  return post(
    `/razorpay/verifications/${encodeURIComponent(
      token
    )}/verify`,
    paymentResponse
  );
};