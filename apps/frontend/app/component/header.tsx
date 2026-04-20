"use client";

import { apiLogin, apiLogout, apiRegister, apiLoginWith42 } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { FetchStrategy } from "next/dist/client/components/segment-cache/types";
import Link from "next/link";
import { useState } from "react";
import "../globals.css";

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
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="mt-4 w-full bg-black text-white p-2 cursor-pointer rounded"
        >
          login
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
          onChange={e => setUsername(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
        <button onClick={handleRegister} className="mt-4 w-full bg-black text-white p-2 cursor-pointer">
          register
        </button>
      </div>
    </div>
  );
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
          <Link className="text-3xl font-bold" href="/">
            Transcendence
          </Link>
        </nav>

        {/* RIGHT SIDE */}
        <div className="ml-auto flex items-center gap-4">

          {user ? (
            <div className="flex items-center justify-between bg-white px-4 py-2 rounded-full shadow-md border">

              {/* LEFT SIDE */}
              <Link href="/profils" className="flex items-center gap-3">

                {/* avatar */}
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

                {/* user info */}
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">
                    {user?.provider === '42' ? 'Connected with 42' : 'Connected'}
                  </span>
                  <span className="text-sm font-bold">{user.username}</span>
                </div>

                {/* status dot */}
                <div className="w-2 h-2 ColorsS rounded-full animate-pulse" />
              </Link>

              {/* vertical separator */}
              <div className="w-px h-8 bg-gray-200 mx-4" />

              {/* RIGHT SIDE */}
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