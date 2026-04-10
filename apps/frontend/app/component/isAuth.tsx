"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { apiMe } from "@/lib/api/auth";

export default function IsAuth({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
    useEffect(() => {
        apiMe().then(user => {
        if (user) setUser(user);
        });
    }, [setUser]);
    return <>{children}</>;
}