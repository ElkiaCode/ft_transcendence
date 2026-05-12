import {create} from 'zustand';
import type { AppUser } from '@/lib/types';

interface AuthStore {
  user: AppUser | null;
  setUser: (user: AppUser) => void;
  logout: () => void;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token }),
  logout: () =>
    set({
      user: null,
      accessToken: null,
    }),
  clear: () =>
    set({
      user: null,
      accessToken: null,
    }),
}));
