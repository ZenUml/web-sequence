import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ANON_ID_KEY, getAnonId, resetAnonIdCacheForTests } from './anonId';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  window.localStorage.clear();
  resetAnonIdCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAnonId', () => {
  it('creates a v4 UUID and stores it in localStorage', () => {
    const id = getAnonId();
    expect(id).toMatch(UUID);
    expect(window.localStorage.getItem(ANON_ID_KEY)).toBe(id);
  });

  it('returns the same id on later calls and after a reload (cache cleared)', () => {
    const first = getAnonId();
    expect(getAnonId()).toBe(first);
    resetAnonIdCacheForTests();
    expect(getAnonId()).toBe(first);
  });

  it('reuses an id already in localStorage', () => {
    window.localStorage.setItem(ANON_ID_KEY, 'existing-anon-id');
    expect(getAnonId()).toBe('existing-anon-id');
  });

  it('two browsers (cleared storage) get different ids', () => {
    const a = getAnonId();
    window.localStorage.clear();
    resetAnonIdCacheForTests();
    expect(getAnonId()).not.toBe(a);
  });

  it('when localStorage throws, still returns a stable per-session id', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const id = getAnonId();
    expect(id).toMatch(UUID);
    expect(getAnonId()).toBe(id);
  });
});

describe('getAnonId stored-value validation', () => {
  it.each(['null', 'undefined', '   ', 'x'.repeat(200), 'has space'])(
    'replaces an invalid stored value %j with a fresh UUID',
    (bad) => {
      window.localStorage.setItem(ANON_ID_KEY, bad);
      const id = getAnonId();
      expect(id).toMatch(UUID);
      expect(window.localStorage.getItem(ANON_ID_KEY)).toBe(id);
    },
  );
});
