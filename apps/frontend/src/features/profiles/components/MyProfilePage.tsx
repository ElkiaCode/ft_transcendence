"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiGetMe,
  apiGetMyPoints,
  apiGetTopUsers,
  apiUpdateAvatar,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type { AppUser } from "@/features/auth/types/auth.types";
import type { TopUser } from "@/features/gamification/types/gamification.types";
import { getEarnedBadges } from "@/features/gamification/constants/badges";
import { BadgeGrid } from "@/features/gamification/components/BadgeGrid";
import { useOnlinePresence } from "@/features/presence/hooks/use-online-presence";
import { HelloWorldBackground } from "./ProfileBackground";
import { ChangePasswordModal, EditProfileModal } from "./ProfileModals";
import { Leaderboard } from "./Leaderboard";

function MyProfileSection() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const setStoreUser = useAuthStore((state) => state.setUser);
  const storeUser = useAuthStore((state) => state.user);
  const { isOnline } = useOnlinePresence();
  const profileIsOnline = isOnline(user?.id);
  const profilePoints = points ?? user?.penaltyPoints ?? 0;
  const earnedBadges = getEarnedBadges(profilePoints);

  useEffect(() => {
    async function loadUser() {
      const userData = await apiGetMe();
      if (userData) setUser(userData);
      const pointsData = await apiGetMyPoints();
      if (pointsData) setPoints(pointsData.penaltyPoints);
      const topData = await apiGetTopUsers();
      if (topData) setTopUsers(topData);
    }
    loadUser();
  }, []);

  const handleAvatarChange = async (file?: File) => {
    if (!file) return;
    try {
      await apiUpdateAvatar(file);
      const fresh = await apiGetMe();
      if (fresh) {
        setUser(fresh);
        setStoreUser(fresh);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/profiles/${user?.username}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12 relative z-10">
      {(storeUser?.globalRole === "MODERATOR" ||
        storeUser?.globalRole === "ADMIN") && (
        <div className="w-full flex justify-end self-stretch px-4">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-full bg-gray-800 text-white text-sm hover:bg-gray-700 transition cursor-pointer"
          >
            Dashboard
          </Link>
        </div>
      )}
      {points !== null && (
        <div
          className="absolute top-8 left-4 z-20 w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center shadow-lg"
          style={{ border: "4px solid #00BABC" }}
        >
          <span className="TextColorS text-xl font-bold">{points}</span>
          <span className="TextColorS text-xs font-medium">pts</span>
        </div>
      )}
      <div
        className="relative w-48 h-48 ColorsS rounded-full overflow-hidden flex items-center justify-center group"
        style={{
          backgroundColor: user?.profile?.avatarUrl ? "white" : undefined,
        }}
      >
        <input
          id="avatarInput"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleAvatarChange(e.target.files?.[0])}
        />
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
        <label
          htmlFor="avatarInput"
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
        >
          <span className="text-white font-semibold">Change</span>
        </label>
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-bold text-white">
          {user?.profile?.displayName ?? user?.username ?? "..."}
        </h2>
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
      <div className="flex gap-3">
        <button
          onClick={() => setShowEdit(true)}
          className="border text-white px-6 py-2 rounded cursor-pointer font-bold hover:bg-white/10 transition BorderColorS"
        >
          Edit profile
        </button>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 border text-white px-6 py-2 rounded cursor-pointer transition hover:bg-white/10 BorderColorS"
        >
          {copied ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-green-400 text-sm font-bold">Copied!</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="font-bold">Share profile</span>
            </>
          )}
        </button>
        <button
          onClick={() => setShowPassword(true)}
          className="border text-white px-6 py-2 rounded cursor-pointer font-bold hover:bg-white/10 transition BorderColorS"
        >
          Change password
        </button>
      </div>
      <Leaderboard users={topUsers} />
      {showEdit && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSave={(updated) =>
            setUser(
              (prev) =>
                ({
                  ...prev,
                  profile: {
                    ...prev?.profile,
                    ...(updated.profile ?? updated),
                  },
                }) as AppUser,
            )
          }
        />
      )}
      {showPassword && (
        <ChangePasswordModal onClose={() => setShowPassword(false)} />
      )}
    </section>
  );
}

export function MyProfilePage() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <HelloWorldBackground />
      <MyProfileSection />
    </main>
  );
}
