"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import {apiListReports, apiReviewReport, apiBanUser, apiUnbanUser, apiPromoteToModerator, apiUnpromoteModerator, apiAdjustPenaltyPoints} from "@/lib/api/admin";
import { apiGetUserByUsername } from "@/lib/api/auth";

type Report = {
  id: string;
  status: string;
  targetType: 'USER' | 'MESSAGE';
  reason: string;
  createdAt: string;
  creator: { username: string; profile: { avatarUrl: string | null } | null };
  targetUser: { id: string; username: string } | null;
  targetMessage: { id: string; content: string | null; sender: { id: string; username: string } } | null;
  actions: any[];
};

function ReviewModal({
  report,
  isAdmin,
  onSubmit,
  onClose,
}: {
  report: Report;
  isAdmin: boolean;
  onSubmit: (action: string, note: string, points: number) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState("WARN");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-[480px] flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Review report</h2>
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <p className="font-medium text-gray-900 mb-1">
            {report.targetType === 'USER'
              ? `User: ${report.targetUser?.username}`
              : `Message by: ${report.targetMessage?.sender.username}`}
          </p>
          <p className="italic">{report.reason}</p>
        </div>
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
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(action, note, points)}
            className="px-4 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 cursor-pointer transition"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ isAdmin }: { isAdmin: boolean }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState<Report | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING');

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
      setReports((prev) =>
        prev.map((r) =>
          r.id === reviewModal.id
            ? { ...r, status: action === 'DISMISS_REPORT' ? 'DISMISSED' : 'RESOLVED' }
            : r
        )
      );
      setReviewModal(null);
    } catch (err) {
      console.error("Failed to review report:", err);
    }
  };

  const filtered = reports.filter((r) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return r.status === 'PENDING';
    if (filter === 'RESOLVED') return r.status === 'RESOLVED';
    if (filter === 'DISMISSED') return r.status === 'DISMISSED';
    return true;
  });

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
      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'RESOLVED', 'DISMISSED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No reports found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((report) => (
            <div key={report.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    report.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    report.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {report.status}
                  </span>
                  <span className="text-xs text-gray-400">{report.targetType}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-gray-700">
                <div className="text-sm text-gray-700">
                    <span className="font-medium">By:</span>{" "}
                    {report.creator?.username ?? "Unknown"}

                    {report.targetType === 'USER' && report.targetUser && (
                        <>
                        {" "}→{" "}
                        <span className="font-medium">
                            {report.targetUser?.username ?? "Unknown"}
                        </span>
                        </>
                    )}
                </div>
                {report.targetType === 'MESSAGE' && report.targetMessage && (
                  <> → message by <span className="font-medium">{report.targetMessage.sender.username}</span></>
                )}
              </div>
              <p className="text-sm text-gray-500 italic">{report.reason}</p>
              {report.status === 'PENDING' && (
                <button
                  onClick={() => setReviewModal(report)}
                  className="self-end px-3 py-1 rounded-full bg-blue-500 text-white text-xs hover:bg-blue-600 cursor-pointer transition"
                >
                  Review
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [points, setPoints] = useState(0);

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

  const handleAction = async (action: () => Promise<any>) => {
    try {
      const res = await action();
      setResult((prev: any) => ({ ...prev, ...res.user }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 cursor-pointer transition"
        >
          Search
        </button>
      </div>
      {loading && <p className="text-sm text-gray-500">Searching...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
              {result.profile?.avatarUrl ? (
                <img src={result.profile.avatarUrl} className="w-full h-full object-cover" />
              ) : (
                result.username?.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{result.username}</p>
              <p className="text-xs text-gray-400">{result.globalRole}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${result.isBanned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {result.isBanned ? 'Banned' : 'Active'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!result.isBanned ? (
              <button
                onClick={() => handleAction(() => apiBanUser(result.id))}
                className="px-3 py-1 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 cursor-pointer transition"
              >
                Ban
              </button>
            ) : (
              <button
                onClick={() => handleAction(() => apiUnbanUser(result.id))}
                className="px-3 py-1 rounded-full bg-green-500 text-white text-xs hover:bg-green-600 cursor-pointer transition"
              >
                Unban
              </button>
            )}
            {result.globalRole === 'USER' && (
              <button
                onClick={() => handleAction(() => apiPromoteToModerator(result.id))}
                className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs hover:bg-blue-600 cursor-pointer transition"
              >
                Promote to Moderator
              </button>
            )}
            {result.globalRole === 'MODERATOR' && (
              <button
                onClick={() => handleAction(() => apiUnpromoteModerator(result.id))}
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
                onClick={() => handleAction(() => apiAdjustPenaltyPoints(result.id, points, note || undefined))}
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

  const tabs = [
    { key: 'reports', label: 'Reports', visible: true },
    { key: 'users', label: 'Users', visible: isAdmin },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6 bg-gray-50 min-h-screen">
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
        {tab === 'reports' && <ReportsTab isAdmin={isAdmin} />}
        {tab === 'users' && isAdmin && <UsersTab />}
      </div>
    </div>
  );
}