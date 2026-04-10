import {create} from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  prodile: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
  };
}

interface AuthStore {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
