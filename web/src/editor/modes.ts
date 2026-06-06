// web/src/editor/modes.ts (minimal; expanded in Task 12)
import { StreamLanguage } from '@codemirror/language';
import { css } from '@codemirror/lang-css';
import type { Extension } from '@codemirror/state';
import { zenumlStream } from './zenumlLanguage';
export type EditorLanguage = 'dsl' | 'css';
export function languageExtension(lang: EditorLanguage): Extension[] {
  // DSL uses the purpose-built ZenUML stream highlighter (not JS tokenization).
  return lang === 'css' ? [css()] : [StreamLanguage.define(zenumlStream)];
}
