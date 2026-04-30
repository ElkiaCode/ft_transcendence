import {create} from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  globalRole?: 'USER' | 'MODERATOR' | 'ADMIN'; 
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