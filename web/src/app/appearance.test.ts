import { afterEach, describe, expect, it } from 'vitest';
import { applyAppearance, previewThemeFor, readStoredAppearance } from './appearance';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.appearance;
});

describe('appearance', () => {
  it('reads the persisted settings value (JSON, as written by syncStore on the web)', () => {
    window.localStorage.setItem('appearance', JSON.stringify('dark'));
    expect(readStoredAppearance()).toBe('dark');
  });

  it('falls back to light for missing or invalid values', () => {
    expect(readStoredAppearance()).toBe('light');
    window.localStorage.setItem('appearance', '"sepia"');
    expect(readStoredAppearance()).toBe('light');
    window.localStorage.setItem('appearance', '{not json');
    expect(readStoredAppearance()).toBe('light');
  });

  it('mirrors the appearance onto <html data-appearance>', () => {
    applyAppearance('dark');
    expect(document.documentElement.dataset.appearance).toBe('dark');
    applyAppearance('light');
    expect(document.documentElement.dataset.appearance).toBe('light');
  });

  it('maps dark appearance to the darcula renderer theme', () => {
    expect(previewThemeFor('dark')).toBe('theme-darcula');
    expect(previewThemeFor('light')).toBe('theme-default');
  });
});
