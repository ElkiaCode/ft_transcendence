"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiListReports, apiReviewReport, apiBanUser, apiUnbanUser, apiPromoteToModerator, apiUnpromoteModerator, apiAdjustPenaltyPoints } from "@/lib/api/admin";
import { apiGetUserByUsername, apiSearchUsers } from "@/lib/api/auth";
import Link from 'next/link';

type ModerationAction = {
  id: string;
  action: string;
  note?: string | null;
  penaltyPointsChange?: number | null;
  createdAt: string;
  moderator?: { username: string } | null;
};

type Report = {
  id: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  targetType: 'USER' | 'MESSAGE';
  reason: string;
  createdAt: string;
  creator: { username: string; profile: { avatarUrl: string | null } | null } | null;
  targetUser: { id: string; username: string; profile?: { avatarUrl: string | null } | null } | null;
  targetMessage: { id: string; content: string | null; sender: { id: string; username: string } | null } | null;
  actions: ModerationAction[];
};

type ToastType = 'success' | 'error';

interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserAccount {
  id: string;
  email: string;
  username: string;
  globalRole: 'USER' | 'MODERATOR' | 'ADMIN';
  isActive: boolean;
  isBanned: boolean;
  penaltyPoints: number; 
  createdAt?: Date;
  updatedAt: Date;
  profile?: UserProfile | null;
}

// 1. Define the shape of what the API action returns
interface ActionResponse {
  user: Partial<UserAccount>;
  promoted?: boolean;
}

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 cursor-pointer">✕</button>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}

