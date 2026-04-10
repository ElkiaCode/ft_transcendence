"use client";

import { apiLogin, apiLogout, apiRegister } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { useState } from "react";

function LoginModal({ onClose }: { onClose: () => void }) {
  const handleLogin42 = () => {
    const url = `https://api.intra.42.fr/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
    window.location.href = url;
  };
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
        <button onClick={handleLogin} className="mt-4 w-full bg-black text-white p-2 cursor-pointer">
          Connexion
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
          onChange={  e => setPassword(e.target.value) }
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
  )
}

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const user = useAuthStore((s) => s.user);
  return (
    <>
      <header className="bg-gray-200 text-black p-4 flex items-center">
        <h1 className="text-3xl font-bold">Transcendence</h1>
        <nav className="flex gap-12 font-bold mx-auto">
          <Link className="hover:text-gray-500 text-2xl" href="/">Accueil</Link>
        </nav>
          <div className="flex flex-col gap-2 mr-4">
            {user ? (
              <div className="flex flex-col gap-1 items-end">
                <span className="text-sm font-bold">{user.username}</span>
                <button onClick={apiLogout} className="text-sm text-gray-500 cursor-pointer">logout</button>
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