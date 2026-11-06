import { useCallback, useEffect, useRef, useState } from 'react';
import { login as fbLogin, logout as fbLogout, onAuthChange } from '../services/firebase';
import { ensureUser, getUserSettings } from '../services/userService';
import { useAuthStore } from '../state/authStore';
import { useSettingsStore } from '../state/settingsStore';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';
import type { ProviderName } from '../services/types';
import { describeLoginFailure, toSignInProvider, type SignInProvider } from '../components/auth/signInProviders';

// Provider helpers live in a Firebase-free module so presentational code (and
// fixtures) can use them without initialising Firebase; re-exported here.
export {
  SIGN_IN_PROVIDERS,
  PROVIDER_LABEL,
  toSignInProvider,
  describeLoginFailure,
  type SignInProvider,
} from '../components/auth/signInProviders';

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  // Inline OAuth error for the LoginModal (no blocking window.alert).
  const [loginError, setLoginError] = useState<string | null>(null);
  // Provider whose window is open for the CURRENT attempt; null when idle.
  const [pendingProvider, setPendingProvider] = useState<ProviderName | null>(null);
  // Last successfully used provider, limited to the providers the UI offers.
  const [lastProvider, setLastProvider] = useState<SignInProvider | null>(null);

  // Attempt bookkeeping. `attempt` increments on every login() and cancelLogin();
  // a settling promise only touches UI state when its attempt is still current.
  // `inFlight` is the synchronous single-submission gate (set before any await).
  const attempt = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  useEffect(() => {
    mounted.current = true;
    void localStore
      .get<string | null>(LS_KEYS.lastAuthProvider, null)
      .then((v) => { if (mounted.current) setLastProvider(toSignInProvider(v)); })
      .catch(() => {});
    return () => {
      mounted.current = false;
      attempt.current += 1;
    };
  }, []);

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

  // Never rejects: call sites fire-and-forget (`login(p)`), so a rejection would be
  // unhandled. Failures land in loginError instead.
  const login = useCallback(async (provider: ProviderName): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    const id = ++attempt.current;
    const isCurrent = () => mounted.current && attempt.current === id;
    setLoginError(null);
    setPendingProvider(provider);
    try {
      await fbLogin(provider);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (!code) console.error('[auth] login failed', e);
      if (isCurrent()) setLoginError(describeLoginFailure(provider, code));
      return;
    } finally {
      if (attempt.current === id) inFlight.current = false;
      if (isCurrent()) setPendingProvider(null);
    }
    // Sign-in succeeded (even if the attempt was cancelled in the UI meanwhile —
    // the account is signed in), so record the provider as last used.
    try {
      await localStore.set(LS_KEYS.lastAuthProvider, provider);
    } catch (e) {
      console.error('[auth] could not record last provider', e);
    }
    if (mounted.current) setLastProvider(toSignInProvider(provider));
  }, []);

  // Abandon the current attempt in the UI (modal closed). Clears pending + error
  // and releases the single-submission gate so a reopened modal starts fresh; the
  // abandoned attempt's late result is ignored by the UI.
  const cancelLogin = useCallback(() => {
    attempt.current += 1;
    inFlight.current = false;
    setPendingProvider(null);
    setLoginError(null);
  }, []);

  const logout = useCallback(async () => { await fbLogout(); }, []);

  return { login, logout, loginError, clearLoginError, pendingProvider, cancelLogin, lastProvider };
}
