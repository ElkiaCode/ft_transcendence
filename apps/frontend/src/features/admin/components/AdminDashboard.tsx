"use client";

import { useState } from "react";
import { Toast, useToast } from "@/components/feedback/Toast";
import { ReportsTab } from "@/features/admin/components/reports/ReportsTab";
import { UsersTab } from "@/features/admin/components/users/UsersTab";
import { useAuthStore } from "@/features/auth/stores/auth.store";

export function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.globalRole === "ADMIN";
  const [tab, setTab] = useState<"reports" | "users">("reports");
  const { toast, showToast, hideToast } = useToast();
  const tabs = [
    { key: "reports", label: "Reports", visible: true },
    { key: "users", label: "Users", visible: isAdmin },
  ] as const;

  return (
    <div className="min-h-screen bg-white">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? "Admin Dashboard" : "Moderator Dashboard"}
          </h1>
          <a
            href="/profiles"
            className="text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer"
          >
            ← Back
          </a>
        </div>
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          {tabs
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition cursor-pointer ${tab === item.key ? "text-blue-500 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              >
                {item.label}
              </button>
            ))}
        </div>
        <div>
          {tab === "reports" && (
            <ReportsTab isAdmin={isAdmin} showToast={showToast} />
          )}
          {tab === "users" && isAdmin && <UsersTab showToast={showToast} />}
        </div>
      </div>
    </div>
  );
}
