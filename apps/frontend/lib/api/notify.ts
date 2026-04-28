import { useAuthStore } from "@/store/authStore";

const API_URL = 'https://localhost/api';

export async function apiNotify() {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/notifications`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to receive notification");

  return data;
}

export async function apiNotifyAsRead(notificationId: string) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to mark notification as read");
}

export async function apiNotifyAllAsRead() {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to mark all notifications as read");
} 