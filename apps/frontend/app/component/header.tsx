"use client";

import { acceptFriendRequest, apiGetMyFriends, apiGetPendingFriendRequests, apiLogin, apiLogout, apiRegister, declineFriendRequest } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "../globals.css";
import { apiNotify, apiNotifyAsRead, apiNotifyAllAsRead } from "@/lib/api/notify";
import { useOnlinePresence } from "@/lib/hooks/use-online-presence";
import { getChatSocket } from "@/lib/socket/chat-socket";
import type { AppUser, FriendUser, NotificationItem, PendingFriendRequest } from "@/lib/types";
import { errorMessage } from "@/lib/types";

function Notify() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const unreadCount = notifications.filter((notif) => !notif.isRead).length;

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiNotify();
      setNotifications(data);
    } catch (err: unknown) {
      console.error(err);
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (openMenuId !== 'N' || !user) return;
    queueMicrotask(() => {
      loadNotifications();
    });
  }, [loadNotifications, openMenuId, user]);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      loadNotifications();
    });
  }, [loadNotifications, user]);

  useEffect(() => {
    if (!user || !accessToken) return;

    const socket = getChatSocket(accessToken);
    if (!socket) return;

    const handleNotificationCreated = (notification: NotificationItem) => {
      setNotifications((prev) => {
        // 1. Prevent duplicates
        if (prev.some((item) => item.id === notification.id)) return prev;
        // 2. Creates notification
        return [notification, ...prev].slice(0, 100);
      });
    };

    socket.on('notification.created', handleNotificationCreated);

    return () => {
      socket.off('notification.created', handleNotificationCreated);
    };
  }, [accessToken, user]);

  const handleMarkAsRead = (notificationId: string) => async () => {
    try {
      await apiNotifyAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiNotifyAllAsRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
    } catch (err: unknown) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) queueMicrotask(() => setNotifications([]));
  }, [user]);

  return (
    <div className="relative flex items-center gap-4 ml-4">
      {user ? (
        <button
          className="relative bg-green-500 text-white px-6 py-2 rounded-full hover:bg-pink-500 transition cursor-pointer"
          onClick={() => setOpenMenuId(openMenuId === 'N' ? null : 'N')}>
          <img src="/notif.png" alt="42" width={24} height={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      ) : null}
      {openMenuId === 'N' && (
        <div className="absolute top-full mt-2 w-80 bg-white border border-gray-200 rounded shadow-lg z-10 right-0 p-2 flex flex-col gap-2 text-sm text-gray-700">
          <div className="max-h-60 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-600">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 text-sm border-b ${
                    notif.isRead ? "text-gray-500" : "text-black cursor-pointer font-bold"
                  }`}
                  onClick={handleMarkAsRead(notif.id)}
                >
                  <div>{notif.title}</div>
                  {notif.body && (
                    <div className="text-xs text-gray-500 break-words">{notif.body}</div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                    {notif.type && <span>{notif.type.toLowerCase()}</span>}
                    {notif.createdAt && (
                      <span>{new Date(notif.createdAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
            <button
              onClick={handleMarkAllAsRead}
              className="text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              Read all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FriendInterface({ user }: { user: AppUser | null }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const { isOnline } = useOnlinePresence();

  const handleAccept = (userId: string) => async () => {
    try {
      await acceptFriendRequest(userId);
      await loadFriends();
    } catch (err: unknown) {
      console.error('Error accepting friend request:', err);
    }
  };
  const handleDecline = (userId: string) => async () => {
    try {
      await declineFriendRequest(userId);
      await loadFriends();
    } catch (err: unknown) {
      console.error('Error declining friend request:', err);
    }
  };
  const loadFriends = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetMyFriends();
      const pendingReqs = await apiGetPendingFriendRequests();
      setFriends(data);
      setPendingRequests(pendingReqs);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error loading friends'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (openMenuId !== 'friends' || !user) return;
    loadFriends();
  }, [openMenuId, user]);

  return (
    <div className="relative flex items-center gap-4 ml-4">
      {user ? (
        <button
          className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-green-500 transition cursor-pointer"
          onClick={() => setOpenMenuId(openMenuId === 'friends' ? null : 'friends')}>
          Friends
        </button>
      ) : null}
      {openMenuId === 'friends' && (
        <div className="absolute top-full mt-2 w-128 bg-white border border-gray-200 rounded shadow-lg z-10 left-0 p-2 flex flex-col gap-2 text-sm text-gray-700">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-600">Loading...</div>
          )}
          {error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2 border border-gray-200 rounded">
              <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-200">My friends</div>
              {!loading && !error && friends.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-600">No friends found.</div>
              )}
              {!loading && !error && friends.length > 0 && (
                <div className="max-h-56 overflow-auto">
                  {friends.map((friend) => (
                    <div key={friend.id} className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline(friend.id) ? "bg-green-500" : "bg-gray-300"}`}
                        aria-label={isOnline(friend.id) ? "Online" : "Offline"}
                        title={isOnline(friend.id) ? "Online" : "Offline"}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {friend.displayName || friend.profile?.displayName || friend.username || friend.email}
                        </div>
                        <div className={`text-xs ${isOnline(friend.id) ? "text-green-600" : "text-gray-500"}`}>
                          {isOnline(friend.id) ? "Online" : "Offline"}
                        </div>
                      </div>
                      <div className="relative flex gap-2 ml-auto">
                        <button
                          onClick={handleDecline(friend.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
                            <img src="/remove.png" alt="42" width={24} height={24} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 border border-gray-200 rounded">
              <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-200">Pending requests</div>
              {!loading && !error && pendingRequests.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-600">No pending requests.</div>
              )}
              {!loading && !error && pendingRequests.length > 0 && (
                <div className="max-h-56 overflow-auto">
                  {pendingRequests.map((user) => (
                    <div key={user.user.id} className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold">
                        {user.user.username[0].toUpperCase()}
                      </div>
                      <div>{user.user.username}</div>
                      <div className="relative ml-auto flex gap-2">
                        <button
                          onClick={handleAccept(user.user.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
                          <img src="/check.svg" alt="42" width={24} height={24} />
                        </button>
                        <button
                          onClick={handleDecline(user.user.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
                          <img src="/cancel.svg" alt="42" width={24} height={24} />
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

function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setUser = useAuthStore((s) => s.setUser);

  const handleLogin = async () => {
    setError('');
    try {
      const user = await apiLogin(email, password);
      setUser(user);
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Login failed'));
    }
  };

  const handleLogin42 = () => {
    const clientId = process.env.NEXT_PUBLIC_42_CLIENT_ID;
    const redirectUri = "https://localhost/api/auth/42/callback";
    window.location.href = `https://api.intra.42.fr/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded w-96" onClick={e => e.stopPropagation()}>
        <h1 className="text-xl text-black font-bold mb-4">Login</h1>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          onClick={handleLogin42}
          className="w-full border border-gray-300 flex items-center justify-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
        >
          <span className="text-black text-sm font-medium">Continue with</span>
          <img src="/42_Logo.png" alt="42" width={24} height={24} />
        </button>
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <input
          className="border text-black w-full p-2"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}/>
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}/>
        <button
          onClick={handleLogin}
          className="mt-4 w-full bg-black text-white p-2 cursor-pointer rounded">login
        </button>
      </div>
    </div>
  );
}

function RegisterModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const [acceptedModeration, setAcceptedModeration] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (password !== confirmPassword) {
      setError('password dismatch');
      return;
    }
    try {
      const user = await apiRegister(username, email, password);
      setUser(user);
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Registration failed'));
    }
  };

return (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
    <div className="bg-white p-6 rounded w-96" onClick={e => e.stopPropagation()}>
      <h1 className="text-xl text-black font-bold mb-4">Register</h1>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <input
        className="border text-black w-full p-2 mt-2"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}/>
      <input
        className="border text-black w-full p-2 mt-2"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}/>
      <input
        className="border text-black w-full p-2 mt-2"
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}/>
      <input
        className="border text-black w-full p-2 mt-2"
        placeholder="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}/>
      <div className="flex items-start gap-2 mt-4">
        <input
          type="checkbox"
          id="terms"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="cursor-pointer mt-0.5"
        />
        <label htmlFor="terms" className="text-sm text-gray-600">
          I agree to the{" "}
          <a href="/terms" target="_blank" className="text-blue-500 hover:underline">
            Terms of Service
          </a>
          {" "}— respectful behaviour only.
        </label>
      </div>

      <div className="flex items-start gap-2 mt-3">
        <input
          type="checkbox"
          id="moderation"
          checked={acceptedModeration}
          onChange={(e) => setAcceptedModeration(e.target.checked)}
          className="cursor-pointer mt-0.5"
        />
        <label htmlFor="moderation" className="text-sm text-gray-600">
          I agree to the{" "}
          <a href="/moderation" target="_blank" className="text-blue-500 underline hover:text-blue-700">
            moderation rules
          </a>
          {" "}of the platform.
        </label>
      </div>
      <button
        onClick={handleRegister}
        disabled={!accepted || !acceptedModeration || !username || !email || !password || !confirmPassword}
        className="mt-4 w-full bg-black text-white p-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Confirm
      </button>
    </div>
  </div>
);
}

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [res, setRes] = useState("");

  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    apiLogout();
    logout();
  };

  return (
    <>
      <header className="bg-gray-200 text-black p-4 flex items-center">
        
        <nav className="flex gap-12 font-bold mx-4">
          <div className="flex flex-col">
            <Link className="text-3xl font-bold" href="/">
              Transcendence
            </Link>
            <div className="flex gap-3 text-sm font-normal text-gray-500">
              <Link className="hover:underline" href="/rgpd">
                Privacy Policy
              </Link>
              <Link className="hover:underline" href="/terms">
                Terms of Service
              </Link>
            </div>
          </div>
          <FriendInterface user={user} />
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <Notify />
          {user ? (
            <div className="flex items-center justify-between bg-white px-4 py-2 rounded-full shadow-md border">
              <Link href="/profils" className="flex items-center gap-3">
                <div className="w-10 h-10 ColorsS rounded-full flex items-center justify-center overflow-hidden">
                  {user?.profile?.avatarUrl ? (
                    <img
                      src={user.profile.avatarUrl}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">
                    {user?.provider === '42' ? 'Connected with 42' : 'Connected'}
                  </span>
                  <span className="text-sm font-bold">{user.username}</span>
                </div>

                <div className="w-2 h-2 ColorsS rounded-full animate-pulse" />
              </Link>
              <div className="w-px h-8 bg-gray-200 mx-4" />
              <button
                onClick={handleLogout}
                className="text-xs text-gray-500 hover:text-red-500 hover:underline transition-colors"
              >
                <Link href="/" className="text-xs text-gray-500 hover:text-red-500 hover:underline transition-colors">
                  logout
                </Link>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setShowLogin(true)}
                className="text-sm cursor-pointer"
              >
                login
              </button>

              <button
                onClick={() => setShowRegister(true)}
                className="text-sm cursor-pointer"
              >
                register
              </button>
            </div>
          )}
        </div>
      </header>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
    </>
  );
}
