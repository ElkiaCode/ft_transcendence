import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost/api';

export async function apiListReports() {
  const res = await fetchWithAuth(`${API_URL}/moderation/reports`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch reports');
  return data;
}

export async function apiReviewReport(
  reportId: string,
  action: 'WARN' | 'BAN' | 'UNBAN' | 'DISMISS_REPORT',
  note?: string,
  penaltyPointsToSubtract?: number,
) {
  const res = await fetchWithAuth(`${API_URL}/moderation/reports/${reportId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, note, penaltyPointsToSubtract }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to review report');
  return data;
}

export async function apiAdjustPenaltyPoints(userId: string, points: number, note?: string) {
  const res = await fetchWithAuth(`${API_URL}/moderation/users/${userId}/points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to adjust penalty points');
  return data;
}

export async function apiBanUser(userId: string) {
  const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to ban user');
  return data;
}

export async function apiUnbanUser(userId: string) {
  const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}/unban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to unban user');
  return data;
}

export async function apiPromoteToModerator(userId: string) {
  const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to promote user');
  return data;
}

export async function apiUnpromoteModerator(userId: string) {
  const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}/unpromote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to unpromote moderator');
  return data;
}