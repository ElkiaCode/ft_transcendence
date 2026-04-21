import { useAuthStore } from "@/store/authStore";

const API_URL = 'https://localhost/api';

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