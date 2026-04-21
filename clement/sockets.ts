/*When your frontend refreshes the access token,
the existing socket still hold the old one. So we need to update it*/

//So after a successfull /api/auth/refresh do this:

const socket = getChatSocket(newAccessToken);
socket.auth.token = newAccessToken;
socket.disconnect().connect();

//Example d'utilisation des socket dans le frontend:
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getChatSocket, resetChatSocket } from '@/lib/socket/chat-socket';

type Message = {
  id: string;
  conversationId: string;
  content: string | null;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    profile?: {
      displayName?: string | null;
      avatarUrl?: string | null;
    } | null;
  };
};

const API_URL = 'https://localhost/api';

async function apiListMessages(conversationId: string, accessToken: string) {
  const res = await fetch(`${API_URL}/chat/conversations/${conversationId}/messages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load messages');
  return data as Message[];
}

export default function ConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const accessToken = useMemo(
    () => window.localStorage.getItem('accessToken') ?? '',
    [],
  );

  useEffect(() => {
    if (!accessToken) return;

    apiListMessages(params.conversationId, accessToken).then(setMessages);

    const socket = getChatSocket(accessToken);

    socket.emit('chat.joinConversation', {
      conversationId: params.conversationId,
    });

    const onMessageCreated = (message: Message) => {
      if (message.conversationId === params.conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.on('chat.message.created', onMessageCreated);

    return () => {
      socket.emit('chat.leaveConversation', {
        conversationId: params.conversationId,
      });
      socket.off('chat.message.created', onMessageCreated);
    };
  }, [params.conversationId, accessToken]);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || !accessToken) return;

    const socket = getChatSocket(accessToken);

    socket.emit('chat.sendMessage', {
      conversationId: params.conversationId,
      content: trimmed,
    });

    setContent('');
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Conversation</h1>

      <div className="mt-4 space-y-2">
        {messages.map((message) => (
          <div key={message.id} className="rounded border p-3">
            <div className="text-sm font-semibold">
              {message.sender.profile?.displayName ?? message.sender.username}
            </div>
            <div>{message.content}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a message..."
        />
        <button className="rounded border px-4 py-2" onClick={handleSend}>
          Send
        </button>
      </div>
    </main>
  );
}

//after socket connect join the personal room
const socket = getChatSocket(accessToken);
socket.emit('user.joinOwnRoom');

//For the rest Notification:
export async function apiListNotifications(accessToken: string) {
  const res = await fetch('https://localhost/api/notifications', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load notifications');
  return data;
}

//listen for live notifications
socket.on('notification.created', (notification) => {
  // push into local state / badge count
});

