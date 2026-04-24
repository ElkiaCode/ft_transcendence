"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { apiGetUserByUsername } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";

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

function Section() {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    async function loadUser() {
      if (!currentUser) return;
      const data = await apiGetUserByUsername(username);
      if (!data) setNotFound(true);
      else setUser(data);
    }
    loadUser();
  }, [username]);

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
        {user?.profile?.bio && (
          <p className="text-center max-w-md TextColorS">
            {user.profile.bio}
          </p>
        )}
      </div>
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