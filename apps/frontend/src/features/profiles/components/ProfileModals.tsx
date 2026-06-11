"use client";

import { useState } from "react";
import {
  apiUpdatePassword,
  apiUpdateProfile,
} from "@/features/auth/api/auth.api";
import type { AppUser } from "@/features/auth/types/auth.types";
import { errorMessage } from "@/lib/utils/error-message";

export function EditProfileModal({
  user,
  onClose,
  onSave,
}: {
  user: AppUser | null;
  onClose: () => void;
  onSave: (user: AppUser) => void;
}) {
  const [displayName, setDisplayName] = useState(
    user?.profile?.displayName ?? "",
  );
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    try {
      const updated = await apiUpdateProfile(displayName, bio);
      onSave(updated);
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, "Error saving profile"));
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl text-black font-bold mb-4">Edit profile</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <input
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <textarea
          className="border text-black w-full p-2 mt-2 rounded"
          placeholder="Bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
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

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [isHidden1, setIsHidden1] = useState(true);
  const [isHidden2, setIsHidden2] = useState(true);
  const [isHidden3, setIsHidden3] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    try {
      await apiUpdatePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err: unknown) {
      setError(errorMessage(err, "Error updating password"));
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl text-black font-bold mb-4">Change password</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {success && (
          <p className="text-green-500 text-sm mb-2">
            Password updated successfully!
          </p>
        )}

        <div className="relative">
          <input
            className="border text-black w-full p-2 mt-2 rounded pr-10"
            placeholder="Current password"
            type={isHidden1 ? "password" : "text"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <button
            onClick={() => setIsHidden1((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-black"
          >
            {isHidden1 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>

        <div className="relative">
          <input
            className="border text-black w-full p-2 mt-2 rounded pr-10"
            placeholder="New password"
            type={isHidden2 ? "password" : "text"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            onClick={() => setIsHidden2((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-black"
          >
            {isHidden2 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>

        <div className="relative">
          <input
            className="border text-black w-full p-2 mt-2 rounded pr-10"
            placeholder="Confirm new password"
            type={isHidden3 ? "password" : "text"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            onClick={() => setIsHidden3((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-black"
          >
            {isHidden3 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        </div>

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
