import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type User = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  agent_code: string;
  status: string;
  two_factor_enabled: boolean;
  permissions: string[];
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'super_admin') return true;
        return user.permissions.includes(permission);
      },
    }),
    { name: 'auth-storage' }
  )
);
