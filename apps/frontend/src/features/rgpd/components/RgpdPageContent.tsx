"use client";
import { useState } from "react";
import {
  apiExportMyData,
  apiRequestDataErasure,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { errorMessage } from "@/lib/utils/error-message";

type Step = "idle" | "password" | "confirm" | "email-sent";
type ExportStep = "idle" | "confirm" | "downloaded";

export function RgpdPageContent() {
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportStep, setExportStep] = useState<ExportStep>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const requiresPassword = user?.authProviders
    ? user.authProviders.includes("LOCAL")
    : user?.provider !== "42";

  function downloadReadableJson(data: unknown) {
    const prettyJson = JSON.stringify(data, null, 2);
    const blob = new Blob([prettyJson], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const safeUsername = (user?.username ?? "user").replace(
      /[^a-z0-9_-]/gi,
      "_",
    );
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");

    link.href = url;
    link.download = `transcendence-data-${safeUsername}-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExportData() {
    setExportLoading(true);
    setExportError(null);
    try {
      const data = await apiExportMyData();
      downloadReadableJson(data);
      setExportStep("downloaded");
    } catch (e: unknown) {
      setExportError(errorMessage(e, "Unable to export your data."));
    } finally {
      setExportLoading(false);
    }
  }

  async function handleDeletionRequest() {
    if (requiresPassword && !password) return;
    setLoading(true);
    setError(null);
    try {
      await apiRequestDataErasure(requiresPassword ? password : undefined);
      setStep("email-sent");
      setPassword("");
    } catch (e: unknown) {
      setError(errorMessage(e, "Unable to send the confirmation email."));
      setStep(requiresPassword ? "password" : "confirm");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setStep("idle");
    setPassword("");
    setError(null);
  }

  function handleExportCancel() {
    setExportStep("idle");
    setExportError(null);
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="max-w-3xl mx-auto px-6 py-12 text-center">
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6 mb-8">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated — 2025 &nbsp;·&nbsp;
            <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-0.5 rounded-full">
              GDPR compliant
            </span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            {
              dot: "bg-emerald-500",
              title: "Data collected",
              text: "Username, email, avatar, and 42 OAuth data if applicable.",
            },
            {
              dot: "bg-blue-600",
              title: "Security",
              text: "Passwords are hashed and salted. HTTPS-only connections.",
            },
            {
              dot: "bg-amber-600",
              title: "Retention",
              text: "Data is kept for as long as your account is active.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-4"
            >
              <div className={`w-2 h-2 rounded-full ${c.dot} mx-auto mb-3`} />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {c.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {c.text}
              </p>
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
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              {s.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {s.text}
            </p>
            <hr className="border-gray-100 dark:border-zinc-700 mt-4" />
          </div>
        ))}
        {user && (
          <div className="mt-10 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-6 py-6">
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              Request my data
            </h2>
            <p className="text-sm text-blue-700/80 dark:text-blue-300/80 mb-4">
              Download a readable JSON export containing your account, profile,
              friendships, chat activity, notifications, and moderation records.
            </p>
            {exportError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
                {exportError}
              </p>
            )}

            {exportStep === "idle" && (
              <button
                onClick={() => setExportStep("confirm")}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-6 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Request my data
              </button>
            )}

            {exportStep === "confirm" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  Your data export may include private messages and account
                  details. Download it only on a trusted device.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleExportData}
                    disabled={exportLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {exportLoading ? "Preparing..." : "Download JSON"}
                  </button>
                  <button
                    onClick={handleExportCancel}
                    className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {exportStep === "downloaded" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Your readable JSON export has been downloaded.
                </p>
                <button
                  onClick={() => setExportStep("confirm")}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Download again
                </button>
              </div>
            )}
          </div>
        )}
        {user && (
          <div className="mt-10 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 rounded-xl px-6 py-6">
            <p className="text-sm text-red-600/70 dark:text-red-400/60 mb-4">
              Permanently delete your account and all associated data. This
              operation requires confirmation through a temporary link sent to
              your account email.
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
                {error}
              </p>
            )}

            {step === "idle" && (
              <button
                onClick={() =>
                  setStep(requiresPassword ? "password" : "confirm")
                }
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
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleDeletionRequest()
                  }
                  placeholder="Your password"
                  className="w-64 px-4 py-2 text-sm border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleDeletionRequest}
                    disabled={loading || !password}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {loading ? "Sending..." : "Send confirmation email"}
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
                  A confirmation link will be sent to{" "}
                  {user.email ?? "your email"}. Your data will not be deleted
                  until you use that link.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeletionRequest}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {loading ? "Sending..." : "Send confirmation email"}
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

            {step === "email-sent" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Confirmation email sent. Your account remains active until
                  you confirm permanent deletion from the email.
                </p>
                <button
                  onClick={handleCancel}
                  className="bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
