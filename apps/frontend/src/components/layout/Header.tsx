"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { LoginModal } from "@/features/auth/components/LoginModal";
import { RegisterModal } from "@/features/auth/components/RegisterModal";
import { FriendsMenu } from "@/features/friends/components/FriendsMenu";
import { NotificationsMenu } from "@/features/notifications/components/NotificationsMenu";
import { apiLogout } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { MAILPIT_URL } from "@/lib/config/api";
import { Mail } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_missing_code: '42 connection is invalid.',
  oauth_failed: 'Login with 42 failed.',
};

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [res, setRes] = useState("");

  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    apiLogout();
    logout();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (!error) return;

    setLoginError(ERROR_MESSAGES[error] ?? 'Unable to login with 42.');
    setShowLogin(true);

    params.delete('error');
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

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
          <FriendsMenu user={user} />
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <NotificationsMenu />
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
      {showLogin && (
        <LoginModal
          initialError={loginError}
          onClose={() => {
            setShowLogin(false);
            setLoginError('');
          }}
        />
      )}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
    </>
  );
}