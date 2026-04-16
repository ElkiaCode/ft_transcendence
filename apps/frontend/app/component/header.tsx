"use client";

import { acceptFriendRequest, apiGetMyFriends, apiGetPendingFriendRequests, apiLogin, apiLogout, apiRegister, declineFriendRequest } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { handleBuildComplete } from "next/dist/build/adapter/build-complete";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import isAuth from "./isAuth";

// Redirection vers 42
// Apres login on est rediriger sur le front en recevant un champs "code"
// On envoie ce code au backend pour obtenir un access token
// Ca permet au back de get les infos du user et de le connecter

function FriendInterface({ user }: { user: any }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const handleAccept = (userId: string) => async () => {
    try {
      await acceptFriendRequest(userId);
      await loadFriends();
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
    }
  };
  const handleDecline = (userId: string) => async () => {
    try {
      await declineFriendRequest(userId);
      await loadFriends();
    } catch (err: any) {
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
    } catch (err: any) {
      setError(err.message || 'Error loading friends');
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
                      {friend.username || friend.profile?.displayName || friend.email}
                      <div className="relative flex gap-2 ml-auto">
                        <button
                          onClick={handleDecline(friend.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
                            <img src="/remove.svg" alt="42" width={24} height={24} />
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
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div className="bg-white p-6 rounded w-96" onClick={e => e.stopPropagation()}>
        <h1 className="text-xl text-black font-bold mb-4">Login</h1>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          onClick={() => window.location.href = 'http://localhost/api/auth/42/callback'}
          className="w-full border border-gray-300 flex items-center justify-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
          <span className="text-black text-sm font-medium">Continue with</span>
          <img src="/42_Logo.svg" alt="42" width={24} height={24} />
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
          placeholder="password"
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
  const setUser = useAuthStore((s) => s.setUser);
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
    } catch (err: any) {
      setError(err.message);
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
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={  e => setPassword(e.target.value) }/>
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}/>
        <button onClick={handleRegister} className="mt-4 w-full bg-black text-white p-2 cursor-pointer">register</button>
      </div>
    </div>
  )
}

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
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
          <Link className="text-3xl font-bold" href="/">Transcendence</Link>
        </nav>
        < FriendInterface user={user} />
          <div className="flex flex-col gap-2 mr-4 ml-auto">
            {user ? (
              <div className="flex flex-col gap-1 items-end">
                <span className="text-sm font-bold">{user.username}</span>
                <button onClick={handleLogout} className="text-sm cursor-pointer">logout</button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <button onClick={() => setShowLogin(true)} className="text-sm cursor-pointer">login</button>
                <button onClick={() => setShowRegister(true)} className="text-sm cursor-pointer">register</button>
              </div>
            )}
          </div>
        <Link className="w-12 h-12 bg-blue-500 rounded-full cursor-pointer" href="/profils"/>
      </header>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)}/>}
    </>
  );
}
