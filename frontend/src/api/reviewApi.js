import apiClient from "./apiClient";

export const getVendorReviews = async () => {
  const response = await apiClient.get(
    "/vendor/reviews"
  );

  return response.data;
};

export const saveVendorReviewReply = async (
  reviewId,
  reply
) => {
  const response = await apiClient.put(
    `/vendor/reviews/${reviewId}/reply`,
    {
      reply,
    }
  );

  return response.data;
};