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
// The editor shell is the warm paper/teal D direction. The stored id remains
// `ink` for backwards compatibility with existing settings; an explicit user
// choice of another theme still resolves to that theme unchanged. Keeping the
// id stable means returning users do not get a dead or silently-migrated setting.
//
// Hex literals (not Tailwind token names) are required by `createTheme`, and
// editor *mechanics* are explicitly out of the design system's "no raw hex"
// scope. These values match the light teal editor chrome.
// The foregrounds below are tuned for the D surface (#EDF4EF): a deep teal ink
// for identifiers, a readable teal accent for keywords/calls, and a softened
// line-number colour that stays legible without competing with the source.
const ink = createTheme({
  theme: 'light',
  settings: {
    background: '#EDF4EF',
    foreground: '#2B514A',
    caret: '#12816F',
    selection: 'rgba(18,129,111,0.16)',
    selectionMatch: 'rgba(18,129,111,0.10)',
    lineHighlight: 'rgba(18,129,111,0.06)',
    gutterBackground: '#EDF4EF',
    gutterForeground: '#5C6E61',
    gutterBorder: 'transparent',
  },
  styles: [
    { tag: t.comment, color: '#5C6E61', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#5C6E61', fontStyle: 'italic' },
    { tag: t.keyword, color: '#0E7768' },
    { tag: t.controlKeyword, color: '#0E7768' },
    { tag: t.moduleKeyword, color: '#0E7768' },
    { tag: [t.string, t.special(t.string)], color: '#2E806D' },
    { tag: t.number, color: '#2B514A' },
    { tag: [t.bool, t.null], color: '#0E7768' },
    // Teal for call-like names. The ZenUML DSL LRLanguage maps
    // `MethodName/Identifier → t.function(t.variableName)` (zenumlLanguage.ts), so
    // DSL method calls now reach this teal style — the old StreamLanguage emitted a
    // bare "function" modifier string that resolved to nothing. These styles also
    // apply in the CSS editor (@codemirror/lang-css), which emits real function tags.
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#12816F' },
    { tag: t.variableName, color: '#2B514A' },
    { tag: t.propertyName, color: '#2B514A' },
    { tag: t.typeName, color: '#2B514A' },
    { tag: t.className, color: '#2B514A' },
    { tag: t.operator, color: '#5C6E61' },
    { tag: [t.punctuation, t.separator, t.bracket], color: '#5C6E61' },
    // ZenUML annotations use the same teal accent as keywords.
    { tag: t.meta, color: '#0E7768' },
    { tag: t.invalid, color: '#B23A33' },
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
