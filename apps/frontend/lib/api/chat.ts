import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost/api';

export async function createOrGetDirectConversation(targetUserId: string) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/direct/${targetUserId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to create or get direct conversation");

  return res.json();
}


export async function apiGetConversations() {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch conversations");

  return res.json();
}

export async function apiGetMessages(conversationId: string) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch messages");

  return res.json();
}

export async function apiSendMessage(conversationId: string, content: string) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error("Failed to send message");

  return res.json();
}

export async function apiEditMessage(
  conversationId: string,
  messageId: string,
  content: string,
) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error("Failed to edit message");

  return res.json();
}

export async function apiDeleteMessage(conversationId: string, messageId: string) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to delete message");

  return res.json();
}

export async function apiMarkConversationRead(conversationId: string, messageId?: string) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messageId }),
  });

  if (!res.ok) throw new Error("Failed to mark conversation as read");

  return res.json();
}

export async function apiAddMessageReaction(
  conversationId: string,
  messageId: string,
  type: 'THUMBS_UP' | 'HEART',
) {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Failed to react to message");
  }

  return data;
}

export async function apiReportMessage(conversationId: string, messageId: string, reason: string) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to report message");
  }
  return data;
}

export async function apiCreateGroupConversation(title: string, userIds: string[]) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_URL}/chat/group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: title.trim() || undefined, userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create group');
  return data;
}