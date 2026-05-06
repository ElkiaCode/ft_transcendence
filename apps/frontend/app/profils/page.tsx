"use client";

import { apiUpdateProfile, apiUpdateAvatar, apiUpdatePassword, apiGetMyPoints, apiGetTopUsers, apiGetMe } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { useEffect, useState, useMemo , useRef} from "react";
import Link from "next/link";

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

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    try {
      await apiUpdatePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl text-black font-bold mb-4">Change password</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-2">Password updated successfully!</p>}
        <input
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="Current password"
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="New password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
        <button
          onClick={handleSave}
          className="mt-4 w-full bg-black text-white p-2 cursor-pointer rounded hover:opacity-80 transition"
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

function getTrophy(i: number) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return null;
}

function getRankColor(i: number) {
  if (i === 0) return '#FFD700';
  if (i === 1) return '#C0C0C0';
  if (i === 2) return '#CD7F32';
  return '#00BABC';
}

function Section() {
  const [user, setUser] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setStoreUser = useAuthStore((s) => s.setUser);
  const [copied, setCopied] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const users = useAuthStore((state) => state.user);

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
      const updatedUser = await apiUpdateAvatar(file);
      const fresh = await apiGetMe();
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
      {(users?.globalRole === 'MODERATOR' || users?.globalRole === 'ADMIN') && (
        <div className="w-full flex justify-end self-stretch px-4">
          <Link href="/admin" className="px-4 py-2 rounded-full bg-gray-800 text-white text-sm hover:bg-gray-700 transition cursor-pointer">
            Dashboard
          </Link>
        </div>
      )}
      {/* POINTS BADGE */}
      {points !== null && (
        <div className="absolute top-8 left-4 z-20 w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center shadow-lg" style={{ border: '4px solid #00BABC' }}>
          <span className="TextColorS text-xl font-bold">{points}</span>
          <span className="TextColorS text-xs font-medium">pts</span>
        </div>
      )}
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400 text-sm font-bold">Copied!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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

      {/* LEADERBOARD */}
      <div className="w-full max-w-md mt-4">
        <h3 className="text-center font-bold mb-3 TextColorS text-lg">🏆 Top Users</h3>
        <div className="rounded-lg overflow-hidden border-4 BorderColorS bg-white shadow-md">
          {topUsers.length === 0 && (
            <div className="px-4 py-6 text-center ColorsS">
            <p className="text-white font-medium">No users yet</p>
            </div>
         )}
          {topUsers.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              style={{
               backgroundColor: 'white',
               border: '4px solid #00BABC',
              }}
            >
              <span
                className="font-bold w-6 h-6 flex items-center justify-center text-base"
                style={{ color: getRankColor(i) }}
              >
                {getTrophy(i) ?? i + 1}
              </span>
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center ColorsS">
                {u.profile?.avatarUrl ? (
                  <img src={u.profile.avatarUrl} alt={u.username} className="w-full h-full object-cover bg-white" />
                ) : (
                  <span className="text-black text-xs font-bold">{u.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="flex-1 text-sm font-medium" style={{ color: 'black' }}>{u.profile?.displayName ?? u.username}</span>
              <span className="font-bold text-sm" style={{ color: 'black' }}>{u.penaltyPoints} pts</span>
            </div>
          ))}
        </div>
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

      {showPassword && (
        <ChangePasswordModal onClose={() => setShowPassword(false)} />
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
