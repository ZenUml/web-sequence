// web/src/editor/modes.ts (minimal; expanded in Task 12)
import { css } from '@codemirror/lang-css';
import type { Extension } from '@codemirror/state';
import { zenumlSupport } from './zenumlLanguage';
import { zenumlParticipantField } from './participantManager';
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
  return [zenumlSupport(), zenumlParticipantField];
}
