// Indentation invariant gate (TT-I42 — the ad4dc2a antidote for this subsystem).
//
// Property-style check over GENERATED docs: for every block-opener kind × nesting
// depth 1–4, build the fully closed block text and assert via CodeMirror's
// indentation API (getIndentation, driven by zenumlLanguage's indentNodeProp /
// delimitedIndent config):
//   - the BODY line's computed indent == opener line indent + one indent unit
//     (the default indentUnit, 2 spaces — nothing overrides it)
//   - the CLOSER line's computed indent == the opener line's indent
//
// Harness notes:
//   - Same EditorState harness shape as zenumlAutocomplete.test.ts, but the language
//     must be the SHIPPED zenumlLanguage (zenumlSupport()): a raw
//     LRLanguage.define({ parser }) carries no indentNodeProp, so getIndentation
//     would not exercise the product config under test.
//   - Each doc is asserted error-free first (guards against false-pass: if the
//     grammar swallowed the block, the indent numbers would be meaningless).
//   - Openers self-nest for depth (an `if` inside an `if`, a `par` inside a `par`…)
//     so every opener kind is exercised at every level. `group G {` is the one
//     exception: groups are head-level only (a GroupBraceBlock holds participants,
//     not statements, and a Group is not a statement), so nesting a group is
//     grammatically impossible — it is covered at depth 1 only, explicitly.

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { getIndentation } from '@codemirror/language'
import { zenumlLanguage, zenumlSupport } from './zenumlLanguage'

const INDENT_UNIT = 2 // CM6 default indentUnit; the editor does not override it

interface NestedDoc {
  doc: string
  openerLineNo: number // 1-based line number of the innermost opener
}

/**
 * Build a closed-block doc with `depth` levels of the SAME opener nested inside
 * each other, each level indented one unit further. The innermost block holds a
 * single body statement.
 *
 *   if(x) {          ← depth-1 wrappers…
 *     if(x) {        ← innermost opener (line `depth`)
 *       A.b()        ← body line
 *     }              ← closer line, aligned with its opener
 *   }
 */
function nestedDoc(opener: string, body: string, depth: number): NestedDoc {
  const lines: string[] = []
  for (let i = 0; i < depth - 1; i++) lines.push('  '.repeat(i) + opener)
  const ind = '  '.repeat(depth - 1)
  lines.push(ind + opener)
  lines.push(ind + '  ' + body)
  lines.push(ind + '}')
  for (let i = depth - 2; i >= 0; i--) lines.push('  '.repeat(i) + '}')
  return { doc: lines.join('\n'), openerLineNo: depth }
}

function assertErrorFree(doc: string) {
  let errors = 0
  zenumlLanguage.parser.parse(doc).iterate({
    enter: (n) => {
      if (n.type.isError) errors++
    },
  })
  expect(errors, `doc must parse error-free:\n${doc}`).toBe(0)
}

/** Computed indent (in columns) for the line at 1-based `lineNo`. */
function indentAtLine(state: EditorState, lineNo: number): number | null {
  return getIndentation(state, state.doc.line(lineNo).from)
}

function assertIndentInvariant(opener: string, body: string, depth: number) {
  const { doc, openerLineNo } = nestedDoc(opener, body, depth)
  assertErrorFree(doc)
  const state = EditorState.create({ doc, extensions: [zenumlSupport()] })
  const openerIndent = (depth - 1) * INDENT_UNIT
  expect(
    indentAtLine(state, openerLineNo + 1),
    `body indent for ${JSON.stringify(opener)} at depth ${depth}`,
  ).toBe(openerIndent + INDENT_UNIT)
  expect(
    indentAtLine(state, openerLineNo + 2),
    `closer indent for ${JSON.stringify(opener)} at depth ${depth}`,
  ).toBe(openerIndent)
}

// Statement-block openers: self-nestable, body is a plain sync message.
const STATEMENT_OPENERS = [
  'A.m() {',
  'if(x) {',
  'while(x) {',
  'opt {',
  'par {',
  'try {',
  'critical {',
] as const

describe('indentation invariant gate: body = opener + 1 unit, closer = opener column', () => {
  for (const opener of STATEMENT_OPENERS) {
    describe(`opener ${JSON.stringify(opener)}`, () => {
      for (const depth of [1, 2, 3, 4]) {
        it(`holds at nesting depth ${depth}`, () => {
          assertIndentInvariant(opener, 'A.b()', depth)
        })
      }
    })
  }

  describe('opener "group G {" (head-level only — nesting is grammatically impossible)', () => {
    it('holds at depth 1 (a GroupBraceBlock body holds participants, so the body is a bare name)', () => {
      assertIndentInvariant('group G {', 'B', 1)
    })
  })
})
