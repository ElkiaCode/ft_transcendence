"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGetUserByUsername } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type { AppUser } from "@/features/auth/types/auth.types";
import { getEarnedBadges } from "@/features/gamification/constants/badges";
import { BadgeGrid } from "@/features/gamification/components/BadgeGrid";
import { useOnlinePresence } from "@/features/presence/hooks/use-online-presence";
import { HelloWorldBackground } from "./ProfileBackground";

function PublicProfileSection() {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<AppUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const currentUser = useAuthStore((state) => state.user);
  const { isOnline } = useOnlinePresence();
  const profileIsOnline = isOnline(user?.id);
  const earnedBadges = getEarnedBadges(user?.penaltyPoints ?? 0);

  useEffect(() => {
    async function loadUser() {
      if (!currentUser) return;
      const data = await apiGetUserByUsername(username);
      if (!data) setNotFound(true);
      else setUser(data);
    }
    loadUser();
  }, [currentUser, username]);

  if (!currentUser)
    return (
      <section className="flex-1 flex items-center justify-center relative z-10">
        <p className="text-white text-xl">
          You must be logged in to view this profile.
        </p>
      </section>
    );
  if (notFound)
    return (
      <section className="flex-1 flex items-center justify-center relative z-10">
        <p className="text-white text-xl">User not found</p>
      </section>
    );

  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12 relative z-10">
      <div
        className="relative w-48 h-48 ColorsS rounded-full overflow-hidden flex items-center justify-center"
        style={{
          backgroundColor: user?.profile?.avatarUrl ? "white" : undefined,
        }}
      >
        {user?.profile?.avatarUrl ? (
          <img
            src={user.profile.avatarUrl}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white text-6xl font-bold">
            {user?.username?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-bold text-white">
          {user?.profile?.displayName ?? user?.username ?? "..."}
        </h2>
        <p className="text-sm TextColorS">@{user?.username}</p>
        {user && (
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span
              className={`w-2.5 h-2.5 rounded-full ${profileIsOnline ? "bg-green-400" : "bg-gray-400"}`}
            />
            <span>{profileIsOnline ? "Online" : "Offline"}</span>
          </div>
        )}
        {user?.profile?.bio && (
          <p className="text-center max-w-md TextColorS">{user.profile.bio}</p>
        )}
      </div>
      <BadgeGrid badges={earnedBadges} />
    </section>
  );
}

export function PublicProfilePage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <HelloWorldBackground />
      <PublicProfileSection />
    </main>
  );
}
