import { describe, it, expect } from 'vitest';
import { EDITOR_THEMES } from './editorThemes';
import { THEMES, resolveTheme, DEFAULT_THEME } from '../editor/themes';

describe('EDITOR_THEMES', () => {
  it('offers exactly the CM6-resolvable themes (id + label), in THEMES order', () => {
    expect(EDITOR_THEMES).toEqual(THEMES.map((t) => ({ id: t.id, label: t.label })));
  });

  it('lists Ink first (the default editor surface)', () => {
    expect(EDITOR_THEMES[0]).toEqual({ id: 'ink', label: 'Ink' });
    expect(EDITOR_THEMES[0].id).toBe(DEFAULT_THEME);
  });

  it('includes the CM6 set and excludes dead legacy CM5 ids', () => {
    const ids = EDITOR_THEMES.map((t) => t.id);
    for (const id of ['ink', 'monokai', 'dracula', 'github-light', 'solarized-light']) {
      expect(ids).toContain(id);
    }
    // DISCRIMINATING: legacy CM5 ids that the CM6 editor cannot resolve must be gone.
    for (const dead of ['cobalt', 'zenburn', 'material', 'eclipse', 'twilight']) {
      expect(ids).not.toContain(dead);
    }
  });

  it('every offered theme id is actually resolvable by the editor', () => {
    // DISCRIMINATING: resolveTheme falls back to DEFAULT_THEME for unknown ids, so
    // assert each id maps to its OWN extension (not the fallback) — except 'ink'
    // which IS the default. This fails if EDITOR_THEMES drifts from THEMES.
    const fallback = resolveTheme('definitely-not-a-real-theme');
    for (const { id } of EDITOR_THEMES) {
      const ext = resolveTheme(id);
      expect(ext).toBeDefined();
      if (id !== DEFAULT_THEME) {
        expect(ext).not.toBe(fallback);
      }
    }
  });
});
