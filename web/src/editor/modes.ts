// web/src/editor/modes.ts (minimal; expanded in Task 12)
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import type { Extension } from '@codemirror/state';
export type EditorLanguage = 'dsl' | 'css';
export function languageExtension(lang: EditorLanguage): Extension[] {
  return lang === 'css' ? [css()] : [javascript()];
}
