import type { UserProfile } from "@/features/auth/types/auth.types";

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