function ConfirmModal({
  title, description, confirmLabel, confirmColor, onConfirm, onClose,
}: {
  title: string; description: string; confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-100 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer text-sm">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-2 rounded-full text-white text-sm cursor-pointer transition ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionHistory({ actions }: { actions: ModerationAction[] }) {
  if (actions.length === 0) return null;

  const actionColors: Record<string, string> = {
    WARN: 'bg-yellow-100 text-yellow-700',
    BAN: 'bg-red-100 text-red-700',
    UNBAN: 'bg-green-100 text-green-700',
    DISMISS_REPORT: 'bg-gray-100 text-gray-500',
    ADJUST_POINTS: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 mt-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Action history</p>
      {actions.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className={`px-2 py-0.5 rounded-full font-medium ${actionColors[a.action] ?? 'bg-gray-100 text-gray-500'}`}>
            {a.action}
          </span>
          {a.moderator && (
            <span className="text-gray-400">by <span className="font-medium text-gray-600">{a.moderator.username}</span></span>
          )}
          {a.penaltyPointsChange !== null && a.penaltyPointsChange !== undefined && a.penaltyPointsChange !== 0 && (
            <span className={`font-medium ${a.penaltyPointsChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {a.penaltyPointsChange > 0 ? `+${a.penaltyPointsChange}` : a.penaltyPointsChange} pts
            </span>
          )}
          {a.note && <span className="italic text-gray-400">&quot;{a.note}&quot;</span>}
          <span className="text-gray-300">{new Date(a.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({
  report, isAdmin, onSubmit, onClose,
}: {
  report: Report;
  isAdmin: boolean;
  onSubmit: (action: string, note: string, points: number) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState("WARN");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);

  const targetDescription = () => {
    if (report.targetType === 'USER') {
      return report.targetUser
        ? `Reported user: ${report.targetUser.username}`
        : 'Reported user: [account deleted]';
    }
    return report.targetMessage
      ? `Message by: ${report.targetMessage.sender?.username ?? '[deleted user]'}`
      : 'Message: [deleted]';
  };

  // Si l'utilisateur cible n'existe plus, les actions qui le nécessitent sont désactivées
  const targetGone =
    (report.targetType === 'USER' && !report.targetUser) ||
    (report.targetType === 'MESSAGE' && !report.targetMessage);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-130 flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Review report</h2>

        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 flex flex-col gap-2">
          <p className="font-medium text-gray-900">{targetDescription()}</p>

          {report.targetType === 'MESSAGE' && (
            report.targetMessage?.content
              ? (
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 italic">
                  "{report.targetMessage.content}"
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 italic">
                  [original message deleted]
                </div>
              )
          )}

          <p className="text-gray-500">
            <span className="font-medium text-gray-700">Reason:</span> {report.reason}
          </p>
          <p className="text-gray-400 text-xs">
            Reported by{' '}
            <span className="font-medium">
              {report.creator?.username ?? '[deleted user]'}
            </span>{' '}
            on {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>

        {targetGone && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
            ⚠️ The targeted account no longer exists (RGPD deletion). Only <strong>Dismiss</strong> is available.
          </div>
        )}

        {report.actions.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <ActionHistory actions={report.actions} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Action</label>
          <div className="flex flex-wrap gap-2">
            {(['WARN', 'BAN', 'UNBAN', 'DISMISS_REPORT'] as const).map((a) => {
              const disabledByDeletion = targetGone && a !== 'DISMISS_REPORT';
              return (
                <button
                  key={a}
                  onClick={() => !disabledByDeletion && setAction(a)}
                  disabled={disabledByDeletion}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    action === a
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {a === 'DISMISS_REPORT' ? 'DISMISS' : a}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isAdmin && !targetGone && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Penalty points to subtract</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              min={0}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(action, note, points)}
            className="px-4 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 cursor-pointer transition text-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  onReview,
  isRecentlyReviewed = false,
}: {
  report: Report;
  onReview: (report: Report) => void;
  isRecentlyReviewed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const isDeleted = (label: string) => (
    <span className="italic text-gray-400">[{label} deleted]</span>
  );

  const targetLabel = () => {
    if (report.targetType === 'USER') {
      return report.targetUser
        ? <> → <span className="font-medium">{report.targetUser.username}</span></>
        : <> → {isDeleted('user')}</>;
    }
    if (report.targetType === 'MESSAGE') {
      return report.targetMessage
        ? <> → message by <span className="font-medium">{report.targetMessage.sender?.username ?? '[deleted]'}</span></>
        : <> → {isDeleted('message')}</>;
    }
    return null;
  };

  return (
    <div className={`bg-white border rounded-xl p-4 flex flex-col gap-3 shadow-sm transition-colors duration-700 ${
      isRecentlyReviewed ? 'border-green-300 bg-green-50' : 'border-gray-100'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            report.status === 'OPEN'
              ? 'bg-yellow-100 text-yellow-700'
              : report.status === 'RESOLVED'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {report.status}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            report.targetType === 'USER' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
          }`}>
            {report.targetType}
          </span>
          {isRecentlyReviewed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
              ✓ Reviewed
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {new Date(report.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="text-sm text-gray-700">
        <span className="font-medium">By:</span>{' '}
        {report.creator?.username ?? <span className="italic text-gray-400">[deleted user]</span>}
        {targetLabel()}
      </div>

      <p className="text-sm text-gray-500 italic">{report.reason}</p>

      {report.targetType === 'MESSAGE' && (
        report.targetMessage?.content
          ? (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 italic">
              "{report.targetMessage.content.length > 120
                ? report.targetMessage.content.slice(0, 120) + '…'
                : report.targetMessage.content}"
            </div>
          ) : report.targetMessage === null ? (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 italic">
              [original message deleted]
            </div>
          ) : null
      )}

      {report.actions.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="self-start text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
        >
          {expanded ? '▲ Hide history' : `▼ Show history (${report.actions.length})`}
        </button>
      )}
      {expanded && <ActionHistory actions={report.actions} />}

      {report.status === 'OPEN' && (
        <button
          onClick={() => onReview(report)}
          className="self-end px-3 py-1 rounded-full bg-blue-500 text-white text-xs hover:bg-blue-600 cursor-pointer transition"
        >
          Review
        </button>
      )}
    </div>
  );
}

const REPORTS_PER_PAGE = 10;

function ReportsTab({ isAdmin, showToast }: { isAdmin: boolean; showToast: (msg: string, type: ToastType) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState<Report | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'DISMISSED'>('OPEN');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'USER' | 'MESSAGE'>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [recentlyReviewed, setRecentlyReviewed] = useState<Set<string>>(new Set());
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    apiListReports()
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleReview = async (action: string, note: string, points: number) => {
    if (!reviewModal) return;
    try {
      await apiReviewReport(reviewModal.id, action as 'WARN' | 'BAN' | 'UNBAN' | 'DISMISS_REPORT', note || undefined, points || undefined);

      const newAction: ModerationAction = {
        id: crypto.randomUUID(),
        action,
        note: note || null,
        penaltyPointsChange: points ? -points : null,
        createdAt: new Date().toISOString(),
        moderator: currentUser ? { username: currentUser.username } : null,
      };

      const reviewedId = reviewModal.id;

      setReports((prev) =>
        prev.map((r) =>
          r.id === reviewedId
            ? {
                ...r,
                status: action === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED',
                actions: [...r.actions, newAction],
              }
            : r
        )
      );

      setRecentlyReviewed((prev) => new Set(prev).add(reviewedId));
      setTimeout(() => {
        setRecentlyReviewed((prev) => {
          const next = new Set(prev);
          next.delete(reviewedId);
          return next;
        });
      }, 3000);

      setReviewModal(null);
      showToast('Report reviewed successfully', 'success');
    } catch {
      showToast('Failed to review report', 'error');
    }
  };

  const openCount = reports.filter(r => r.status === 'OPEN').length;

  const filtered = reports
    .filter((r) => {
      if (recentlyReviewed.has(r.id)) return true;
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (typeFilter !== 'ALL' && r.targetType !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? -diff : diff;
    });

  const totalPages = Math.ceil(filtered.length / REPORTS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * REPORTS_PER_PAGE, page * REPORTS_PER_PAGE);

  const handleFilterChange = (f: 'ALL' | 'OPEN' | 'RESOLVED' | 'DISMISSED') => {
    setFilter(f);
    setPage(1);
  };

  const handleTypeChange = (t: 'ALL' | 'USER' | 'MESSAGE') => {
    setTypeFilter(t);
    setPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Cast to the specific union type instead of 'any'
    const value = e.target.value as 'newest' | 'oldest';
    setSortOrder(value);
    setPage(1);
  };

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      {reviewModal && (
        <ReviewModal
          report={reviewModal}
          isAdmin={isAdmin}
          onSubmit={handleReview}
          onClose={() => setReviewModal(null)}
        />
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {(['ALL', 'OPEN', 'RESOLVED', 'DISMISSED'] as const).map((f) => (
              <button
                key={f}
                // Use the new handler here
                onClick={() => handleFilterChange(f)}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer flex items-center gap-1 ${
                  filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
                {f === 'OPEN' && openCount > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    filter === 'OPEN' ? 'bg-white text-blue-500' : 'bg-blue-500 text-white'
                  }`}>
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-1 border-l border-gray-200 pl-2">
            {(['ALL', 'USER', 'MESSAGE'] as const).map((t) => (
              <button
                key={t}
                // Use the new handler here
                onClick={() => handleTypeChange(t)}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                  typeFilter === t ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <select
          value={sortOrder}
          // Use the new handler here and remove 'any'
          onChange={handleSortChange}
          className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 focus:outline-none cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
    </div>
  );
}

function UsersTab({ showToast }: { showToast: (msg: string, type: ToastType) => void }) {
  const [username, setUsername] = useState("");
  const [suggestions, setSuggestions] = useState<UserAccount[]>([]);
  const [result, setResult] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{
    title: string; description: string; confirmLabel: string;
    confirmColor: string; onConfirm: () => void;
  } | null>(null);
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
    setUsername(value);

    // Clear suggestions immediately if the input is too short
    if (value.trim().length < 2) {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    // If too short, do nothing (suggestions were already cleared by the handler)
    if (username.trim().length < 2) return;

    const fetchSuggestions = async () => {
      try {
        const data = await apiSearchUsers(username);
        setSuggestions(data);
      } catch (err) {
        console.error(err);
      }
    };

    // Optional: Add a debounce here to avoid spamming the API
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSelectUser = async (u: UserAccount) => {
    setUsername(u.username);
    setSuggestions([]);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await apiGetUserByUsername(u.username);
      if (!data) throw new Error('User not found');
      setResult(data);
    } catch (err) {
      // Check if err is actually an Error object
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
  action: () => Promise<ActionResponse>, // Replace any
  successMsg: string,
  promotedMsg?: string
) => {
  try {
    const res = await action();
    
    // Typing 'prev' based on UserAccount type
    setResult((prev: UserAccount | null) => {
      if (!prev) return null;
      return { ...prev, ...res.user };
    });

    if (promotedMsg && res.promoted) {
      showToast(promotedMsg, 'success');
    } else {
      showToast(successMsg, 'success');
    }
  } catch (err) {
    // Handle the error type here too
    const msg = err instanceof Error ? err.message : 'Action failed';
    showToast(msg, 'error');
  }
};

  const penaltyColor = (pts: number) => {
    if (pts >= 100) return 'text-green-600';
    if (pts <= -100) return 'text-red-600';
    return 'text-gray-700';
  };

  const onUnban = () => {
    // 1. Guard: If result is null, stop here. 
    // This tells TypeScript that 'result' is definitely NOT null below this line.
    if (!result) return;

    handleAction(
      async () => {
        const u = await apiUnbanUser(result.id);
        return { user: u }; // Wrap to match the ActionResponse interface
      },
      `${result.username} has been unbanned`
    );
  };
  return (
    <div className="flex flex-col gap-4">
      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSuggestions([]);
          }
        }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by username (min. 2 characters)..."
              value={username}
              onChange={handleUsernameChange}
              onKeyDown={(e) => { if (e.key === 'Escape') setSuggestions([]); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>
            )}
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((u) => (
              <button
                key={u.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectUser(u)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                  {u.profile?.avatarUrl ? (
                    <img 
                      src={u.profile.avatarUrl} 
                      alt={`${u.username}'s avatar`} // Fixes the ESLint alt-text error
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    u.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{u.username}</span>
                  {u.profile?.displayName && u.profile.displayName !== u.username && (
                    <span className="text-xs text-gray-400">{u.profile.displayName}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        {username.trim().length >= 2 && !searching && suggestions.length === 0 && !result && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
            <p className="text-sm text-gray-400">No users found for &quot;{username}&quot;</p>
          </div>
        )}
      </div>
      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
              {result.profile?.avatarUrl ? (
                <img 
                  src={result.profile.avatarUrl} 
                  alt={`${result.username}'s avatar`} // Fixes the ESLint alt-text error
                  className="w-full h-full object-cover" 
                />
              ) : (
                result.username.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-gray-900">{result.username}</p>
              {result.profile?.displayName && result.profile.displayName !== result.username && (
                <p className="text-xs text-gray-400">{result.profile.displayName}</p>
              )}
              <p className="text-xs text-gray-400">{result.globalRole}</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                result.isBanned ? 'bg-red-100 text-red-600' :
                result.isActive ? 'bg-green-100 text-green-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {result.isBanned ? 'Banned' : result.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 font-medium">Penalty points</span>
            <span className={`text-sm font-bold ml-auto ${penaltyColor(result.penaltyPoints ?? 0)}`}>
              {result.penaltyPoints ?? 0} pts
            </span>
            {(result.penaltyPoints ?? 0) <= -400 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                ⚠ Ban imminent at -500
              </span>
            )}
          </div>

          {result.profile?.bio && (
            <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">{result.profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            {!result.isBanned ? (
              <button
                onClick={() => setConfirmModal({
                  title: 'Ban user',
                  description: `Are you sure you want to ban ${result.username}? He will no longer be able to access the platform.`,
                  confirmLabel: 'Ban',
                  confirmColor: 'bg-red-500 hover:bg-red-600',
                  onConfirm: () => {
                    if (!result) return; // Guard against null
                    
                    handleAction(
                      // Wrap the return value so it has a .user property
                      () => apiBanUser(result.id).then(u => ({ user: u })), 
                      `${result.username} has been banned`
                    );
                  }
                })}
                className="px-3 py-1 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 cursor-pointer transition"
              >
                Ban
              </button>
            ) : (
              <button
                onClick={onUnban}
                
                className="px-3 py-1 rounded-full bg-green-500 text-white text-xs hover:bg-green-600 cursor-pointer transition"
              >
                Unban
              </button>
            )}
            {result.globalRole === 'USER' && (
              <button
                onClick={() => setConfirmModal({
                  title: 'Promote to Moderator',
                  description: `Give ${result.username} moderator privileges?`,
                  confirmLabel: 'Promote',
                  confirmColor: 'bg-blue-500 hover:bg-blue-600',
                  onConfirm: () => handleAction(
                    () => apiPromoteToModerator(result.id),
                    `${result.username} is now a moderator`
                  ),
                })}
                className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs hover:bg-blue-600 cursor-pointer transition"
              >
                Promote to Moderator
              </button>
            )}
            {result.globalRole === 'MODERATOR' && (
              <button
                onClick={() => setConfirmModal({
                  title: 'Unpromote moderator',
                  description: `Remove moderator privileges from ${result.username}?`,
                  confirmLabel: 'Unpromote',
                  confirmColor: 'bg-gray-500 hover:bg-gray-600',
                  onConfirm: () => handleAction(
                    () => apiUnpromoteModerator(result.id),
                    `${result.username} is back to user`
                  ),
                })}
                className="px-3 py-1 rounded-full bg-gray-500 text-white text-xs hover:bg-gray-600 cursor-pointer transition"
              >
                Unpromote to User
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-700">Adjust penalty points</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                placeholder="Points (+ or -)"
                className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleAction(
                  () => apiAdjustPenaltyPoints(result.id, points, note || undefined),
                  'Penalty points updated',
                  `${result.username} has been automatically promoted to moderator!`
                )}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs hover:bg-gray-700 cursor-pointer transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.globalRole === 'ADMIN';
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const { toast, showToast, hideToast } = useToast();

  const tabs = [
    { key: 'reports', label: 'Reports', visible: true },
    { key: 'users', label: 'Users', visible: isAdmin },
  ] as const;

  return (
    <div className="min-h-screen bg-white">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'Admin Dashboard' : 'Moderator Dashboard'}
          </h1>
          <Link href="/profils" className="text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer">
            ← Back
          </Link>
        </div>
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {tabs.filter((t) => t.visible).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition cursor-pointer ${
                tab === t.key ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div>
          {tab === 'reports' && <ReportsTab isAdmin={isAdmin} showToast={showToast} />}
          {tab === 'users' && isAdmin && <UsersTab showToast={showToast} />}
        </div>
      </div>
    </div>
  );
}