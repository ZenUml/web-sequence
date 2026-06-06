import { describe, it, expect } from 'vitest';
import { THEMES, DEFAULT_THEME, resolveTheme } from './themes';

describe('themes', () => {
  it('exposes a curated set with monokai default', () => {
    expect(DEFAULT_THEME).toBe('monokai');
    expect(THEMES.map((t) => t.id)).toContain('monokai');
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    expect(THEMES.length).toBeLessThanOrEqual(12); // curated, not all 47
  });
  it('resolveTheme falls back to monokai for unknown ids', () => {
    expect(resolveTheme('does-not-exist')).toBe(resolveTheme('monokai'));
  });
});
