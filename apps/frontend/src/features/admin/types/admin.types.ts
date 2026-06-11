export type ModerationAction = {
  id: string;
  action: string;
  note?: string | null;
  penaltyPointsChange?: number | null;
  createdAt: string;
  moderator?: { username: string } | null;
};

export type Report = {
  id: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  targetType: "USER" | "MESSAGE";
  reason: string;
  createdAt: string;
  creator: {
    username: string;
    profile: { avatarUrl: string | null } | null;
  } | null;
  creatorId: null;
  targetUser: {
    id: string;
    username: string;
    profile?: { avatarUrl: string | null } | null;
  } | null;
  targetMessage: {
    id: string;
    content: string | null;
    sender: { id: string; username: string };
  } | null;
  actions: ModerationAction[];
};

export type ToastType = "success" | "error";

export type UserProfile = {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserAccount = {
  id: string;
  email: string;
  username: string;
  globalRole: "USER" | "MODERATOR" | "ADMIN";
  isActive: boolean;
  isBanned: boolean;
  penaltyPoints: number;
  createdAt?: Date;
  updatedAt: Date;
  profile?: UserProfile | null;
};

export type ActionResponse = {
  user: Partial<UserAccount>;
  promoted?: boolean;
};
