import { create } from 'zustand';
import type { AppUser } from '../domain/types';

interface AuthState {
  user: AppUser | null;
  online: boolean;
  setUser(u: AppUser | null): void;
  setOnline(o: boolean): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setUser: (user) => set({ user }),
  setOnline: (online) => set({ online }),
}));
