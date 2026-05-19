"use client";

import { useEffect, useState } from "react";
import { getChatSocket } from "@/lib/socket/chat-socket";
import { useAuthStore } from "@/store/authStore";

type PresenceChangedPayload = {
  userId?: string;
  isOnline?: boolean;
};

type PresenceListPayload = {
  onlineUserIds?: string[];
};

export function useOnlinePresence() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken || !currentUserId) {
      queueMicrotask(() => setOnlineUserIds(new Set()));
      return;
    }

    const socket = getChatSocket(accessToken);
    if (!socket) return;

    const handlePresenceChanged = (payload: PresenceChangedPayload) => {
      const userId = payload.userId;
      if (!userId) return;

      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (payload.isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const syncPresence = () => {
      socket.emit("presence.list", {}, (payload: PresenceListPayload) => {
        setOnlineUserIds(new Set(payload?.onlineUserIds ?? []));
      });
    };

    socket.on("presence.changed", handlePresenceChanged);
    socket.on("connect", syncPresence);
    syncPresence();

    return () => {
      socket.off("presence.changed", handlePresenceChanged);
      socket.off("connect", syncPresence);
    };
  }, [accessToken, currentUserId]);

  const isOnline = (userId?: string | null) => Boolean(userId && onlineUserIds.has(userId));

  return { onlineUserIds, isOnline };
}
