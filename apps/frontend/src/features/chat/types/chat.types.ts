import type { UserProfile } from "@/features/auth/types/auth.types";

export type SearchUser = {
  id: string;
  username: string;
  isBanned?: boolean;
  isBlockedByCurrentUser: boolean;
  hasBlockedCurrentUser: boolean;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

export type Conversation = {
  id: string;
  type: "dm" | "group";
  name: string;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  unreadCount?: number;
};

export type ReactionType = "THUMBS_UP" | "HEART";

export const reactionIcons: Record<ReactionType, string> = {
  THUMBS_UP: "/reaction-thumbs-up.svg",
  HEART: "/reaction-heart.svg",
};

export type MessageReaction = {
  id?: string;
  userId: string;
  type: ReactionType;
  createdAt?: string;
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
  type?: "TEXT" | "SYSTEM";
  isEdited?: boolean;
  createdAt: string;
  deletedAt?: string | null;
  reads?: MessageRead[];
  reactions?: MessageReaction[];
};

export type GroupMember = {
  id?: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | string;
  joinedAt: string;
  leftAt?: string | null;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string | null;
  };
};
