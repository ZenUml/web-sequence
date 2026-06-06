import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fb = vi.hoisted(() => ({
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  onAuthChange: vi.fn((cb: (u: unknown) => void) => { fb._cb = cb; return () => {}; }) as any,
  _cb: (_u: unknown) => {},
}));
vi.mock('../services/firebase', () => ({ login: fb.login, logout: fb.logout, onAuthChange: fb.onAuthChange }));
vi.mock('../services/userService', () => ({ ensureUser: vi.fn(async () => ({})), getUserSettings: vi.fn(async () => ({})) }));

import { useAuth } from './useAuth';
import { useAuthStore } from '../state/authStore';

beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null, online: true }); window.localStorage.clear(); });

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
});
