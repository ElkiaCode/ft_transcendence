"use client";

import { useEffect, useState } from "react";
import {
  apiListReports,
  apiReviewReport,
} from "@/features/admin/api/admin.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type {
  ModerationAction,
  Report,
  ToastType,
} from "@/features/admin/types/admin.types";
import { ReportCard } from "./ReportCard";
import { ReviewModal } from "./ReviewModal";

const REPORTS_PER_PAGE = 10;

type ReportStatusFilter = "ALL" | "OPEN" | "RESOLVED" | "DISMISSED";
type ReportTypeFilter = "ALL" | "USER" | "MESSAGE";

export function ReportsTab({
  isAdmin,
  showToast,
}: {
  isAdmin: boolean;
  showToast: (message: string, type: ToastType) => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState<Report | null>(null);
  const [filter, setFilter] = useState<ReportStatusFilter>("OPEN");
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [recentlyReviewed, setRecentlyReviewed] = useState<Set<string>>(
    new Set(),
  );
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
      await apiReviewReport(
        reviewModal.id,
        action as "WARN" | "BAN" | "UNBAN" | "DISMISS_REPORT",
        note || undefined,
        points || undefined,
      );

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
        prev.map((report) =>
          report.id === reviewedId
            ? {
                ...report,
                status: action === "DISMISS_REPORT" ? "DISMISSED" : "RESOLVED",
                actions: [...report.actions, newAction],
              }
            : report,
        ),
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
      showToast("Report reviewed successfully", "success");
    } catch {
      showToast("Failed to review report", "error");
    }
  };

  const openCount = reports.filter((report) => report.status === "OPEN").length;
  const filtered = reports
    .filter((report) => {
      if (recentlyReviewed.has(report.id)) return true;
      if (filter !== "ALL" && report.status !== filter) return false;
      if (typeFilter !== "ALL" && report.targetType !== typeFilter)
        return false;
      return true;
    })
    .sort((a, b) => {
      const diff =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / REPORTS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * REPORTS_PER_PAGE,
    page * REPORTS_PER_PAGE,
  );

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
            {(["ALL", "OPEN", "RESOLVED", "DISMISSED"] as const).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setFilter(item);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer flex items-center gap-1 ${filter === item ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {item}
                {item === "OPEN" && openCount > 0 && (
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filter === "OPEN" ? "bg-white text-blue-500" : "bg-blue-500 text-white"}`}
                  >
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-1 border-l border-gray-200 pl-2">
            {(["ALL", "USER", "MESSAGE"] as const).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setTypeFilter(item);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${typeFilter === item ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <select
          value={sortOrder}
          onChange={(e) => {
            setSortOrder(e.target.value as "newest" | "oldest");
            setPage(1);
          }}
          className="border border-gray-200 rounded-lg px-3 py-1 text-xs text-gray-600 focus:outline-none cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <div className="flex flex-col gap-3">
        {paginated.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onReview={setReviewModal}
            isRecentlyReviewed={recentlyReviewed.has(report.id)}
          />
        ))}
        {paginated.length === 0 && (
          <p className="text-sm text-gray-400 p-4 text-center">
            No reports found
          </p>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-xs text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
