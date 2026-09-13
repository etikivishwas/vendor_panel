import apiClient from "./apiClient";

export const getVendorNotifications = async (limit = 12) => {
  const response = await apiClient.get(
    `/vendor/notifications?limit=${limit}`
  );
  return response.data.data;
};

export const markVendorNotificationRead = async (notificationId) => {
  const response = await apiClient.patch(
    `/vendor/notifications/${notificationId}/read`
  );
  return response.data;
};

export const markAllVendorNotificationsRead = async () => {
  const response = await apiClient.patch("/vendor/notifications/read-all");
  return response.data;
};
