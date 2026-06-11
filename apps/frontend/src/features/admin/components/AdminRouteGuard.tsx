"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/stores/auth.store";

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const canAccess =
    user?.globalRole === "MODERATOR" || user?.globalRole === "ADMIN";

  useEffect(() => {
    if (!user || !canAccess) router.replace("/");
  }, [canAccess, router, user]);

  if (!canAccess) return null;
  return <>{children}</>;
}
