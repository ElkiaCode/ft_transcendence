import { create } from "zustand";
import {
  apiNotify,
  apiNotifyAllAsRead,
  apiNotifyAsRead,
  apiNotifyConversationAsRead,
} from "@/features/notifications/api/notifications.api";
import type { NotificationItem } from "@/features/notifications/types/notification.types";

type NotificationsState = {
  notifications: NotificationItem[];
  activeConversationId: string | null;

  loadNotifications: () => Promise<void>;
  addNotification: (notification: NotificationItem) => void;

  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;

  setActiveConversationId: (conversationId: string | null) => void;
  clearNotifications: () => void;
};

function getNotificationConversationId(notification: NotificationItem) {
  return notification.entityType === "CONVERSATION"
    ? (notification.entityId ?? null)
    : null;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  activeConversationId: null,

  loadNotifications: async () => {
    const data = await apiNotify();
    set({ notifications: data });
  },

  addNotification: (notification) => {
    const activeConversationId = get().activeConversationId;
    const notificationConversationId =
      getNotificationConversationId(notification);

    const shouldMarkAsRead =
      notificationConversationId &&
      notificationConversationId === activeConversationId;

    if (shouldMarkAsRead) {
      void apiNotifyAsRead(notification.id).catch(console.error);
    }

    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) {
        return state;
      }

      return {
        notifications: [
          {
            ...notification,
            isRead: shouldMarkAsRead ? true : notification.isRead,
          },
          ...state.notifications,
        ].slice(0, 100),
      };
    });
  },

  markAsRead: async (notificationId) => {
    await apiNotifyAsRead(notificationId);

    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    }));
  },

  markAllAsRead: async () => {
    await apiNotifyAllAsRead();

    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        isRead: true,
      })),
    }));
  },

  markConversationAsRead: async (conversationId) => {
    await apiNotifyConversationAsRead(conversationId);

    set((state) => ({
      notifications: state.notifications.map((notification) =>
        getNotificationConversationId(notification) === conversationId
          ? { ...notification, isRead: true }
          : notification,
      ),
    }));
  },

  setActiveConversationId: (conversationId) => {
    set({ activeConversationId: conversationId });
  },

  clearNotifications: () => {
    set({
      notifications: [],
      activeConversationId: null,
    });
  },
}));
