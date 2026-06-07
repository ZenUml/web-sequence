import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fb = vi.hoisted(() => ({
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  onAuthChange: vi.fn((cb: (u: unknown) => void) => { fb._cb = cb; return () => {}; }) as any,
  _cb: (_u: unknown) => {},
}));
vi.mock('../services/firebase', () => ({ login: fb.login, logout: fb.logout, onAuthChange: fb.onAuthChange }));
const usvc = vi.hoisted(() => ({ ensureUser: vi.fn(async () => ({})), getUserSettings: vi.fn(async () => ({})) }));
vi.mock('../services/userService', () => usvc);

import { useAuth } from './useAuth';
import { useAuthStore } from '../state/authStore';
import { useSettingsStore } from '../state/settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, online: true, authReady: false });
  window.localStorage.clear();
  usvc.getUserSettings.mockResolvedValue({});
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, cloudKeys: new Set(), userKeys: new Set() });
});

describe('useAuth', () => {
  it('subscribes to auth changes and reflects the user in the store', async () => {
    renderHook(() => useAuth());
    await act(async () => { fb._cb({ uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null }); });
    expect(useAuthStore.getState().user?.uid).toBe('u1');
  });
  it('login persists lastAuthProvider', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.login('google'); });
    expect(fb.login).toHaveBeenCalledWith('google');
    expect(window.localStorage.getItem('lastAuthProvider')).toContain('google');
  });
  it('login surfaces account-exists-with-different-credential', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fb.login.mockRejectedValueOnce({ code: 'auth/account-exists-with-different-credential' });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.login('github'); });
    expect(alertSpy).toHaveBeenCalled();
  });
  it('login swallows and logs non-account-exists errors (FIX 7)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fb.login.mockRejectedValueOnce(new Error('network-failure'));
    const { result } = renderHook(() => useAuth());
    // Must NOT reject — swallows and logs instead of rethrowing.
    await expect(act(() => result.current.login('google'))).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('[auth] login failed', expect.any(Error));
    consoleSpy.mockRestore();
  });
  it('onAuthChange sets authReady to true (FIX 1)', async () => {
    renderHook(() => useAuth());
    await act(async () => { fb._cb(null); });
    expect(useAuthStore.getState().authReady).toBe(true);
  });

  // Adversarial review #3 follow-up: when a signed-in user's cloud settings load,
  // they must WIN over whatever the signed-out boot (syncStore) already merged for
  // the SAME key, while local-only keys (absent from cloud) survive. This pins the
  // "cloud wins, local fills gaps" ordering that the AppRoot boot syncStore-load +
  // useAuth cloud-merge together rely on. We simulate the boot having already
  // applied a local value, then sign in and resolve a DIFFERENT cloud value.
  it('cloud settings (on sign-in) win over a previously-merged local value; local-only keys survive', async () => {
    // Pretend the signed-out boot already loaded these from syncStore via the boot
    // LOCAL-BASE loop (AppRoot.tsx:268 mergeLocalBase — NOT a live user `merge`, which
    // after finding 3 is reserved for in-session user changes that win over cloud):
    //   fontSize 13 (local), keymap 'vim' (local-only — cloud will NOT return it).
    useSettingsStore.getState().mergeLocalBase({ fontSize: 13, keymap: 'vim' });
    // Cloud returns a DIFFERENT fontSize and does not mention keymap.
    usvc.getUserSettings.mockResolvedValue({ fontSize: 18 } as never);
    renderHook(() => useAuth());
    await act(async () => { fb._cb({ uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null }); });
    // Cloud value wins for the overlapping key.
    expect(useSettingsStore.getState().settings.fontSize).toBe(18);
    // Local-only key (cloud absent) is preserved by the key-wise merge.
    expect(useSettingsStore.getState().settings.keymap).toBe('vim');
  });

  // Adversarial review #1 — CALL-SITE guard: pins that useAuth routes cloud settings
  // into the AUTHORITATIVE layer (mergeCloud), not plain merge. The store test proves
  // mergeLocalBase respects cloudKeys; but if someone "simplifies" useAuth back to
  // plain `merge`, no cloudKeys are recorded and a later boot-local-base merge would
  // clobber the cloud value — that revert would sail through the store test. Here we
  // sign in FIRST (cloud applies), THEN simulate the boot syncStore loop arriving LATE
  // via mergeLocalBase for the SAME key: it must NOT overwrite the cloud value, which
  // holds ONLY if useAuth used mergeCloud. Reverting useAuth to plain `merge` → the
  // late local-base value clobbers cloud → fontSize becomes 13 → fails.
  it('useAuth routes cloud settings into mergeCloud (a late local-base merge cannot clobber)', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, cloudKeys: new Set(), userKeys: new Set() });
    usvc.getUserSettings.mockResolvedValue({ fontSize: 18 } as never);
    renderHook(() => useAuth());
    await act(async () => { fb._cb({ uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null }); });
    expect(useSettingsStore.getState().settings.fontSize).toBe(18);
    // Boot syncStore loop arrives LATE with a stale local value for the same key.
    act(() => { useSettingsStore.getState().mergeLocalBase({ fontSize: 13 }); });
    // Cloud value survives because useAuth recorded fontSize in cloudKeys via mergeCloud.
    expect(useSettingsStore.getState().settings.fontSize).toBe(18);
  });
});
