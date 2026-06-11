"use client";

import { useEffect, useState } from "react";
import { apiRefresh } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/stores/auth.store";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    apiRefresh()
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => undefined)
      .finally(() => setCheckedAuth(true));
  }, [setUser]);

  if (!checkedAuth) return null;
  return <>{children}</>;
}
