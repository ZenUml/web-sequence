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
// Aligned to the "Drafting Table" design system's ink workspace: code reads as
// mostly-neutral (ondark-strong) text on the deep ink-950 well, with a SMALL set
// of accent highlights — cobalt keywords, a calm green for strings, a teal for
// calls. Amber is deliberately absent here (the design system reserves amber for
// sparing chrome emphasis, not wall-to-wall syntax like the old Monokai default).
//
// Hex literals (not Tailwind token names) are required by `createTheme`, and
// editor *mechanics* are explicitly out of the design system's "no raw hex"
// scope. The values below mirror the semantic tokens in `web/tailwind.config.js`
// so the editor stays visually consistent with the app chrome. Each foreground
// passes WCAG AA (>=4.5:1) on ink-950 (#0B0E13):
//   ondark-strong #E8EEF7  16.6:1   base text, identifiers, numbers
//   accent.onDark #7AA2FF   7.8:1   keywords (the cobalt signal)
//   ok            #2FA56B   6.2:1   strings (calm green)
//   teal          #5CC8C0   9.6:1   function/method calls (calm teal)
//   ondark-muted  #8A99AE   6.7:1   comments (italic), operators, punctuation
const ink = createTheme({
  theme: 'dark',
  settings: {
    background: '#0B0E13', // ink-950 — deepest well
    foreground: '#E8EEF7', // ondark-strong — neutral base text
    caret: '#7AA2FF', // accent.onDark
    selection: 'rgba(47,107,255,0.24)', // accent tint
    selectionMatch: 'rgba(47,107,255,0.16)', // accent-soft
    lineHighlight: 'rgba(255,255,255,0.03)',
    gutterBackground: '#10141B', // ink-900
    gutterForeground: '#5C6A80', // ondark-faint (line numbers; non-syntax chrome)
    gutterBorder: 'transparent',
  },
  styles: [
    { tag: t.comment, color: '#8A99AE', fontStyle: 'italic' }, // ondark-muted
    { tag: t.lineComment, color: '#8A99AE', fontStyle: 'italic' },
    { tag: t.keyword, color: '#7AA2FF' }, // accent.onDark — the cobalt signal
    { tag: t.controlKeyword, color: '#7AA2FF' },
    { tag: t.moduleKeyword, color: '#7AA2FF' },
    { tag: [t.string, t.special(t.string)], color: '#2FA56B' }, // ok — calm green
    { tag: t.number, color: '#E8EEF7' }, // neutral
    { tag: [t.bool, t.null], color: '#7AA2FF' },
    // Teal for call-like names. NOTE: the ZenUML DSL StreamLanguage emits a bare
    // "function" token string, which is a lezer *modifier* (not a base tag) and
    // therefore resolves to nothing — DSL calls render neutral (still on-brand
    // for the "mostly neutral" goal). These styles DO apply in the CSS editor
    // (@codemirror/lang-css), which emits real function tags. zenumlLanguage.ts
    // is out of scope to change here.
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#5CC8C0' }, // teal calls
    { tag: t.variableName, color: '#E8EEF7' }, // neutral identifiers
    { tag: t.propertyName, color: '#E8EEF7' },
    { tag: t.typeName, color: '#E8EEF7' },
    { tag: t.className, color: '#E8EEF7' },
    { tag: t.operator, color: '#8A99AE' }, // ondark-muted — recessed punctuation
    { tag: [t.punctuation, t.separator, t.bracket], color: '#8A99AE' },
    { tag: t.invalid, color: '#E0524A' }, // danger
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
