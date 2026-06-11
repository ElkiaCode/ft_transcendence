"use client";

import { useState } from "react";
import type { Report } from "@/features/admin/types/admin.types";
import { ActionHistory } from "./ActionHistory";

export function ReportCard({
  report,
  onReview,
  isRecentlyReviewed,
}: {
  report: Report;
  onReview: (report: Report) => void;
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
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.status === "OPEN" ? "bg-yellow-100 text-yellow-700" : report.status === "RESOLVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
          >
            {report.status}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.targetType === "USER" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}
          >
            {report.targetType}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(report.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="text-sm text-gray-700">
        <span className="font-medium">By:</span>{" "}
        {report.creator?.username ?? "System"}
        {report.targetType === "USER" && report.targetUser && (
          <>
            {" "}
            → <span className="font-medium">{report.targetUser.username}</span>
          </>
        )}
        {report.targetType === "MESSAGE" && report.targetMessage && (
          <>
            {" "}
            → message by{" "}
            <span className="font-medium">
              {report.targetMessage.sender.username}
            </span>
          </>
        )}
      </div>
      <p className="text-sm text-gray-500 italic">{report.reason}</p>
      {report.targetType === "MESSAGE" && report.targetMessage?.content && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 italic">
          &quot;
          {report.targetMessage.content.length > 120
            ? report.targetMessage.content.slice(0, 120) + "…"
            : report.targetMessage.content}
          &quot;
        </div>
      )}
      {report.actions.length > 0 && (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="self-start text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
        >
          {expanded
            ? "▲ Hide history"
            : `▼ Show history (${report.actions.length})`}
        </button>
      )}
      {expanded && <ActionHistory actions={report.actions} />}
      {report.status === "OPEN" && (
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
