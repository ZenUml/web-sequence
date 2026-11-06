import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomId } from './id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('randomId', () => {
  it('returns a bare uuid when crypto.randomUUID exists and no prefix is given', () => {
    expect(randomId()).toMatch(UUID);
  });

  it('prefixes the uuid with "<prefix>-"', () => {
    const id = randomId('item');
    expect(id.startsWith('item-')).toBe(true);
    expect(id.slice('item-'.length)).toMatch(UUID);
  });

  it('falls back to time + random when crypto.randomUUID is missing', () => {
    vi.stubGlobal('crypto', {});
    const a = randomId();
    const b = randomId();
    expect(a).toMatch(/^[0-9a-z]+-[0-9a-z]{1,8}$/);
    // Same millisecond must not collide: the random part separates them.
    expect(a).not.toBe(b);
    expect(randomId('folder')).toMatch(/^folder-[0-9a-z]+-[0-9a-z]{1,8}$/);
  });

  it('falls back when crypto itself is undefined', () => {
    vi.stubGlobal('crypto', undefined);
    expect(randomId('p')).toMatch(/^p-[0-9a-z]+-[0-9a-z]{1,8}$/);
  });
});
