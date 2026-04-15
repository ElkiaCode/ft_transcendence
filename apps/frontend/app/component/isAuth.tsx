"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiRefresh } from "@/lib/api/auth";

export default function IsAuth({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    apiRefresh()
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => {
      })
      .finally(() => {
        setCheckedAuth(true);
      });
  }, [setUser]);

  if (!checkedAuth) {
    return null;
  }

  return <>{children}</>;
}