"use client";

import { useEffect, useState } from "react";
import {
  acceptFriendRequest,
  apiGetMyFriends,
  apiGetPendingFriendRequests,
  declineFriendRequest,
} from "@/features/auth/api/auth.api";
import { useOnlinePresence } from "@/features/presence/hooks/use-online-presence";
import type { AppUser } from "@/features/auth/types/auth.types";
import type {
  FriendUser,
  PendingFriendRequest,
} from "@/features/friends/types/friends.types";
import { errorMessage } from "@/lib/utils/error-message";

export function FriendsMenu({ user }: { user: AppUser | null }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<
    PendingFriendRequest[]
  >([]);
  const { isOnline } = useOnlinePresence();

  const loadFriends = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetMyFriends();
      const pendingReqs = await apiGetPendingFriendRequests();
      setFriends(data);
      setPendingRequests(pendingReqs);
    } catch (err: unknown) {
      setError(errorMessage(err, "Error loading friends"));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (userId: string) => async () => {
    try {
      await acceptFriendRequest(userId);
      await loadFriends();
    } catch (err: unknown) {
      console.error("Error accepting friend request:", err);
    }
  };

  const handleDecline = (userId: string) => async () => {
    try {
      await declineFriendRequest(userId);
      await loadFriends();
    } catch (err: unknown) {
      console.error("Error declining friend request:", err);
    }
  };

  useEffect(() => {
    if (openMenuId !== "friends" || !user) return;
    loadFriends();
  }, [openMenuId, user]);

  return (
    <div className="relative flex items-center gap-4 ml-4">
      {user ? (
        <button
          className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-green-500 transition cursor-pointer"
          onClick={() =>
            setOpenMenuId(openMenuId === "friends" ? null : "friends")
          }
        >
          Friends
        </button>
      ) : null}
      {openMenuId === "friends" && (
        <div className="absolute top-full mt-2 w-128 bg-white border border-gray-200 rounded shadow-lg z-10 left-0 p-2 flex flex-col gap-2 text-sm text-gray-700">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-600">Loading...</div>
          )}
          {error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2 border border-gray-200 rounded">
              <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-200">
                My friends
              </div>
              {!loading && !error && friends.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-600">
                  No friends found.
                </div>
              )}
              {!loading && !error && friends.length > 0 && (
                <div className="max-h-56 overflow-auto">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline(friend.id) ? "bg-green-500" : "bg-gray-300"}`}
                        aria-label={isOnline(friend.id) ? "Online" : "Offline"}
                        title={isOnline(friend.id) ? "Online" : "Offline"}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {friend.displayName ||
                            friend.profile?.displayName ||
                            friend.username ||
                            friend.email}
                        </div>
                        <div
                          className={`text-xs ${isOnline(friend.id) ? "text-green-600" : "text-gray-500"}`}
                        >
                          {isOnline(friend.id) ? "Online" : "Offline"}
                        </div>
                      </div>
                      <div className="relative flex gap-2 ml-auto">
                        <button
                          onClick={handleDecline(friend.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
                        >
                          <img
                            src="/remove.png"
                            alt="42"
                            width={24}
                            height={24}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 border border-gray-200 rounded">
              <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-200">
                Pending requests
              </div>
              {!loading && !error && pendingRequests.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-600">
                  No pending requests.
                </div>
              )}
              {!loading && !error && pendingRequests.length > 0 && (
                <div className="max-h-56 overflow-auto">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.user.id}
                      className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold">
                        {request.user.username[0].toUpperCase()}
                      </div>
                      <div>{request.user.username}</div>
                      <div className="relative ml-auto flex gap-2">
                        <button
                          onClick={handleAccept(request.user.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
                        >
                          <img
                            src="/check.svg"
                            alt="42"
                            width={24}
                            height={24}
                          />
                        </button>
                        <button
                          onClick={handleDecline(request.user.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
                        >
                          <img
                            src="/cancel.svg"
                            alt="42"
                            width={24}
                            height={24}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
