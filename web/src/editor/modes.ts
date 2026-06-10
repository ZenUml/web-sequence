// web/src/editor/modes.ts (minimal; expanded in Task 12)
import { css } from '@codemirror/lang-css';
import type { Extension } from '@codemirror/state';
import { zenumlSupport } from './zenumlLanguage';
import { zenumlParticipantField } from './participantManager';
import { cjkPunctuationAutocorrect } from './cjkAutocorrect';
export type EditorLanguage = 'dsl' | 'css';
export function languageExtension(lang: EditorLanguage): Extension[] {
  if (lang === 'css') return [css()];
  // DSL uses the purpose-built ZenUML Lezer language (LRLanguage) — real
  // grammar-backed highlighting + participant tracking. ORDER MATTERS: the
  // participant field must come AFTER the language so syntaxTree(state) sees the
  // freshly-parsed Lezer tree for the transaction.
  //
  // The Lezer linter (zenumlLinter) is intentionally NOT wired here. The editor
  // grammar under-accepts vs the renderer's ANTLR grammar (see CONTEXT.md "Known
  // grammar gaps"), so its error nodes false-positive on common, renderer-VALID
  // diagrams — declare-then-message (`@Actor A` / `A->B: msg`) and the shipped
  // quoted-method-name templates. The DSL editor showed NO inline diagnostics
  // before this rewrite; adding wrong ones is a regression. zenumlLinter stays
  // built+tested and returns once the grammar matches the renderer.
  // cjkPunctuationAutocorrect rewrites full-width/CJK punctuation (。，：（）…) typed by
  // a CJK-IME user into the ASCII forms ZenUML syntax needs — except inside free-text
  // labels/strings/comments, where it reads the same (post-language) syntax tree the
  // participant field does, so it must come AFTER zenumlSupport() too.
  return [zenumlSupport(), zenumlParticipantField, cjkPunctuationAutocorrect];
}
