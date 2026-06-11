export type NotificationItem = {
  id: string;
  type?: "MESSAGE" | "MODERATION" | "SYSTEM";
  title: string;
  body?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt?: string;
};
