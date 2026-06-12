"use client";

import { useState } from "react";
import { apiLogin } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { errorMessage } from "@/lib/utils/error-message";

export function LoginModal({
  onClose,
  initialError = '',
}: {
  onClose: () => void;
  initialError?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
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
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:8443";
    const redirectUri = `${appUrl}/api/auth/42/callback`;
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
          onChange={e => setEmail(e.target.value)} />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)} />
        <button
          onClick={handleLogin}
          className="mt-4 w-full bg-black text-white p-2 cursor-pointer rounded">login
        </button>
      </div>
    </div>
  );
}