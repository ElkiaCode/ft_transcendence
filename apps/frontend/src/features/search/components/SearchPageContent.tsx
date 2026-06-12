"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  apiSearchUsers,
  addFriendRequest,
  blockUser,
  unblockUser,
} from "@/features/auth/api/auth.api";
import type { SearchUser } from "@/features/chat/types/chat.types";

const USERS_PER_PAGE = 5;

export function SearchPageContent() {
  const params = useSearchParams();
  const query = params.get("query") || "";

  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [menuUser, setMenuUser] = useState<SearchUser | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const router = useRouter();

  // close menu on click outside
  useEffect(() => {
    const close = () => setMenuUser(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (query.length < 2) {
        setUsers([]);
        return;
      }

      setLoading(true);

      try {
        const results = await apiSearchUsers(query);

        const filtered = results
          .filter((u: SearchUser) =>
            u.username.toLowerCase().startsWith(query.toLowerCase()),
          )
          .sort((a: SearchUser, b: SearchUser) =>
            a.username.localeCompare(b.username),
          );

        setPage(0);
        setUsers(filtered);
      } catch (err) {
        console.error(err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [query]);

  const openMenu = (e: React.MouseEvent, user: SearchUser) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuUser(user);
    setMenuPos({
      x: rect.right + 10,
      y: rect.top,
    });
  };

  const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
  const paginated = users.slice(
    page * USERS_PER_PAGE,
    (page + 1) * USERS_PER_PAGE,
  );

  return (
    <div className="h-full overflow-y-auto bg-white text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* HEADER */}
        <div className="border-b border-gray-200 pb-6 mb-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900">
            Results for &quot;{query}&quot;
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Users starting with these letters
          </p>

          <p className="text-xs text-gray-400 mt-2">
            {users.length} result{users.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* LOADING */}
        {loading && (
          <p className="text-sm text-gray-500 text-center">Loading...</p>
        )}

        {/* LIST */}
        {!loading && (
          <div className="flex flex-col gap-2">
            {paginated.map((user) => (
              <div
                key={user.id}
                onClick={(e) => openMenu(e, user)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
              >
                {/* avatar */}
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white overflow-hidden">
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

                {/* username */}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user.username}
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
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-8 h-8 text-sm rounded-full transition cursor-pointer ${
                  i === page
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer"
            >
              ›
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && query.length >= 2 && users.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-6">
            No users found
          </p>
        )}

        {/* TOO SHORT */}
        {query.length < 2 && (
          <p className="text-gray-400 text-sm text-center mt-6">
            Type at least 2 letters to search
          </p>
        )}

        {/* MENU ACTIONS */}
        {menuUser && (
          <div
            className="fixed z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg"
            style={{ top: menuPos.y, left: menuPos.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                router.push(`/profiles/${menuUser.username}`);
                setMenuUser(null);
              }}
              className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              View profile
            </button>

            {!menuUser.isBlockedByCurrentUser &&
              !menuUser.hasBlockedCurrentUser && (
                <button
                  onClick={() => {
                    void addFriendRequest(menuUser.id).catch(console.error);
                    setMenuUser(null);
                  }}
                  className="w-full text-left px-4 py-2 text-green-600 hover:bg-gray-100"
                >
                  Add friend
                </button>
              )}

            {!menuUser.isBlockedByCurrentUser && (
              <button
                onClick={async () => {
                  try {
                    await blockUser(menuUser.id);
                    setUsers((prev) =>
                      prev.map((user) =>
                        user.id === menuUser.id
                          ? { ...user, isBlockedByCurrentUser: true }
                          : user,
                      ),
                    );
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setMenuUser(null);
                  }
                }}
                className="w-full text-left px-4 py-2 text-red-500 hover:bg-gray-100"
              >
                Block user
              </button>
            )}

            {menuUser.isBlockedByCurrentUser && (
              <button
                onClick={async () => {
                  try {
                    await unblockUser(menuUser.id);
                    setUsers((prev) =>
                      prev.map((user) =>
                        user.id === menuUser.id
                          ? { ...user, isBlockedByCurrentUser: false }
                          : user,
                      ),
                    );
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setMenuUser(null);
                  }
                }}
                className="w-full text-left px-4 py-2 text-blue-500 hover:bg-gray-100"
              >
                Unblock user
              </button>
            )}

            {menuUser.hasBlockedCurrentUser && (
              <p className="px-4 py-2 text-xs font-medium text-orange-600">
                This user blocked you
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
