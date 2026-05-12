import { fetchWithAuth } from "./fetchWithAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost/api';

export async function createOrGetDirectConversation(targetUserId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/direct/${targetUserId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error("Failed to create or get direct conversation");

  return res.json();
}


export async function apiGetConversations() {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function apiGetMessages(conversationId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    headers: {
     'content-type': 'application/json',
    },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function apiSendMessage(conversationId: string, content: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to edit message");
  return res.json();
}

export async function apiDeleteMessage(conversationId: string, messageId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error("Failed to delete message");
  return res.json();
}

export async function apiMarkConversationRead(conversationId: string, messageId?: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to react to message");
  }
<<<<<<< HEAD
=======
  return data;
}

export async function apiReportMessage(messageId: string, reason: string) {
  const res = await fetchWithAuth(`${API_URL}/moderation/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetType: 'MESSAGE',
      targetMessageId: messageId,
      reason,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to report message");
  }
  return data;
}

export async function apiCreateGroupConversation(title: string, userIds: string[]) {
  const res = await fetchWithAuth(`${API_URL}/chat/group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: title.trim() || undefined, userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create group');
  return data;
}

export async function apiInviteGroupMembers(conversationId: string, userIds: string[]) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to invite members');
  return data;
}

export async function apiRemoveGroupMember(conversationId: string, userId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/remove-user/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to remove member');
  return data;
}

export async function apiLeaveGroupConversation(conversationId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to leave conversation');
  return data;
}

export async function apiRenameGroupConversation(conversationId: string, title: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/rename`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to rename conversation');
  return data;
}

export async function apiGetGroupMembers(conversationId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/members`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to get members');
>>>>>>> main
  return data;
}

export async function apiReportMessage(conversationId: string, messageId: string, reason: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/messages/${messageId}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  const res = await fetchWithAuth(`${API_URL}/chat/group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: title.trim() || undefined, userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create group');
  return data;
}

export async function apiInviteGroupMembers(conversationId: string, userIds: string[]) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to invite members');
  return data;
}

export async function apiRemoveGroupMember(conversationId: string, userId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/remove-user/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to remove member');
  return data;
}

export async function apiLeaveGroupConversation(conversationId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to leave conversation');
  return data;
}

export async function apiRenameGroupConversation(conversationId: string, title: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversation/${conversationId}/rename`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to rename conversation');
  return data;
}

export async function apiGetGroupMembers(conversationId: string) {
  const res = await fetchWithAuth(`${API_URL}/chat/conversations/${conversationId}/members`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to get members');
  return data;
}