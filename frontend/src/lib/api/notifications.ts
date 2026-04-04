import { request } from "./client";
import type { AppNotification, NotificationsResponse } from "./types";

export async function getNotifications(input?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationsResponse> {
  const params = new URLSearchParams();

  if (input?.limit !== undefined) {
    params.set("limit", String(input.limit));
  }

  if (input?.unreadOnly) {
    params.set("unreadOnly", "true");
  }

  const query = params.toString();

  return request<NotificationsResponse>(`/notifications${query ? `?${query}` : ""}`);
}

export async function markNotificationRead(notificationId: number): Promise<AppNotification> {
  return request<AppNotification>(`/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  return request<{ updatedCount: number }>("/notifications/read-all", {
    method: "POST",
  });
}
