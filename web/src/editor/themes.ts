import type { Extension } from '@codemirror/state';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubLight } from '@uiw/codemirror-theme-github';
import { solarizedLight } from '@uiw/codemirror-theme-solarized';

export interface ThemeDef {
  id: string;
  label: string;
  extension: Extension;
}

// "Ink" / drafting theme — the default editor surface for the rewrite.
//
// The stored id remains `ink` for backwards compatibility with existing settings;
// an explicit user choice of another theme still resolves to that theme unchanged.
//
// Ink is the app's own theme, so its palette is read from the `--code-*` CSS
// variables defined in globals.css. Those variables follow the global light/dark
// appearance (<html data-appearance>), keeping the code area on the same
// continuous base surface as the editor shell in both appearances. The other
// themes keep their fixed palettes.
const ink = createTheme({
  theme: 'light',
  settings: {
    background: 'var(--code-bg)',
    foreground: 'var(--code-fg)',
    caret: 'var(--code-caret)',
    selection: 'var(--code-selection)',
    selectionMatch: 'var(--code-selection-match)',
    lineHighlight: 'var(--code-line-highlight)',
    gutterBackground: 'var(--code-bg)',
    gutterForeground: 'var(--code-muted)',
    gutterBorder: 'transparent',
  },
  styles: [
    { tag: t.comment, color: 'var(--code-muted)', fontStyle: 'italic' },
    { tag: t.lineComment, color: 'var(--code-muted)', fontStyle: 'italic' },
    { tag: t.keyword, color: 'var(--code-keyword)' },
    { tag: t.controlKeyword, color: 'var(--code-keyword)' },
    { tag: t.moduleKeyword, color: 'var(--code-keyword)' },
    { tag: [t.string, t.special(t.string)], color: 'var(--code-string)' },
    { tag: t.number, color: 'var(--code-fg)' },
    { tag: [t.bool, t.null], color: 'var(--code-keyword)' },
    // Call-like names. The ZenUML DSL LRLanguage maps
    // `MethodName/Identifier → t.function(t.variableName)` (zenumlLanguage.ts).
    // These styles also apply in the CSS editor (@codemirror/lang-css).
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-function)' },
    { tag: t.variableName, color: 'var(--code-fg)' },
    { tag: t.propertyName, color: 'var(--code-fg)' },
    { tag: t.typeName, color: 'var(--code-fg)' },
    { tag: t.className, color: 'var(--code-fg)' },
    { tag: t.operator, color: 'var(--code-muted)' },
    { tag: [t.punctuation, t.separator, t.bracket], color: 'var(--code-muted)' },
    // ZenUML annotations use the same accent as keywords.
    { tag: t.meta, color: 'var(--code-keyword)' },
    { tag: t.invalid, color: 'var(--code-invalid)' },
  ],
});

export const THEMES: ThemeDef[] = [
  { id: 'ink', label: 'Ink', extension: ink },
  { id: 'monokai', label: 'Monokai', extension: monokai },
  { id: 'dracula', label: 'Dracula', extension: dracula },
  { id: 'github-light', label: 'GitHub Light', extension: githubLight },
  { id: 'solarized-light', label: 'Solarized Light', extension: solarizedLight },
];

export const DEFAULT_THEME = 'ink';

export function resolveTheme(id: string): Extension {
  return (THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME) ?? THEMES[0])
    .extension;
}
