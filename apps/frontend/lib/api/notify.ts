import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = 'https://localhost/api';

export async function apiNotify() {
  const res = await fetchWithAuth(`${API_URL}/notifications`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to receive notification");
  return data;
}

export async function apiNotifyAsRead(notificationId: string) {
  const res = await fetchWithAuth(`${API_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error("Failed to mark notification as read");
}

export async function apiNotifyAllAsRead() {

  const res = await fetchWithAuth(`${API_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error("Failed to mark all notifications as read");
}
