"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiEraseMyData, apiLogout } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";

type Step = "idle" | "password" | "confirm" | "deleted";

export default function RgpdPage() {
  const router = useRouter();
  const user = useAuthStore((s: any) => s.user);
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

async function handleConfirm() {
  if (!password) return; // 👈 à ajouter
  setLoading(true);
  setError(null);
  try {
    await apiEraseMyData(password);
    await apiLogout();
    setStep("deleted");
    setTimeout(() => router.push("/"), 2000);
  } catch (e: any) {
    setError(e.message || "Wrong password.");
    setStep("password");
  } finally {
    setLoading(false);
  }
}

  function handleCancel() {
    setStep("idle");
    setPassword("");
    setError(null);
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="max-w-3xl mx-auto px-6 py-12 text-center">
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6 mb-8">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated — 2025 &nbsp;·&nbsp;
            <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-0.5 rounded-full">GDPR compliant</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { dot: "bg-emerald-500", title: "Data collected", text: "Username, email, avatar, and 42 OAuth data if applicable." },
            { dot: "bg-blue-600", title: "Security", text: "Passwords are hashed and salted. HTTPS-only connections." },
            { dot: "bg-amber-600", title: "Retention", text: "Data is kept for as long as your account is active." },
          ].map((c) => (
            <div key={c.title} className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
              <div className={`w-2 h-2 rounded-full ${c.dot} mx-auto mb-3`} />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{c.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
        {[
          {
            title: "How we use your data",
            text: "Your data is used solely to provide the application's features: authentication, profile management, friend system, chat, and gameplay. We never sell or share your data with third parties.",
          },
          {
            title: "Cookies",
            text: "We only use session cookies strictly necessary for authentication. No tracking, analytics, or advertising cookies are used.",
          },
          {
            title: "Your rights",
            text: "Under the GDPR, you have the right to access, correct, or permanently delete your personal data at any time. Deletion is immediate and irreversible — your account, profile, match history, and all associated data will be permanently removed.",
          },
          {
            title: "Data transfers",
            text: "Your data is stored on servers located within the European Union and is never transferred to third countries.",
          },
        ].map((s) => (
          <div key={s.title} className="text-left mb-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">{s.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.text}</p>
            <hr className="border-gray-100 dark:border-zinc-700 mt-4" />
          </div>
        ))}
        {user && (
  <div className="mt-10 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 rounded-xl px-6 py-6">
    <p className="text-sm text-red-600/70 dark:text-red-400/60 mb-4">
      Permanently delete your account and all associated data. This action is immediate and cannot be undone.
    </p>
    {error && (
      <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">{error}</p>
    )}

    {step === "idle" && (
      <button
        onClick={() => setStep("password")}
        className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium px-6 py-2 rounded-lg transition-colors cursor-pointer"
      >
        Delete my data
      </button>
    )}

    {step === "password" && (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          Confirm your password to continue
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          placeholder="Your password"
          className="w-64 px-4 py-2 text-sm border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading || !password}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? "Checking..." : "Continue"}
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )}

    {step === "confirm" && (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          Are you sure? This will permanently delete your account.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? "Deleting..." : "Yes, delete everything"}
          </button>
          <button
            onClick={handleCancel}
            className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )}

    {step === "deleted" && (
      <p className="text-sm font-medium text-red-600 dark:text-red-400">
        ✓ Your account has been deleted. Redirecting...
      </p>
    )}

  </div>
)}
      </div>
    </div>
  );
}