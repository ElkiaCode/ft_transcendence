import { useAuthStore } from "@/store/authStore";

const API_URL = 'https://localhost/api';

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Erreur de connexion');
  }
  useAuthStore.getState().setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);

  return data.user;
}

export async function apiRegister(username: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Erreur lors de l\'inscription');
  }

  useAuthStore.getState().setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);
  return data.user;
}

export async function apiLogout() {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  useAuthStore.getState().clear();
}

export async function apiRefresh() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) return null;
  const data = await res.json();

  useAuthStore.getState().setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);

  return data.user;
}

export async function apiSearchUsers(query: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });

  if (!res.ok) return [];

  return res.json();
}

export async function apiGetMyFriends() {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/users/friends`, {
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || 'Erreur lors de la récupération des amis');
  }

  return res.json();
}

export async function addFriendRequest(userId: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/relationships/users/${userId}/friend-request`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Erreur lors de l\'envoi de la demande d\'ami');
  }

  return data;
}

export async function blockUser(userId: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/relationships/users/${userId}/block`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Erreur lors du blocage de l\'utilisateur');
  }

  return data;
}

export async function unblockUser(userId: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/relationships/users/${userId}/unblock`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Erreur lors du déblocage de l\'utilisateur');
  }

  return data;
}