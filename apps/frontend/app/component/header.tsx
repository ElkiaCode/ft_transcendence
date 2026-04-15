"use client";

import { apiGetMyFriends, apiLogin, apiLogout, apiRegister } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { handleBuildComplete } from "next/dist/build/adapter/build-complete";
import Link from "next/link";
import { useEffect, useState } from "react";

// Redirection vers 42
// Apres login on est rediriger sur le front en recevant un champs "code"
// On envoie ce code au backend pour obtenir un access token
// Ca permet au back de get les infos du user et de le connecter

function FriendInterface({ user }: { user: any }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (openMenuId !== 'friends' || !user) return;

    const loadFriends = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetMyFriends();
        setFriends(data);
      } catch (err: any) {
        setError(err.message || 'Erreur lors de la récupération des amis');
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [openMenuId, user]);

  return (
    <div className="relative flex items-center gap-4 ml-60">
      <button
        className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-green-500 transition cursor-pointer"
        onClick={() => setOpenMenuId(openMenuId === 'friends' ? null : 'friends')}
      >
        Friends
      </button>

      {openMenuId === 'friends' && (
        <div className="absolute top-full mt-2 w-64 bg-white border border-gray-200 rounded shadow-lg z-10">
          <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-200">
            Mes amis
          </div>

          {loading && (
            <div className="px-4 py-3 text-sm text-gray-600">Chargement...</div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-red-500">{error}</div>
          )}

          {!loading && !error && friends.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-600">Aucun ami trouvé.</div>
          )}

          {!loading && !error && friends.length > 0 && (
            <div className="max-h-56 overflow-auto">
              {friends.map((friend) => (
                <div key={friend.id} className="px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
                  {friend.username || friend.profile?.displayName || friend.email}
                </div>
              ))}
            </div>
          )}
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
