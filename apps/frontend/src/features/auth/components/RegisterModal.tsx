"use client";

import { useState } from "react";
import { apiRegister } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { errorMessage } from "@/lib/utils/error-message";

export function RegisterModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [acceptedModeration, setAcceptedModeration] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  const handleRegister = async () => {
    setError("");
    if (password !== confirmPassword) {
      setError("password dismatch");
      return;
    }
    try {
      const user = await apiRegister(username, email, password);
      setUser(user);
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, "Registration failed"));
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="text-xl text-black font-bold mb-4">Register</h1>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="border text-black w-full p-2 mt-2"
          placeholder="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
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
            <a
              href="/terms"
              target="_blank"
              className="text-blue-500 hover:underline"
            >
              Terms of Service
            </a>{" "}
            — respectful behaviour only.
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
            <a
              href="/moderation"
              target="_blank"
              className="text-blue-500 underline hover:text-blue-700"
            >
              moderation rules
            </a>{" "}
            of the platform.
          </label>
        </div>
        <button
          onClick={handleRegister}
          disabled={
            !accepted ||
            !acceptedModeration ||
            !username ||
            !email ||
            !password ||
            !confirmPassword
          }
          className="mt-4 w-full bg-black text-white p-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
