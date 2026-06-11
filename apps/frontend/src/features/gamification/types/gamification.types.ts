import type { UserProfile } from "@/features/auth/types/auth.types";

export type GamificationBadge = {
  id: string;
  name: string;
  description: string;
  threshold: number;
  tone: "positive" | "negative";
  accentClass: string;
  mark: string;
};

export type TopUser = {
  id: string;
  username: string;
  penaltyPoints: number;
  profile?: Pick<UserProfile, "displayName" | "avatarUrl"> | null;
};
