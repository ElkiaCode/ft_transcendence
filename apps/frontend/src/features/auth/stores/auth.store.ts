import { create } from "zustand";
import type { AppUser } from "@/features/auth/types/auth.types";

interface AuthStore {
  user: AppUser | null;
  accessToken: string | null;
  setUser: (user: AppUser) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token }),
  logout: () => set({ user: null, accessToken: null }),
  clear: () => set({ user: null, accessToken: null }),
}));
