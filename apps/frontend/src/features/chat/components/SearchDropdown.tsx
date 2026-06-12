"use client";

import type { SearchUser } from "@/features/chat/types/chat.types";

export function SearchDropdown({
  results,
  onSelectUser,
  onOpenMenu,
}: {
  results: SearchUser[];
  onSelectUser: (user: SearchUser) => void;
  onOpenMenu: (user: SearchUser, x: number, y: number) => void;
}) {
  if (results.length === 0) return null;

  return (
    <div className="absolute z-10 top-16 left-0 w-1/4 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto flex flex-col gap-2">
      {results.map((user) => (
        <div
          key={user.id}
          onClick={() => onSelectUser(user)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
        >
          <div className="w-10 h-10 ColorsS rounded-full shrink-0 overflow-hidden flex items-center justify-center text-white font-medium">
            {user.profile?.avatarUrl ? (
              <img
                src={user.profile.avatarUrl}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">{user.username}</p>
            <p className="text-sm text-gray-700 font-normal">
              {user.profile?.displayName}
            </p>
            {user.isBlockedByCurrentUser && (
              <p className="text-xs font-medium text-red-600">
                You blocked this user
              </p>
            )}
            {user.hasBlockedCurrentUser && (
              <p className="text-xs font-medium text-orange-600">
                This user blocked you
              </p>
            )}
          </div>
          <div className="ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect();
                onOpenMenu(
                  user,
                  Math.min(rect.right, window.innerWidth - 160),
                  Math.min(rect.bottom, window.innerHeight - 150),
                );
              }}
              className="px-2 py-1 text-gray-500 hover:text-gray-700"
            >
              ⋯
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
