import { io, Socket } from "socket.io-client";
import { apiRefresh } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";

let socket: Socket | null = null;
let isRefreshingSocketToken = false;

import { SOCKET_URL } from "@/lib/config/api";

export function getChatSocket(accessToken: string | null): Socket | null {
  if (!accessToken) return null;
  if (!socket) {
    socket = io(`${SOCKET_URL}/chat`, {
      auth: {
        token: accessToken,
      },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socket.on("connect_error", async () => {
      if (isRefreshingSocketToken) return;

      isRefreshingSocketToken = true;
      try {
        const user = await apiRefresh();
        const freshToken = useAuthStore.getState().accessToken;

        if (freshToken && socket) {
          socket.auth = { token: freshToken };
          socket.connect();
        } else {
          useAuthStore.getState().clear();
          resetChatSocket();
        }
      } finally {
        isRefreshingSocketToken = false;
      }
    });
  } else {
    socket.auth = { token: accessToken };
  }
  return socket;
}

export function resetChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
