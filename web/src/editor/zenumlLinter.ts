// Lezer-error-node linter for the ZenUML DSL.
//
// Walks the syntax tree produced by the LR grammar and emits a CodeMirror
// Diagnostic for every error node. Does NOT instantiate @zenuml/core or any
// renderer — that was the reference implementation's bundle-bloat bug.
//
// Integration note: this linter is inert unless the editor state carries the
// LEZER language (LRLanguage.define({ parser })), not the legacy StreamLanguage.
// syntaxTree() over a StreamLanguage returns a trivial top node with no grammar
// error nodes. The switch from zenumlStream → lezerLanguage in modes.ts is the
// controller's integration step; once that lands, zenumlLinter() starts emitting.

import { linter, type Diagnostic } from '@codemirror/lint'
import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

/**
 * Return a human-readable message for an error node. Currently always
 * "Unexpected token" — can be enriched by inspecting the parent node name
 * without breaking any callers (tests assert position + severity, not the
 * exact string).
 */
function errorMessage(state: EditorState, from: number, to: number): string {
  const snippet = state.doc.sliceString(from, Math.min(to + 8, state.doc.length)).trim()
  if (snippet.length > 0) {
    return `Unexpected token near "${snippet.slice(0, 20)}"`
  }
  return 'Unexpected end of input'
}

/**
 * Pure helper — usable in unit tests without a real EditorView.
 *
 * Walks the syntaxTree of `state` and emits one Diagnostic per error node.
 * Zero-width error ranges are clamped to a visible 1-char span:
 *   - if there is a character ahead, expand right (to + 1)
 *   - if we are at end-of-document, expand left (from - 1) to stay in-bounds
 */
export function zenumlDiagnostics(state: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const tree = syntaxTree(state)

  tree.iterate({
    enter(node) {
      if (!node.type.isError) return

      let from = node.from
      let to = node.to

      // Clamp zero-width ranges to a visible 1-char span.
      if (from === to) {
        if (to < state.doc.length) {
          to += 1
        } else {
          from = Math.max(0, from - 1)
        }
      }

      diagnostics.push({
        from,
        to,
        severity: 'error',
        message: errorMessage(state, from, to),
      })
    },
  })

  return diagnostics
}

/**
 * CodeMirror Extension that highlights ZenUML syntax errors via the Lezer tree.
 *
 * Add to the editor's extensions alongside the LRLanguage (not StreamLanguage).
 */
export function zenumlLinter(): Extension {
  return linter((view) => zenumlDiagnostics(view.state))
}
