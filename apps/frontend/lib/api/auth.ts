const API_URL = 'http://localhost/api';

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Erreur de connexion');
  }

  return res.json();
}

export async function apiRegister(email: string, username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Erreur lors de l\'inscription');
  }

  return res.json();
}

export async function apiLogout() {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function apiMe() {
  const res = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
  });

  if (!res.ok) return null;

  return res.json();
}