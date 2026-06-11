export type UserRole = "USER" | "MODERATOR" | "ADMIN";

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
  provider?: "local" | "42";
  profile: UserProfile | null;
};
