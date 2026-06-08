import { create } from 'zustand';
import type { AppUser } from '../domain/types';

interface AuthState {
  user: AppUser | null;
  online: boolean;
  authReady: boolean;
  setUser(u: AppUser | null): void;
  setOnline(o: boolean): void;
  setAuthReady(b: boolean): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  authReady: false,
  setUser: (user) => set({ user }),
  setOnline: (online) => set({ online }),
  setAuthReady: (authReady) => set({ authReady }),
}));
