"use client";

import Link from "next/link";
import { useState } from "react";

function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded w-96"
        onClick={e => e.stopPropagation()}
      >
        <h1 className="text-xl text-black font-bold mb-4">Login</h1>
        <input className="border w-full text-black p-2 mt-2" placeholder="Email"/>
        <input className="border w-full text-black p-2 mt-2" placeholder="Mot de passe" type="password"/>
        <button className="mt-4 w-full bg-black text-white p-2">Connexion</button>
      </div>
    </div>
  );
}

function RegisterModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded w-96"
        onClick={e => e.stopPropagation()}
      >
        <h1 className="text-xl text-black font-bold mb-4">Register</h1>
        <input className="border text-black w-full p-2 mt-2" placeholder="Nom d'utilisateur"/>
        <input className="border text-black w-full p-2 mt-2" placeholder="Email"/>
        <input className="border text-black w-full p-2 mt-2" placeholder="Mot de passe" type="password"/>
        <input className="border text-black w-full p-2 mt-2" placeholder="Confirmer le mot de passe" type="password"/>
        <button className="mt-4 w-full bg-black text-white p-2">Créer un compte</button>
      </div>
    </div>
  );
}

export default function Header() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  return (
    <>
      <header className="bg-gray-200 text-black p-4 flex items-center">
        <h1 className="text-3xl font-bold">Transcendence</h1>
        <nav className="flex gap-12 font-bold mx-auto">
          <Link className="hover:text-gray-500 text-2xl" href="/">Accueil</Link>
          <button
            className="hover:text-gray-500 text-2xl cursor-pointer"
            onClick={() => setShowLogin(true)}>login
          </button>
          <button
            className="hover:text-gray-500 text-2xl cursor-pointer"
            onClick={() => setShowRegister(true)}>register
          </button>
        </nav>
        <div className="w-12 h-12 bg-blue-500 rounded-full pointer-events-none"/>
      </header>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)}/>}
    </>
  );
}