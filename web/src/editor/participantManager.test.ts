// Tests for the participant name StateField.
//
// The state MUST carry an LRLanguage (not StreamLanguage) so syntaxTree()
// returns a real grammar tree. We build it inline using the generated parser,
// following the same pattern used in zenumlLinter.test.ts.
// Without the LR language, syntaxTree() returns a trivial top node and
// collectParticipants always yields an empty set.

import { describe, it, expect } from 'vitest'
import { EditorState, type Transaction } from '@codemirror/state'
import { LRLanguage } from '@codemirror/language'
import { parser } from './grammar/zenuml-parser.js'
import { zenumlParticipantField, getParticipants } from './participantManager'

// Build the LR language once; reuse across all tests.
// Must be listed before zenumlParticipantField in extensions so that
// syntaxTree(state) is populated when the field's create/update runs.
const lezerLang = LRLanguage.define({ parser })

/** Build an EditorState with the Lezer language + participant field installed. */
function stateFor(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [lezerLang, zenumlParticipantField] })
}

/** Apply a doc-replacing transaction to simulate editing. */
function applyDoc(state: EditorState, newDoc: string): EditorState {
  const tr: Transaction = state.update({
    changes: { from: 0, to: state.doc.length, insert: newDoc },
  })
  return tr.state
}

// ---- Core behaviour ---------------------------------------------------------

describe('zenumlParticipantField + getParticipants', () => {
  describe('basic participant declarations', () => {
    it('collects a single @Annotation participant', () => {
      const state = stateFor('@Actor Client')
      const participants = getParticipants(state)
      expect(participants).toEqual(new Set(['Client']))
    })

    it('collects multiple annotated participants', () => {
      const state = stateFor('@Actor Client\n@Boundary OrderController')
      const participants = getParticipants(state)
      expect(participants).toEqual(new Set(['Client', 'OrderController']))
    })

    it('collects participants inside a group { } block', () => {
      const state = stateFor('group {\n@Service PurchaseService\n}')
      const participants = getParticipants(state)
      expect(participants).toEqual(new Set(['PurchaseService']))
    })

    it('collects across top-level and grouped participants together', () => {
      const state = stateFor('@Actor Client\n@Boundary OrderController\ngroup {\n@Service PurchaseService\n}')
      const participants = getParticipants(state)
      expect(participants).toEqual(new Set(['Client', 'OrderController', 'PurchaseService']))
    })
  })

  // ---- Stereotype name collision -------------------------------------------
  // Guard: the Stereotype's own Name child must NOT be collected.
  // `@Actor <<service>> Client` must yield {Client}, not {service, Client}.
  describe('stereotype name is excluded', () => {
    it('@Actor <<service>> Client yields only {Client}', () => {
      const state = stateFor('@Actor <<service>> Client')
      const participants = getParticipants(state)
      expect(participants).toEqual(new Set(['Client']))
      expect(participants.has('service')).toBe(false)
    })
  })

  // ---- Dynamic updates (docChanged) ----------------------------------------
  describe('updates when the document changes', () => {
    it('adds a participant when a new declaration is appended', () => {
      const s1 = stateFor('@Actor Client')
      expect(getParticipants(s1)).toEqual(new Set(['Client']))

      const s2 = applyDoc(s1, '@Actor Client\n@Boundary Server')
      expect(getParticipants(s2)).toEqual(new Set(['Client', 'Server']))
    })

    it('removes a participant when its declaration is deleted', () => {
      const s1 = stateFor('@Actor Client\n@Boundary Server')
      expect(getParticipants(s1)).toEqual(new Set(['Client', 'Server']))

      const s2 = applyDoc(s1, '@Actor Client')
      const participants = getParticipants(s2)
      expect(participants).toEqual(new Set(['Client']))
      expect(participants.has('Server')).toBe(false)
    })

    it('starts empty for a document with no participant declarations', () => {
      // Pure message diagram — no Head participants.
      // Note: "A->B: msg" may trigger the pre-existing Head/Statement ambiguity,
      // so we use a comment-only doc to stay in zero-error territory.
      const state = stateFor('// no participants here')
      expect(getParticipants(state)).toEqual(new Set())
    })
  })

  // ---- Reference stability -------------------------------------------------
  describe('reference stability (no needless recompute)', () => {
    it('returns the same Set reference when the doc changes but participants do not', () => {
      const s1 = stateFor('@Actor Client\n// comment A')
      const set1 = getParticipants(s1)

      // Change a comment line — participants unchanged.
      const s2 = applyDoc(s1, '@Actor Client\n// comment B')
      const set2 = getParticipants(s2)

      expect(set2).toBe(set1) // same reference — no needless downstream trigger
    })

    it('returns a new Set reference when participants actually change', () => {
      const s1 = stateFor('@Actor Client')
      const set1 = getParticipants(s1)

      const s2 = applyDoc(s1, '@Actor Client\n@Boundary Server')
      const set2 = getParticipants(s2)

      expect(set2).not.toBe(set1) // new reference — downstream code must update
      expect(set2).toEqual(new Set(['Client', 'Server']))
    })
  })

  // ---- Fallback when field is not installed --------------------------------
  describe('getParticipants fallback (field not installed)', () => {
    it('returns an empty set when the field is absent from the state', () => {
      // State without the participant field — simulates a caller that builds
      // state without the full editor extensions.
      const bareState = EditorState.create({ doc: '@Actor Client', extensions: [lezerLang] })
      const participants = getParticipants(bareState)
      expect(participants).toEqual(new Set())
      expect(participants.size).toBe(0)
    })
  })

  // ---- Edge cases ----------------------------------------------------------
  describe('edge cases', () => {
    it('handles an empty document', () => {
      const state = stateFor('')
      expect(getParticipants(state)).toEqual(new Set())
    })

    it('handles a named group without participants', () => {
      // group myGroup {} — "myGroup" is a Name child of Group, not Participant.
      // It must NOT appear in the participants set.
      const state = stateFor('group myGroup {\n}')
      const participants = getParticipants(state)
      expect(participants.has('myGroup')).toBe(false)
      expect(participants.size).toBe(0)
    })

    it('handles a participant with a color attribute', () => {
      const state = stateFor('@Actor Client #FFEBE6')
      expect(getParticipants(state)).toEqual(new Set(['Client']))
    })
  })
})
