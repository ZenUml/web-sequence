import { DEFAULT_THEME, THEMES } from '../../editor/themes';

// Shared code appearance (theme + font size) for the inline Code appearance bar.
//
// "Follow app" is the existing `ink` theme, not a new setting: ink reads its
// palette from the `--code-*` CSS variables in globals.css, which switch with the
// global light/dark appearance (<html data-appearance>). Every other theme keeps
// its fixed palette, so choosing one stays independent of the app appearance.
// The stored value is still the theme id ('ink'), so saved settings and the
// Settings modal keep working unchanged.
export const FOLLOW_APP_THEME_ID = DEFAULT_THEME;
export const FOLLOW_APP_LABEL = 'Follow app';

// Supported editor font sizes: Settings.fontSize is documented as 12–18
// (domain/types.ts) and the Settings modal offers exactly 12..18.
export const CODE_FONT_SIZE_MIN = 12;
export const CODE_FONT_SIZE_MAX = 18;

export interface CodeThemeOption {
  id: string;
  label: string;
}

export const CODE_THEME_OPTIONS: readonly CodeThemeOption[] = THEMES.map((t) => ({
  id: t.id,
  label: t.id === FOLLOW_APP_THEME_ID ? FOLLOW_APP_LABEL : t.label,
}));

// The theme the editor actually renders for a stored id. Unknown ids (e.g. a
// legacy CodeMirror 5 theme name) fall back to ink in resolveTheme(), so the bar
// shows them as "Follow app" without rewriting the stored value.
export function effectiveCodeThemeId(id: string | undefined): string {
  return CODE_THEME_OPTIONS.some((t) => t.id === id) ? (id as string) : FOLLOW_APP_THEME_ID;
}

export function codeThemeLabel(id: string | undefined): string {
  const effective = effectiveCodeThemeId(id);
  return CODE_THEME_OPTIONS.find((t) => t.id === effective)?.label ?? FOLLOW_APP_LABEL;
}

// One step, clamped to the supported range. A stored value outside the range is
// shown as-is; the first step moves it back inside.
export function stepCodeFontSize(current: number, delta: 1 | -1): number {
  const next = current + delta;
  return Math.min(CODE_FONT_SIZE_MAX, Math.max(CODE_FONT_SIZE_MIN, next));
}

export function canDecreaseCodeFontSize(current: number): boolean {
  return current > CODE_FONT_SIZE_MIN;
}

export function canIncreaseCodeFontSize(current: number): boolean {
  return current < CODE_FONT_SIZE_MAX;
}
