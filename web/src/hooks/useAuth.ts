import { useCallback, useEffect, useState } from 'react';
import { login as fbLogin, logout as fbLogout, onAuthChange } from '../services/firebase';
import { ensureUser, getUserSettings } from '../services/userService';
import { useAuthStore } from '../state/authStore';
import { useSettingsStore } from '../state/settingsStore';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';
import type { ProviderName } from '../services/types';

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  // M04 (roadmap §9 carry-forward): surface OAuth errors so the LoginModal can show
  // a design-system notice instead of the bare window.alert/console stopgap. The
  // alert/console are kept for backward-compat (existing call sites/tests); this
  // ALSO records the message for UI consumers.
  const [loginError, setLoginError] = useState<string | null>(null);
  const clearLoginError = useCallback(() => setLoginError(null), []);

  useEffect(() => {
    return onAuthChange((user) => {
      setUser(user);
      // Mark auth resolved on the first callback fire (idempotent — always set to true).
      useAuthStore.getState().setAuthReady(true);
      if (user) {
        void ensureUser(user.uid).catch(() => {});
        // mergeCloud (not merge): records cloud-owned keys so the boot syncStore
        // local-base loop can't clobber them on a later arrival (adversarial review:
        // the "cloud wins" claim had NO ordering guarantee — now order-independent).
        void getUserSettings(user.uid).then((s) => useSettingsStore.getState().mergeCloud(s)).catch(() => {});
      }
    });
  }, [setUser]);

  const login = useCallback(async (provider: ProviderName) => {
    setLoginError(null);
    try {
      await fbLogin(provider);
      await localStore.set(LS_KEYS.lastAuthProvider, provider);
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/account-exists-with-different-credential') {
        const msg = 'You have already signed up with the same email using a different social login.';
        window.alert(msg);
        setLoginError(msg);
      } else {
        // FIX 7: swallow + log other errors (legacy parity) — call sites don't catch,
        // so rethrowing causes unhandled promise rejections with no user-visible feedback.
        console.error('[auth] login failed', e);
        setLoginError('Sign-in failed. Please try again.');
      }
    }
  }, []);

  const logout = useCallback(async () => { await fbLogout(); }, []);

  return { login, logout, loginError, clearLoginError };
}
