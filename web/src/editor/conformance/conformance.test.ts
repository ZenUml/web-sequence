// @vitest-environment node
//
// Semantic non-conflict gate (docs/adr/0002).
//
// The hard requirement for the editor parser: its semantic analysis must NEVER
// CONTRADICT the renderer's ANTLR parser. Operationalised as a SUBSET invariant —
// for every input, the set of participants OUR parser reports must be a subset of
// the set ANTLR reports. Abstaining (reporting fewer) passes; fabricating a name
// ANTLR does not recognise fails.
//
// Node env: this compares two parsers, no DOM needed. CM6 EditorState is pure
// state (only EditorView touches the DOM), so our side runs headless too.

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LRLanguage } from '@codemirror/language'
import { parser } from '../grammar/zenuml-parser.js'
import { zenumlParticipantField, getParticipants } from '../participantManager'
import { oracleParticipants } from './oracle'
import { CORPUS } from './corpus'

// Our parser's participant set for `src`, via the real Lezer language + the
// shared-tree participant field (the exact path the editor uses at runtime).
const lezerLang = LRLanguage.define({ parser })
function ourParticipants(src: string): Set<string> {
  const state = EditorState.create({
    doc: src,
    extensions: [lezerLang, zenumlParticipantField],
  })
  return new Set(getParticipants(state))
}

describe('participants ⊆ ANTLR (no fabrication)', () => {
  for (const c of CORPUS) {
    // RED checkpoint: cases flagged expectedFabrication CURRENTLY fabricate
    // (Head-greedy bug). `it.fails` keeps the committed suite green while
    // recording the defect, and self-enforces removal — the GREEN phase makes
    // the parser abstain, at which point `it.fails` flips to failing unless the
    // flag is deleted. The GREEN phase MUST clear every expectedFabrication flag.
    const run = c.expectedFabrication ? it.fails : it
    run(c.name, () => {
      const ours = ourParticipants(c.src)
      const oracle = oracleParticipants(c.src)
      const fabricated = [...ours].filter((n) => !oracle.has(n))
      expect(
        fabricated,
        `fabricated participant(s) ${JSON.stringify(fabricated)} not in ANTLR's set ` +
          `${JSON.stringify([...oracle])} for input ${JSON.stringify(c.src)}` +
          (c.note ? `\n  note: ${c.note}` : ''),
      ).toEqual([])
    })
  }
})
