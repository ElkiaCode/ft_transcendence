"use client";

import { useCallback, useEffect, useState } from "react";
import { getChatSocket } from "@/features/chat/socket/chat-socket";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useNotificationsStore } from "@/features/notifications/stores/notifications.store";
import type { NotificationItem } from "@/features/notifications/types/notification.types";
import { useRouter } from "next/navigation";

export function NotificationsMenu() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);

  const notifications = useNotificationsStore((state) => state.notifications);
  const loadNotifications = useNotificationsStore(
    (state) => state.loadNotifications,
  );
  const addNotification = useNotificationsStore(
    (state) => state.addNotification,
  );
  const markAsRead = useNotificationsStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationsStore((state) => state.markAllAsRead);
  const clearNotifications = useNotificationsStore(
    (state) => state.clearNotifications,
  );

  const router = useRouter();

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const safeLoadNotifications = useCallback(async () => {
    try {
      await loadNotifications();
    } catch (err) {
      console.error(err);
      clearNotifications();
    }
  }, [loadNotifications, clearNotifications]);

  useEffect(() => {
    if (openMenuId !== "N" || !user) return;
    queueMicrotask(() => safeLoadNotifications());
  }, [safeLoadNotifications, openMenuId, user]);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => safeLoadNotifications());
  }, [safeLoadNotifications, user]);

  useEffect(() => {
    if (!user || !accessToken) return;

    const socket = getChatSocket(accessToken);
    if (!socket) return;

    const handleNotificationCreated = (notification: NotificationItem) => {
      addNotification(notification);
    };

    socket.on("notification.created", handleNotificationCreated);

    return () => {
      socket.off("notification.created", handleNotificationCreated);
    };
  }, [accessToken, user, addNotification]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => clearNotifications());
    }
  }, [user, clearNotifications]);

  const handleMarkAsRead = (notificationId: string) => async () => {
    try {
      await markAsRead(notificationId);
      const isConversationNotification = (notif: NotificationItem) =>
        notif.entityType === "CONVERSATION";
      const convNotif = notifications.find(
        (notif) =>
          notif.id === notificationId && isConversationNotification(notif),
      );
      if (convNotif) {
        router.push(`/?conversation=${convNotif.entityId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative flex items-center gap-4 ml-4">
      {user ? (
        <button
          className="relative bg-green-500 text-white px-6 py-2 rounded-full hover:bg-pink-500 transition cursor-pointer"
          onClick={() => setOpenMenuId(openMenuId === "N" ? null : "N")}
          title="Notifications"
        >
          <img src="/notif.png" alt="42" width={24} height={24} />

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      ) : null}

      {openMenuId === "N" && (
        <div className="absolute top-full mt-2 w-80 bg-white border border-gray-200 rounded shadow-lg z-50 right-0 p-2 flex flex-col gap-2 text-sm text-gray-700">
          <div className="max-h-60 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-600">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 text-sm border-b ${
                    notification.isRead
                      ? "text-gray-500"
                      : "text-black cursor-pointer font-bold"
                  }`}
                  onClick={handleMarkAsRead(notification.id)}
                >
                  <div>{notification.title}</div>

                  {notification.body && (
                    <div className="text-xs text-gray-500 break-words">
                      {notification.body}
                    </div>
                  )}

                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                    {notification.type && (
                      <span>{notification.type.toLowerCase()}</span>
                    )}

                    {notification.createdAt && (
                      <span>
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
            <button
              onClick={handleMarkAllAsRead}
              className="text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              Read all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
