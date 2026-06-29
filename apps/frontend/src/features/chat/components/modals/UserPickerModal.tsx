"use client";

import { useState } from "react";
import { apiSearchUsers } from "@/features/auth/api/auth.api";
import type { SearchUser } from "@/features/chat/types/chat.types";

export function UserPickerModal({
  title,
  submitLabel,
  minUsers,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  minUsers: number;
  onSubmit: (userIds: string[]) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await apiSearchUsers(value);
      setSearchResults(
        results.filter(
          (user: SearchUser) =>
            !user.isBanned &&
            !user.isBlockedByCurrentUser &&
            !user.hasBlockedCurrentUser,
        ),
      );
    } catch {
      setSearchResults([]);
    }
  };

  const toggleUser = (user: SearchUser) => {
    setSelectedUsers((prev) =>
      prev.find((item) => item.id === user.id)
        ? prev.filter((item) => item.id !== user.id)
        : [...prev, user],
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto flex flex-col">
            {searchResults.map((user) => {
              const isSelected = selectedUsers.some(
                (item) => item.id === user.id,
              );
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`flex items-center gap-3 p-2 cursor-pointer transition ${isSelected ? "ColorsS" : "hover:bg-gray-100"}`}
                >
                  <div className="w-8 h-8 ColorsS rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                    {user.profile?.avatarUrl ? (
                      <img
                        src={user.profile.avatarUrl}
                        alt={user.username}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm text-gray-900">{user.username}</span>
                  {isSelected && (
                    <span className="ml-auto text-blue-500 text-xs">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1 ColorsS text-blue-800 text-xs px-2 py-1 rounded-full"
              >
                {user.username}
                <button
                  onClick={() => toggleUser(user)}
                  className="hover:text-blue-600 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {minUsers > 1 && (
          <p className="text-xs text-gray-400">
            At least {minUsers} users required
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(selectedUsers.map((user) => user.id))}
            disabled={selectedUsers.length < minUsers}
            className="px-4 py-2 rounded-full ColorsS text-white hover:ColorsS cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateGroupModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (title: string, userIds: string[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await apiSearchUsers(value);
      setSearchResults(
        results.filter(
          (user: SearchUser) =>
            !user.isBanned &&
            !user.isBlockedByCurrentUser &&
            !user.hasBlockedCurrentUser,
        ),
      );
    } catch {
      setSearchResults([]);
    }
  };
  const toggleUser = (user: SearchUser) =>
    setSelectedUsers((prev) =>
      prev.find((item) => item.id === user.id)
        ? prev.filter((item) => item.id !== user.id)
        : [...prev, user],
    );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Create group</h2>
        <input
          type="text"
          placeholder="Group name (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Search users to add..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto flex flex-col">
            {searchResults.map((user) => {
              const isSelected = selectedUsers.some(
                (item) => item.id === user.id,
              );
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`flex items-center gap-3 p-2 cursor-pointer transition ${isSelected ? "ColorsS" : "hover:bg-gray-100"}`}
                >
                  <div className="w-8 h-8 ColorsS rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                    {user.profile?.avatarUrl ? (
                      <img
                        src={user.profile.avatarUrl}
                        alt={user.username}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm text-gray-900">{user.username}</span>
                  {isSelected && (
                    <span className="ml-auto text-blue-500 text-xs">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1 ColorsS text-blue-800 text-xs px-2 py-1 rounded-full"
              >
                {user.username}
                <button
                  onClick={() => toggleUser(user)}
                  className="hover:text-blue-600 cursor-pointer"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">At least 2 users required</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit(
                title,
                selectedUsers.map((user) => user.id),
              )
            }
            disabled={selectedUsers.length < 2}
            className="px-4 py-2 rounded-full bg-green-500 text-white hover:bg-green-600 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
