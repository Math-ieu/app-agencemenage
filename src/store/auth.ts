import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logout as apiLogout } from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) => {
        set({ user, isAuthenticated: true });
      },
      logout: async () => {
        try {
          await apiLogout();
        } catch (e) {
          console.error('Erreur lors de la deconnexion', e);
        }
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ─── Notification store ───────────────────────────────────────────────────────
interface NotificationState {
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),
}));
