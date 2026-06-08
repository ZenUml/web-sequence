// Editor theme list for the Settings modal's Theme picker.
//
// These must be the themes the CM6 editor can actually RESOLVE — i.e. the
// `THEMES` defined in `web/src/editor/themes.ts`. The legacy CodeMirror-5 theme
// IDs ('cobalt', 'zenburn', 'material', ...) that used to live here are dead in
// the rewrite: the CM6 editor has no extension for them, so picking one fell
// back silently. We derive the picker entries from the single source of truth
// (THEMES) so the dropdown only ever offers resolvable themes. "Ink" (the
// default editor surface) is listed first by THEMES order.
import { THEMES } from '../editor/themes';

export interface EditorThemeOption {
  id: string;
  label: string;
}

export const EDITOR_THEMES: readonly EditorThemeOption[] = THEMES.map((t) => ({
  id: t.id,
  label: t.label,
}));
