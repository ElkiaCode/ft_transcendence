"use client";

import { useState } from "react";
import type { Report } from "@/features/admin/types/admin.types";
import { ActionHistory } from "./ActionHistory";

export function ReviewModal({
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
      <div className="bg-white rounded-xl p-6 w-[520px] flex flex-col gap-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Review report</h2>
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 flex flex-col gap-2">
          <p className="font-medium text-gray-900">
            {report.targetType === "USER"
              ? `Reported user: ${report.targetUser?.username}`
              : `Message by: ${report.targetMessage?.sender.username ?? "System"}`}
          </p>
          {report.targetType === "MESSAGE" && report.targetMessage?.content && (
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 italic">
              &quot;{report.targetMessage.content}&quot;
            </div>
          )}
          <p className="text-gray-500">
            <span className="font-medium text-gray-700">Reason:</span>{" "}
            {report.reason}
          </p>
          <p className="text-gray-400 text-xs">
            Reported by{" "}
            <span className="font-medium">
              {report.creator?.username ?? "System"}
            </span>{" "}
            on {new Date(report.createdAt).toLocaleDateString()}
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
          <label className="text-sm font-medium text-gray-700">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-gray-300 rounded-lg p-3 text-sm text-black resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            Penalty points to {action === "DISMISS_REPORT" ? "add" : "subtract"}
          </label>
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
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
