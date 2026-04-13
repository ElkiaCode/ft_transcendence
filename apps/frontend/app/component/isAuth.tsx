"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiMe } from "@/lib/api/auth";

export default function IsAuth({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    apiMe()
      .then((user) => {
        if (user) setUser(user);
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