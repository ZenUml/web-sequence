import { describe, it, expect, beforeEach } from 'vitest';
import { localStore } from './storage';

beforeEach(() => window.localStorage.clear());

describe('localStore', () => {
  it('round-trips JSON values', async () => {
    await localStore.set('k', { a: 1 });
    expect(await localStore.get('k', null)).toEqual({ a: 1 });
  });
  it('returns fallback when missing', async () => {
    expect(await localStore.get('missing', 42)).toBe(42);
  });
  it('tolerates legacy non-JSON string values', async () => {
    window.localStorage.setItem('legacy', 'plain-string');
    expect(await localStore.get('legacy', '')).toBe('plain-string');
  });
  it('remove deletes the key', async () => {
    await localStore.set('k', 1);
    await localStore.remove('k');
    expect(await localStore.get('k', 'gone')).toBe('gone');
  });
});
