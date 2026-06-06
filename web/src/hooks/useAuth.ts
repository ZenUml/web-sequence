import { useCallback, useEffect } from 'react';
import { login as fbLogin, logout as fbLogout, onAuthChange } from '../services/firebase';
import { ensureUser, getUserSettings } from '../services/userService';
import { useAuthStore } from '../state/authStore';
import { useSettingsStore } from '../state/settingsStore';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';
import type { ProviderName } from '../services/types';

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    return onAuthChange((user) => {
      setUser(user);
      // Mark auth resolved on the first callback fire (idempotent — always set to true).
      useAuthStore.getState().setAuthReady(true);
      if (user) {
        void ensureUser(user.uid).catch(() => {});
        void getUserSettings(user.uid).then((s) => useSettingsStore.getState().merge(s)).catch(() => {});
      }
    });
  }, [setUser]);

  const login = useCallback(async (provider: ProviderName) => {
    try {
      await fbLogin(provider);
      await localStore.set(LS_KEYS.lastAuthProvider, provider);
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/account-exists-with-different-credential') {
        window.alert('You have already signed up with the same email using a different social login.');
      } else {
        // FIX 7: swallow + log other errors (legacy parity) — call sites don't catch,
        // so rethrowing causes unhandled promise rejections with no user-visible feedback.
        console.error('[auth] login failed', e);
      }
    }
  }, []);

  const logout = useCallback(async () => { await fbLogout(); }, []);

  return { login, logout };
}
