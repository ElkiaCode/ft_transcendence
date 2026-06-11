import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import { API_URL } from "@/lib/config/api";

export async function apiNotify() {
  const res = await fetchWithAuth(`${API_URL}/notifications`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to receive notification");
  return data;
}

export async function apiNotifyAsRead(notificationId: string) {
  const res = await fetchWithAuth(
    `${API_URL}/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) throw new Error("Failed to mark notification as read");
}

export async function apiNotifyAllAsRead() {
  const res = await fetchWithAuth(`${API_URL}/notifications/read-all`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Failed to mark all notifications as read");
}

export async function apiNotifyConversationAsRead(conversationId: string) {
  const res = await fetchWithAuth(
    `${API_URL}/notifications/conversations/${conversationId}/read-all`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to mark conversation notifications as read");
  }

  return res.json();
}
