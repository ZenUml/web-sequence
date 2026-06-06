import type { Extension } from '@codemirror/state';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubLight } from '@uiw/codemirror-theme-github';
import { solarizedLight } from '@uiw/codemirror-theme-solarized';

export interface ThemeDef {
  id: string;
  label: string;
  extension: Extension;
}

export const THEMES: ThemeDef[] = [
  { id: 'monokai', label: 'Monokai', extension: monokai },
  { id: 'dracula', label: 'Dracula', extension: dracula },
  { id: 'github-light', label: 'GitHub Light', extension: githubLight },
  { id: 'solarized-light', label: 'Solarized Light', extension: solarizedLight },
];

export const DEFAULT_THEME = 'monokai';

export function resolveTheme(id: string): Extension {
  return (THEMES.find((t) => t.id === id) ?? THEMES[0]).extension;
}
