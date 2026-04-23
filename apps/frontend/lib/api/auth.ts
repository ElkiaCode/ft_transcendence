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
  if (!res.ok)
    throw new Error(data.message || 'Error during login');
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
  if (!res.ok)
    throw new Error(data.message || 'Error during registration');
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
    throw new Error(data?.message || 'Error fetching friends list');
  }
  return res.json();
}

export async function apiGetPendingFriendRequests() {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/relationships/requests/incoming`, {
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || 'Error fetching pending friend requests');
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
    throw new Error(data.message || 'Error sending friend request');
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
    throw new Error(data.message || 'Error blocking user');
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
    throw new Error(data.message || 'Error unblocking user');
  }
  return data;
}

export async function acceptFriendRequest(userId: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/relationships/users/${userId}/friend-accept`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.message || 'Error accepting friend request');
  return data;
}

export async function declineFriendRequest(userId: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/relationships/users/${userId}/remove-friend`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.message || 'Error declining friend request');
  return data;
}
export async function apiLoginWith42(code: string) {
  const res = await fetch(`${API_URL}/auth/42/callback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Connection error');
  }

  useAuthStore.getState().setAccessToken(data.accessToken);
  useAuthStore.getState().setUser(data.user);

  return data.user;
}

export async function getUser() {
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'authorization': `Bearer ${useAuthStore.getState().accessToken}`,
      },
    });

    if (!res.ok) {
      console.error("Erreur HTTP:", res.status);
      return null;
    }

    const data = await res.json();
    return data;

  } catch (error) {
    console.error("Erreur fetch:", error);
    return null;
  }
}

export async function apiGetMe() {
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_URL}/users/me`, {
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function apiUpdateProfile(displayName?: string, bio?: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/users/update/profile`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ displayName, bio }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error');
  return data;
}

// TODO: apiUpdatePassword, apiDeleteAccount, etc.

export async function apiUpdateAvatar(avatarFile: File) {
  const token = useAuthStore.getState().accessToken;
  const formData = new FormData();
  formData.append('file', avatarFile);

  const res = await fetch(`${API_URL}/users/update/avatar`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error updating avatar');
  return data;
}

export async function apiGetUserByUsername(username: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/users/${username}`, {
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

export async function apiEraseMyData(currentPassword: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/users/me/erase-data`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error deleting account');
  return data;
}