import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ user: null, online: true, authReady: false }));
  it('sets and clears the user', () => {
    useAuthStore.getState().setUser({ uid: 'u1', email: 'a@b.c' });
    expect(useAuthStore.getState().user?.uid).toBe('u1');
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });
  it('tracks online status', () => {
    useAuthStore.getState().setOnline(false);
    expect(useAuthStore.getState().online).toBe(false);
  });
  it('authReady defaults false and can be set true', () => {
    expect(useAuthStore.getState().authReady).toBe(false);
    useAuthStore.getState().setAuthReady(true);
    expect(useAuthStore.getState().authReady).toBe(true);
  });
});
