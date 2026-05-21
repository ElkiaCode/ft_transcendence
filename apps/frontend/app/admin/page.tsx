"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiListReports, apiReviewReport, apiBanUser, apiUnbanUser, apiPromoteToModerator, apiUnpromoteModerator, apiAdjustPenaltyPoints } from "@/lib/api/admin";
import { apiGetUserByUsername } from "@/lib/api/auth";

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
  creator: { username: string; profile: { avatarUrl: string | null } | null };
  targetUser: { id: string; username: string; profile?: { avatarUrl: string | null } | null } | null;
  targetMessage: { id: string; content: string | null; sender: { id: string; username: string } } | null;
  actions: ModerationAction[];
};

type ToastType = 'success' | 'error';

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
      <div className="bg-white rounded-xl p-6 w-[400px] flex flex-col gap-4 shadow-xl">
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
          {a.note && <span className="italic text-gray-400">"{a.note}"</span>}
          <span className="text-gray-300">{new Date(a.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({
  report, isAdmin, onSubmit, onClose,
}: {
  report: Report; isAdmin: boolean;
  onSubmit: (action: string, note: string, points: number) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState("WARN");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-[520px] flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Review report</h2>
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 flex flex-col gap-2">
          <p className="font-medium text-gray-900">
            {report.targetType === 'USER'
              ? `Reported user: ${report.targetUser?.username}`
              : `Message by: ${report.targetMessage?.sender.username}`}
          </p>
          {report.targetType === 'MESSAGE' && report.targetMessage?.content && (
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 italic">
              "{report.targetMessage.content}"
            </div>
          )}
          <p className="text-gray-500">
            <span className="font-medium text-gray-700">Reason:</span> {report.reason}
          </p>
          <p className="text-gray-400 text-xs">
            Reported by <span className="font-medium">{report.creator.username}</span> on {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        {report.actions.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <ActionHistory actions={report.actions} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="WARN">Warn</option>
            {isAdmin && <option value="BAN">Ban</option>}
            <option value="UNBAN">Unban</option>
            <option value="DISMISS_REPORT">Dismiss</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-gray-300 rounded-lg p-3 text-sm text-black resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Penalty points to subtract</label>
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">Cancel</button>
          <button onClick={() => onSubmit(action, note, points)} className="px-4 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 cursor-pointer transition">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  onReview,
  isRecentlyReviewed,
}: {
  report: Report;
  onReview: (r: Report) => void;
  isRecentlyReviewed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
      {isRecentlyReviewed && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs text-green-700 font-medium">
          <span>✓</span>
          <span>Treaty — will disappear in a moment</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            report.status === 'OPEN' ? 'bg-yellow-100 text-yellow-700' :
            report.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {report.status}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            report.targetType === 'USER' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
          }`}>
            {report.targetType}
          </span>
        </div>
        <span className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="text-sm text-gray-700">
        <span className="font-medium">By:</span> {report.creator?.username ?? "Unknown"}
        {report.targetType === 'USER' && report.targetUser && (
          <> → <span className="font-medium">{report.targetUser.username}</span></>
        )}
        {report.targetType === 'MESSAGE' && report.targetMessage && (
          <> → message by <span className="font-medium">{report.targetMessage.sender.username}</span></>
        )}
      </div>
      <p className="text-sm text-gray-500 italic">{report.reason}</p>
      {report.targetType === 'MESSAGE' && report.targetMessage?.content && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 italic">
          "{report.targetMessage.content.length > 120
            ? report.targetMessage.content.slice(0, 120) + '…'
            : report.targetMessage.content}"
        </div>
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
      await apiReviewReport(reviewModal.id, action as any, note || undefined, points || undefined);

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

  useEffect(() => { setPage(1); }, [filter, typeFilter, sortOrder]);

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
                onClick={() => setFilter(f)}
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
                onClick={() => setTypeFilter(t)}
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
          onChange={(e) => setSortOrder(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 focus:outline-none cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} report{filtered.length !== 1 ? 's' : ''} found</p>

      {paginated.length === 0 ? (
        <p className="text-sm text-gray-500">No reports found.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {paginated.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onReview={setReviewModal}
                isRecentlyReviewed={recentlyReviewed.has(report.id)}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition cursor-pointer ${
                    page === p ? 'bg-blue-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UsersTab({ showToast }: { showToast: (msg: string, type: ToastType) => void }) {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{
    title: string; description: string; confirmLabel: string;
    confirmColor: string; onConfirm: () => void;
  } | null>(null);

  const handleSearch = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiGetUserByUsername(username.trim());
      if (!data) throw new Error('User not found');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: () => Promise<any>, successMsg: string, promotedMsg?: string) => {
    try {
      const res = await action();
      setResult((prev: any) => ({ ...prev, ...res.user }));
      if (promotedMsg && res.promoted) {
        showToast(promotedMsg, 'success');
      } else {
        showToast(successMsg, 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const penaltyColor = (pts: number) => {
    if (pts >= 100) return 'text-green-600';
    if (pts <= -100) return 'text-red-600';
    return 'text-gray-700';
  };

  return (
    <div className="flex flex-col gap-4">
      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleSearch} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 cursor-pointer transition">
          Search
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Searching...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
              {result.profile?.avatarUrl
                ? <img src={result.profile.avatarUrl} className="w-full h-full object-cover" />
                : result.username?.charAt(0).toUpperCase()}
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
                ⚠ Ban imminent à -500
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
                  description: `Are you sure you want to ban ${result.username}? They will no longer be able to access the platform.`,
                  confirmLabel: 'Ban',
                  confirmColor: 'bg-red-500 hover:bg-red-600',
                  onConfirm: () => handleAction(() => apiBanUser(result.id), `${result.username} has been banned`),
                })}
                className="px-3 py-1 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 cursor-pointer transition"
              >
                Ban
              </button>
            ) : (
              <button
                onClick={() => handleAction(() => apiUnbanUser(result.id), `${result.username} has been unbanned`)}
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
                  `${result.username} a été promu modérateur automatiquement !`
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
          <a href="/profils" className="text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer">
            ← Back
          </a>
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