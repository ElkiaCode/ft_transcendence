"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.globalRole !== 'MODERATOR' && user.globalRole !== 'ADMIN') {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || (user.globalRole !== 'MODERATOR' && user.globalRole !== 'ADMIN')) {
    return null;
  }

  return <>{children}</>;
}