"use client";

import { useState } from "react";
import Link from "next/link";
import { apiConfirmDataErasure } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { resetChatSocket } from "@/features/chat/socket/chat-socket";
import { errorMessage } from "@/lib/utils/error-message";

type ConfirmationState = "ready" | "loading" | "deleted" | "error";

export function ConfirmDataErasureContent({ token }: { token: string }) {
  const user = useAuthStore((store) => store.user);
  const [state, setState] = useState<ConfirmationState>(
    token ? "ready" : "error",
  );
  const [error, setError] = useState(
    token ? null : "The deletion confirmation link is invalid.",
  );
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(true);
  const [password, setPassword] = useState("");
  const requiresPassword = user?.authProviders
    ? user.authProviders.includes("LOCAL")
    : user?.provider !== "42";

  async function confirmDeletion() {
    if (!user || (requiresPassword && !password)) {
      return;
    }

    setState("loading");
    setError(null);

    try {
      const result = await apiConfirmDataErasure(
        token,
        requiresPassword ? password : undefined,
      );
      setConfirmationEmailSent(result.confirmationEmailSent !== false);
      useAuthStore.getState().clear();
      resetChatSocket();
      setState("deleted");
    } catch (caught: unknown) {
      setError(
        errorMessage(
          caught,
          "This deletion confirmation link is invalid or expired.",
        ),
      );
      setState("ready");
    }
  }

  return (
    <div className="min-h-full bg-white dark:bg-zinc-900 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30">
        <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">
          Confirm permanent data deletion
        </h1>

        {state === "ready" && (
          <>
            <p className="mb-6 text-sm leading-relaxed text-red-700 dark:text-red-300">
              This permanently deletes your account and associated personal
              data. This operation cannot be undone.
            </p>
            {!user ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  You must sign in with the account that requested this
                  deletion before you can continue.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Use the login button in the header, then return to this
                  confirmation.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Signed in as <strong>{user.username}</strong>
                </p>

                {requiresPassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === "Enter" && confirmDeletion()
                    }
                    placeholder="Confirm your password"
                    className="w-64 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-800 dark:bg-zinc-900 dark:text-white"
                  />
                )}

                {error && (
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    {error}
                  </p>
                )}

                <div className="flex justify-center gap-3">
                  <button
                    onClick={confirmDeletion}
                    disabled={requiresPassword && !password}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete all my data
                  </button>
                  <Link
                    href="/rgpd"
                    className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200"
                  >
                    Cancel
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {state === "loading" && (
          <p className="text-sm text-red-700 dark:text-red-300">
            Deleting your data...
          </p>
        )}

        {state === "deleted" && (
          <>
            <p className="mb-6 text-sm text-emerald-700 dark:text-emerald-300">
              Your account and personal data have been permanently deleted.
              {confirmationEmailSent
                ? " A final confirmation email has been sent."
                : " The final confirmation email could not be delivered."}
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-black dark:bg-white dark:text-black"
            >
              Return home
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <p className="mb-6 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
            <Link
              href="/rgpd"
              className="inline-block rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-200"
            >
              Return to privacy settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
