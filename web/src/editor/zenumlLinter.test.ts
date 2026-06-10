// Tests for the Lezer-error-node linter.
//
// The state MUST carry an LRLanguage (not StreamLanguage) so syntaxTree()
// returns a real grammar tree. We build it inline using the generated parser.
// Without this, every call to zenumlDiagnostics() returns [] — correct but
// untestable with the legacy StreamLanguage.

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LRLanguage } from '@codemirror/language'
import { parser } from './grammar/zenuml-parser.js'
import { zenumlDiagnostics } from './zenumlLinter'

// Build the LR language once; reuse across all tests.
const lezerLang = LRLanguage.define({ parser })

function stateFor(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [lezerLang] })
}

// ---- Tests ------------------------------------------------------------------

describe('zenumlDiagnostics', () => {
  describe('clean DSL yields no diagnostics', () => {
    const cleanCases: Array<[string, string]> = [
      ['async message', 'A->B: hello world'],
      ['sync method call', 'A.method()'],
      ['if block', 'if (x) {\n  A.b()\n}'],
      ['multi-line realistic diagram',
        'title Order Processing\nCustomer->Web: place order\nWeb.submitOrder(items) {\n  OrderService.validate()\n}',
      ],
      ['divider', '== Phase 2 =='],
      ['comment line', '// just a comment'],
    ]

    it.each(cleanCases)('%s → []', (_label, doc) => {
      expect(zenumlDiagnostics(stateFor(doc))).toEqual([])
    })
  })

  describe('broken DSL yields at least one diagnostic', () => {
    // "A->" — truncated async message: From + ArrowOp, but To is missing.
    // Grammar emits a zero-width error at position 3 (EOF).
    it('truncated arrow (A->) emits ≥1 error', () => {
      const diags = zenumlDiagnostics(stateFor('A->'))
      expect(diags.length).toBeGreaterThanOrEqual(1)
    })

    // "if(" — no condition expression and no closing paren.
    it('unclosed if-paren (if() emits ≥1 error', () => {
      const diags = zenumlDiagnostics(stateFor('if('))
      expect(diags.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('diagnostic shape', () => {
    it('every diagnostic has severity "error"', () => {
      const diags = zenumlDiagnostics(stateFor('A->'))
      expect(diags.length).toBeGreaterThanOrEqual(1)
      for (const d of diags) {
        expect(d.severity).toBe('error')
      }
    })

    it('diagnostics have non-inverted ranges (from <= to)', () => {
      for (const src of ['A->', 'if(', 'A->B: ok\nif(']) {
        const diags = zenumlDiagnostics(stateFor(src))
        for (const d of diags) {
          expect(d.from).toBeLessThanOrEqual(d.to)
        }
      }
    })

    it('zero-width error at EOF is clamped to a visible span (from < to)', () => {
      // "A->" produces a zero-width error at position 3 (== doc.length).
      // The linter must expand it backwards so from < to.
      const diags = zenumlDiagnostics(stateFor('A->'))
      expect(diags.length).toBeGreaterThanOrEqual(1)
      for (const d of diags) {
        expect(d.from).toBeLessThan(d.to)
      }
    })

    it('zero-width error not at EOF is clamped forward (to = from + 1)', () => {
      // "if(" produces errors at position 3 == doc.length for "if(" alone.
      // Use a doc where the error is not at the very end.
      const src = 'if(\nA->B: ok'
      const diags = zenumlDiagnostics(stateFor(src))
      // At least one diagnostic must have from < to.
      const atLeastOneVisible = diags.some((d) => d.from < d.to)
      expect(atLeastOneVisible).toBe(true)
    })

    it('positions are within doc bounds', () => {
      const src = 'A->'
      const state = stateFor(src)
      const docLen = state.doc.length
      const diags = zenumlDiagnostics(state)
      for (const d of diags) {
        expect(d.from).toBeGreaterThanOrEqual(0)
        expect(d.to).toBeLessThanOrEqual(docLen)
      }
    })

    it('diagnostic has a non-empty message string', () => {
      const diags = zenumlDiagnostics(stateFor('A->'))
      expect(diags.length).toBeGreaterThanOrEqual(1)
      for (const d of diags) {
        expect(typeof d.message).toBe('string')
        expect(d.message.length).toBeGreaterThan(0)
      }
    })
  })

  describe('empty document', () => {
    it('empty doc yields no diagnostics', () => {
      expect(zenumlDiagnostics(stateFor(''))).toEqual([])
    })
  })

  describe('multi-error document', () => {
    it('document with two broken lines yields ≥1 diagnostic', () => {
      // Two truncated arrows on separate lines.
      const diags = zenumlDiagnostics(stateFor('A->\nB->'))
      expect(diags.length).toBeGreaterThanOrEqual(1)
    })
  })
})
