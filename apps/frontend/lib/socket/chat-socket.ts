import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getChatSocket(accessToken: string | null): Socket {
  if (!socket) {
    socket = io('https://localhost/chat', {
      auth: {
        token: accessToken,
      },
      withCredentials: true,
    });
  }

  return socket;
}

export function resetChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}