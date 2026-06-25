"use client";

import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { apiGetUserByUsername, apiSearchUsers, apiSearchUsersAdmin } from "@/lib/api/auth";
import {
  apiAdjustPenaltyPoints,
  apiBanUser,
  apiPromoteToModerator,
  apiUnbanUser,
  apiUnpromoteModerator,
} from "@/features/admin/api/admin.api";
import type {
  ActionResponse,
  ToastType,
  UserAccount,
} from "@/features/admin/types/admin.types";

type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
};

function penaltyColor(points: number) {
  if (points >= 100) return "text-green-600";
  if (points <= -100) return "text-red-600";
  return "text-gray-700";
}

export function UsersTab({
  showToast,
}: {
  showToast: (message: string, type: ToastType) => void;
}) {
  const [username, setUsername] = useState("");
  const [suggestions, setSuggestions] = useState<UserAccount[]>([]);
  const [result, setResult] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (username.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiSearchUsersAdmin(username.trim());
        console.log("data", data);
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [username]);

  const handleSelectUser = async (user: UserAccount) => {
    setUsername(user.username);
    setSuggestions([]);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await apiGetUserByUsername(user.username);
      if (!data) throw new Error("User not found");
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

const handleAction = async (action: () => Promise<any>, successMsg: string, promotedMsg?: string) => {
  if (!result) return;
  const username = result.username;
  try {
    const res = await action();

    const fresh = await apiGetUserByUsername(username);
    if (fresh) setResult(fresh);

    if (promotedMsg && res.promoted) {
      showToast(promotedMsg, 'success');
    } else {
      showToast(successMsg, 'success');
    }
  } catch (err: any) {
    showToast(err.message, 'error');
  }
};

  return (
    <div className="flex flex-col gap-4">
      {confirmModal && (
        <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />
      )}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setSuggestions([]);
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by username (min. 2 characters)..."
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (result) setResult(null);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSuggestions([]);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                ...
              </span>
            )}
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((user) => (
              <button
                key={user.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectUser(user)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                  {user.profile?.avatarUrl ? (
                    <img
                      src={user.profile.avatarUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {user.username}
                  </span>
                  {user.profile?.displayName &&
                    user.profile.displayName !== user.username && (
                      <span className="text-xs text-gray-400">
                        {user.profile.displayName}
                      </span>
                    )}
                </div>
              </button>
            ))}
          </div>
        )}
        {username.trim().length >= 2 &&
          !searching &&
          suggestions.length === 0 &&
          !result && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
              <p className="text-sm text-gray-400">
                No users found for "{username}"
              </p>
            </div>
          )}
      </div>
      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
              {result.profile?.avatarUrl ? (
                <img
                  src={result.profile.avatarUrl}
                  className="w-full h-full object-cover"
                />
              ) : (
                result.username?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-gray-900">{result.username}</p>
              {result.profile?.displayName &&
                result.profile.displayName !== result.username && (
                  <p className="text-xs text-gray-400">
                    {result.profile.displayName}
                  </p>
                )}
              <p className="text-xs text-gray-400">{result.globalRole}</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1.5">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${result.isBanned ? "bg-red-100 text-red-600" : result.isActive ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}
              >
                {result.isBanned
                  ? "Banned"
                  : result.isActive
                    ? "Active"
                    : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 font-medium">
              Penalty points
            </span>
            <span
              className={`text-sm font-bold ml-auto ${penaltyColor(result.penaltyPoints ?? 0)}`}
            >
              {result.penaltyPoints ?? 0} pts
            </span>
            {(result.penaltyPoints ?? 0) <= -400 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                ⚠ Ban imminent at -500
              </span>
            )}
          </div>
          {result.profile?.bio && (
            <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
              {result.profile.bio}
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            {!result.isBanned ? (
              <button
                onClick={() =>
                  setConfirmModal({
                    title: "Ban user",
                    description: `Are you sure you want to ban ${result.username}? They will no longer be able to access the platform.`,
                    confirmLabel: "Ban",
                    confirmColor: "bg-red-500 hover:bg-red-600",
                    onConfirm: () =>
                      handleAction(
                        () => apiBanUser(result.id).then((user) => ({ user })),
                        `${result.username} has been banned`,
                      ),
                  })
                }
                className="px-3 py-1 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 cursor-pointer transition"
              >
                Ban
              </button>
            ) : (
              <button
                onClick={() =>
                  setConfirmModal({
                    title: "Unban user",
                    description: `Are you sure you want to unban ${result.username}?`,
                    confirmLabel: "Unban",
                    confirmColor: "bg-green-500 hover:bg-green-600",
                    onConfirm: () =>
                      handleAction(
                        () =>
                          apiUnbanUser(result.id).then((user) => ({
                            user,
                          })),
                        `${result.username} has been unbanned`,
                      ),
                  })
                }
                className="px-3 py-1 rounded-full bg-green-500 text-white text-xs hover:bg-green-600 cursor-pointer transition"
              >
                Unban
              </button>
            )}
            {result.globalRole === "USER" && (
              <button
                onClick={() =>
                  setConfirmModal({
                    title: "Promote to Moderator",
                    description: `Give ${result.username} moderator privileges?`,
                    confirmLabel: "Promote",
                    confirmColor: "bg-blue-500 hover:bg-blue-600",
                    onConfirm: () =>
                      handleAction(
                        () => apiPromoteToModerator(result.id),
                        `${result.username} is now a moderator`,
                      ),
                  })
                }
                className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs hover:bg-blue-600 cursor-pointer transition"
              >
                Promote to Moderator
              </button>
            )}
            {result.globalRole === "MODERATOR" && (
              <button
                onClick={() =>
                  setConfirmModal({
                    title: "Unpromote moderator",
                    description: `Remove moderator privileges from ${result.username}?`,
                    confirmLabel: "Unpromote",
                    confirmColor: "bg-gray-500 hover:bg-gray-600",
                    onConfirm: () =>
                      handleAction(
                        () => apiUnpromoteModerator(result.id),
                        `${result.username} is back to user`,
                      ),
                  })
                }
                className="px-3 py-1 rounded-full bg-gray-500 text-white text-xs hover:bg-gray-600 cursor-pointer transition"
              >
                Unpromote to User
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-700">
              Adjust penalty points
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                placeholder="Points (+ or -)"
                className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() =>
                  handleAction(
                    () =>
                      apiAdjustPenaltyPoints(
                        result.id,
                        points,
                        note || undefined,
                      ),
                    "Penalty points updated",
                    `${result.username} has been automatically promoted to moderator!`,
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs hover:bg-gray-700 cursor-pointer transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
