"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToastType } from "@/features/admin/types/admin.types";

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${type === "success" ? "bg-green-500" : "bg-red-500"}`}
    >
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 opacity-70 hover:opacity-100 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const showToast = useCallback(
    (message: string, type: ToastType = "success") =>
      setToast({ message, type }),
    [],
  );
  const hideToast = useCallback(() => setToast(null), []);
  return { toast, showToast, hideToast };
}
