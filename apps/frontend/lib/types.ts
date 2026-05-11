export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export type UserProfile = {
  displayName: string;
  bio?: string | null;
  avatarUrl: string | null;
};

export type AppUser = {
  id: string;
  username: string;
  email?: string;
  globalRole?: UserRole;
  penaltyPoints?: number;
  provider?: 'local' | '42';
  profile: UserProfile | null;
};

export type NotificationItem = {
  id: string;
  type?: 'MESSAGE' | 'MODERATION' | 'SYSTEM';
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

export type FriendUser = {
  id: string;
  username?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string | null;
  profile?: UserProfile | null;
};

export type PendingFriendRequest = {
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
};

export type MessageReaction = {
  id?: string;
  userId: string;
  type: 'THUMBS_UP' | 'HEART';
};

export type MessageRead = {
  userId: string;
  readAt?: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    username: string;
    profile?: UserProfile | null;
  };
  content: string | null;
  type?: 'TEXT' | 'SYSTEM';
  isEdited?: boolean;
  deletedAt?: string | null;
  reads?: MessageRead[];
  reactions?: MessageReaction[];
};

export type GroupMember = {
  id?: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | string;
  joinedAt?: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
};

export type TopUser = {
  id: string;
  username: string;
  penaltyPoints: number;
  profile?: Pick<UserProfile, 'displayName' | 'avatarUrl'> | null;
};

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
