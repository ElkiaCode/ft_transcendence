"use client";

import { useEffect, useState } from "react";
import { getUser, apiUpdateProfile, apiUpdateAvatar} from "@/lib/api/auth";

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

function Section() {
  const [user, setUser] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const userData = await getUser();
      if (userData) setUser(userData);
    }
    loadUser();
  }, []);

  // TODO: handler file (just log pour l’instant)
  const handleAvatarChange = (file: File | undefined) => {
    if (!file) return;
    console.log("Selected avatar:", file);
  };

  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12">

      {/* 🟢 AVATAR + CHANGE BUTTON */}
      <div className="relative w-48 h-48 bg-blue-500 rounded-full overflow-hidden flex items-center justify-center group">

        {/* input file caché */}
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

        {/* overlay change */}
        <label
          htmlFor="avatarInput"
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
        >
          <span className="text-white font-semibold">
            Change
          </span>
        </label>
      </div>

      {/* NAME + BIO */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl text-black font-bold">
          {user?.profile?.displayName ?? user?.username ?? "..."}
        </h2>
        {user?.profile?.bio && (
          <p className="text-gray-500 text-center max-w-md">
            {user.profile.bio}
          </p>
        )}
      </div>

      {/* BUTTON EDIT */}
      <div className="flex gap-4">
        <button
          onClick={() => setShowEdit(true)}
          className="bg-black text-white px-6 py-2 rounded hover:text-gray-300 cursor-pointer"
        >
          Edit profile
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
    <main className="min-h-screen bg-gray-100 flex flex-col">
      <Section />
    </main>
  );
}