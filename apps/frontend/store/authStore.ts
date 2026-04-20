import {create} from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  provider?: 'local' | '42';
  profile: {
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
  };
}

interface AuthStore {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  clear: () => set({ user: null, accessToken: null }),
}));
