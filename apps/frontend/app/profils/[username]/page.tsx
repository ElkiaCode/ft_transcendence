"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { apiGetUserByUsername } from "@/lib/api/auth";
import { getEarnedBadges, type GamificationBadge } from "@/lib/gamification";
import { useOnlinePresence } from "@/lib/hooks/use-online-presence";
import { useAuthStore } from "@/store/authStore";
import type { AppUser } from "@/lib/types";

function HelloWorldBackground() {
  const items = useMemo(() =>
    Array.from({ length: 50 }).map((_, i) => ({
      left: `${(i % 8) * 13}%`,
      top: `${Math.floor(i / 8) * 16}%`,
    }))
  , []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute text-xs font-mono whitespace-nowrap TextColorS"
          style={{
            opacity: 0.5,
            left: item.left,
            top: item.top,
          }}
        >
          Hello, World!
        </div>
      ))}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'radial-gradient(ellipse 30% 50% at 50% 30%, black 40%, transparent 100%)',
        }}
      />
    </div>
  );
}

function BadgeGrid({ badges }: { badges: GamificationBadge[] }) {
  return (
    <div className="w-full max-w-2xl">
      <h3 className="text-center font-bold mb-3 TextColorS text-lg">Badges</h3>
      {badges.length === 0 ? (
        <div className="rounded-lg border-4 BorderColorS bg-white px-4 py-5 text-center">
          <p className="text-sm font-medium text-black">No badges yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`min-h-24 border-2 rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm ${badge.accentClass}`}
            >
              <div className="w-12 h-12 rounded-full bg-white/80 border border-current flex items-center justify-center text-sm font-black flex-shrink-0">
                {badge.mark}
              </div>
              <div className="min-w-0 text-left">
                <div className="font-bold text-sm">{badge.name}</div>
                <div className="text-xs opacity-80">{badge.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section() {
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

  if (!currentUser) {
    return (
      <section className="flex-1 flex items-center justify-center relative z-10">
        <p className="text-white text-xl">You must be logged in to view this profile.</p>
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="flex-1 flex items-center justify-center relative z-10">
        <p className="text-white text-xl">User not found</p>
      </section>
    );
  }

  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12 relative z-10">

      {/* AVATAR */}
      <div
        className="relative w-48 h-48 ColorsS rounded-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: user?.profile?.avatarUrl ? 'white' : undefined }}
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

      {/* NAME + BIO */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-bold text-white">
          {user?.profile?.displayName ?? user?.username ?? "..."}
        </h2>
        <p className="text-sm TextColorS">@{user?.username}</p>
        {user && (
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className={`w-2.5 h-2.5 rounded-full ${profileIsOnline ? "bg-green-400" : "bg-gray-400"}`} />
            <span>{profileIsOnline ? "Online" : "Offline"}</span>
          </div>
        )}
        {user?.profile?.bio && (
          <p className="text-center max-w-md TextColorS">
            {user.profile.bio}
          </p>
        )}
      </div>
      <BadgeGrid badges={earnedBadges} />
    </section>
  );
}

export default function ProfilePage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <HelloWorldBackground />
      <Section />
    </main>
  );
}
