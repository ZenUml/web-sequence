import { describe, it, expect } from 'vitest';
import { tags as t } from '@lezer/highlight';
import { highlightingFor } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { THEMES, DEFAULT_THEME, resolveTheme } from './themes';

describe('themes', () => {
  it('defaults to the ink-aligned drafting theme, not monokai', () => {
    // The wall-to-wall-amber Monokai is no longer the default; the calm ink
    // theme is. Reverting DEFAULT_THEME to 'monokai' must fail this.
    expect(DEFAULT_THEME).toBe('ink');
    expect(DEFAULT_THEME).not.toBe('monokai');
  });

  it('ships ink as a curated theme and keeps the others available', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('ink');
    expect(ids).toContain('monokai'); // other themes still selectable
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    expect(THEMES.length).toBeLessThanOrEqual(12); // curated, not all 47
  });

  it('the default id resolves to a real theme definition', () => {
    expect(THEMES.find((t) => t.id === DEFAULT_THEME)).toBeDefined();
    expect(resolveTheme(DEFAULT_THEME)).toBe(resolveTheme('ink'));
  });

  it('resolveTheme falls back to the default (ink) for unknown ids', () => {
    expect(resolveTheme('does-not-exist')).toBe(resolveTheme(DEFAULT_THEME));
    expect(resolveTheme('does-not-exist')).toBe(resolveTheme('ink'));
    // Distinct themes must NOT collapse to the same extension (guards against a
    // resolver that returns one theme for everything).
    expect(resolveTheme('monokai')).not.toBe(resolveTheme('ink'));
  });

  // The ink theme must actually COLOR syntax — not just exist as an id. These
  // are the lezer base tags the ZenUML DSL StreamLanguage resolves to
  // (keyword/string/comment), so a live style here means the DSL renders
  // colored, not wall-to-wall neutral. A theme with no `styles` would return
  // null and fail these.
  function classFor(themeId: string, tag: (typeof t)['keyword']): string | null {
    const state = EditorState.create({ extensions: resolveTheme(themeId) });
    return highlightingFor(state, [tag]);
  }

  it('the ink theme assigns distinct highlight classes to keyword/string/comment', () => {
    const kw = classFor('ink', t.keyword);
    const str = classFor('ink', t.string);
    const com = classFor('ink', t.comment);
    expect(kw).toBeTruthy(); // keywords styled (cobalt)
    expect(str).toBeTruthy(); // strings styled (green)
    expect(com).toBeTruthy(); // comments styled (muted)
    // Keyword vs string must be visually different roles, not collapsed.
    expect(kw).not.toBe(str);
  });
});
