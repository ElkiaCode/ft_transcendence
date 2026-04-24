import { useAuthStore } from "@/store/authStore";

const API_URL = 'https://localhost/api';

export async function apiNotify(message: string) {
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