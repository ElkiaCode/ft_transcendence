"use client";

import { getUser, apiUpdateProfile, apiUpdateAvatar } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState, useMemo } from "react";

function EditModal({ user, onClose, onSave }: { user: any, onClose: () => void, onSave: (u: any) => void }) {
  const [displayName, setDisplayName] = useState(user?.profile?.displayName ?? '');
  const [bio, setBio] = useState(user?.profile?.bio ?? '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    try {
      const updated = await apiUpdateProfile(displayName, bio);
      onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl text-black font-bold mb-4">Edit profile</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <input
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="Display name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
        <textarea
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="Bio"
          rows={4}
          value={bio}
          onChange={e => setBio(e.target.value)}
        />
        <button
          onClick={handleSave}
          className="mt-4 w-full bg-black text-white p-2 cursor-pointer rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}

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
  const [user, setUser] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const setStoreUser = useAuthStore((s) => s.setUser);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const userData = await getUser();
      if (userData) setUser(userData);
    }
    loadUser();
  }, []);

  const handleAvatarChange = async (file?: File) => {
    if (!file) return;
    try {
      const updatedUser = await apiUpdateAvatar(file);
      const fresh = await getUser();
      setUser(fresh);
      setStoreUser(fresh);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/profils/${user?.username}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12 relative z-10">

      {/* AVATAR */}
      <div
        className="relative w-48 h-48 ColorsS rounded-full overflow-hidden flex items-center justify-center group"
        style={{ backgroundColor: user?.profile?.avatarUrl ? 'white' : undefined }}
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

      {/* NAME + BIO */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-bold text-white">
          {user?.profile?.displayName ?? user?.username ?? "..."}
        </h2>
        {user?.profile?.bio && (
          <p className="text-center max-w-md TextColorS">
            {user.profile.bio}
          </p>
        )}
      </div>

      {/* BUTTONS */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowEdit(true)}
          className="text-black px-6 py-2 rounded cursor-pointer font-bold hover:opacity-80 transition ColorsS"
        >
          Edit profile
        </button>

        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 border text-white px-6 py-2 rounded cursor-pointer transition hover:bg-white/10 BorderColorS"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400 text-sm font-medium">Copied!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium">Share profile</span>
            </>
          )}
        </button>
      </div>

      {showEdit && (
        <EditModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSave={(updated) =>
            setUser((prev: any) => ({
              ...prev,
              profile: {
                ...prev.profile,
                ...(updated.profile ?? updated),
              },
            }))
          }
        />
      )}
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      <HelloWorldBackground />
      <Section />
    </main>
  );
}
