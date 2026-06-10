import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LRLanguage, LanguageSupport } from '@codemirror/language'
import { CompletionContext, type Completion } from '@codemirror/autocomplete'
import { parser } from './grammar/zenuml-parser.js'
import { zenumlParticipantField } from './participantManager'
import {
  resolveZone,
  zenumlCompletions,
  zenumlCompletionKeymap,
} from './zenumlAutocomplete'

// ---------------------------------------------------------------------------
// Test harness: install the Lezer grammar as a language so syntaxTree(state)
// returns the real parse tree (the production language wiring is a sibling
// phase; here we build a minimal LRLanguage straight from the generated parser).
// ---------------------------------------------------------------------------

const zenumlLanguage = LRLanguage.define({ parser })
const zenuml = () => new LanguageSupport(zenumlLanguage)

function stateAt(doc: string): EditorState {
  // zenumlParticipantField must come AFTER the language so it reads the parsed
  // tree — this mirrors the real integration wiring participantManager documents.
  return EditorState.create({ doc, extensions: [zenuml(), zenumlParticipantField] })
}

/** Build the completion result at a cursor offset within `doc`. */
function completeAt(doc: string, pos: number, explicit = false) {
  const state = stateAt(doc)
  const ctx = new CompletionContext(state, pos, explicit)
  return zenumlCompletions(ctx)
}

function labels(result: { options: readonly Completion[] } | null): string[] {
  return result ? result.options.map((o) => o.label) : []
}

describe('resolveZone', () => {
  it("returns 'top' at the document top level (declarations ∪ statements)", () => {
    // The top level permits both participant declarations and statements, so it
    // is its own zone ('top'), not 'head'. (ADR 0002: fixes the top-level slash gap.)
    expect(resolveZone(stateAt('A->B: hi'), 0)).toBe('top')
  })

  it("returns 'head' inside a participant declaration", () => {
    const doc = '@Actor Alice\n@Boundary Bob'
    // cursor on the second declaration
    expect(resolveZone(stateAt(doc), doc.indexOf('Bob'))).toBe('head')
  })

  it("returns 'block' inside a StatementBraceBlock", () => {
    const doc = 'A.method() {\n  \n}'
    const pos = doc.indexOf('{') + 4 // inside the braces, on the blank line
    expect(resolveZone(stateAt(doc), pos)).toBe('block')
  })

  it("returns 'block' inside an if block", () => {
    const doc = 'if (x) {\n  \n}'
    const pos = doc.indexOf('{') + 3
    expect(resolveZone(stateAt(doc), pos)).toBe('block')
  })

  it("returns 'head' inside a group's participant list", () => {
    const doc = 'group G {\n  \n}'
    const pos = doc.indexOf('{') + 3
    expect(resolveZone(stateAt(doc), pos)).toBe('head')
  })

  it("defaults to 'top' on an empty document", () => {
    expect(resolveZone(stateAt(''), 0)).toBe('top')
  })

  it("defaults to 'top' on a whitespace-only document", () => {
    expect(resolveZone(stateAt('   \n  '), 3)).toBe('top')
  })
})

describe('slash commands', () => {
  it('offers /if (a block command) when typing "/i" inside a block', () => {
    const doc = 'A.m() {\n  /i\n}'
    const pos = doc.indexOf('/i') + 2
    const ls = labels(completeAt(doc, pos))
    expect(ls).toContain('/if')
  })

  it('does NOT offer /if in a group body (a true head-only zone)', () => {
    // A group body holds participant declarations only — block commands are gated out.
    const doc = 'group G {\n/i\n}'
    const ls = labels(completeAt(doc, doc.indexOf('/i') + 2))
    expect(ls).not.toContain('/if')
    expect(ls).toContain('/participant')
  })

  it('top-level / offers BOTH declaration and message commands', () => {
    const ls = labels(completeAt('/', 1))
    expect(ls).toContain('/participant') // declaration
    expect(ls).toContain('/sync') // message (the top-level slash gap, now fixed)
  })

  it('offers /participant and /group for "/" in the head', () => {
    const doc = '/'
    const ls = labels(completeAt(doc, 1))
    expect(ls).toContain('/participant')
    expect(ls).toContain('/group')
  })

  it('does NOT offer head commands inside a block', () => {
    const doc = 'A.m() {\n  /\n}'
    const pos = doc.indexOf('/') + 1 // just after the "/"
    const ls = labels(completeAt(doc, pos))
    expect(ls).not.toContain('/participant')
    expect(ls).not.toContain('/group')
    expect(ls).toContain('/if')
  })

  it('replaces the slash + typed name (from is at the slash)', () => {
    const doc = 'A.m() {\n  /if\n}'
    const slashPos = doc.indexOf('/if')
    const result = completeAt(doc, slashPos + 3)
    expect(result).not.toBeNull()
    expect(result!.from).toBe(slashPos)
    expect(result!.to).toBe(slashPos + 3)
  })

  it("a slash completion's apply is a snippet (has an apply function)", () => {
    const doc = '/'
    const result = completeAt(doc, 1)
    const participant = result!.options.find((o) => o.label === '/participant')
    expect(participant).toBeDefined()
    // snippetCompletion attaches a function apply that drives the snippet
    // (placeholders -> tab stops). A plain insert would be a string or absent.
    expect(typeof participant!.apply).toBe('function')
    expect(participant!.detail).toBeTruthy()
  })
})

describe('normal completions — participant names', () => {
  // Participant names come from participantManager.getParticipants, which tracks
  // DECLARED participants (Participant>Name). The docs below declare them in a
  // Head so the source is populated; first-mention-only diagrams are a documented
  // participantManager gap, not this module's concern.

  // The slot right after `Name.` is a METHOD-NAME slot (the renderer stores it as
  // free-text Content, never a participant endpoint). So participant names must NOT
  // be offered there — not the OTHER declared participants, and especially not the
  // receiver itself (`OrderController.OrderController` is nonsense). Contrast `A->`,
  // where the next token genuinely IS a participant (see the arrow test below).
  it('does NOT offer participant names after a "Name." method slot', () => {
    const doc = '@Actor OrderController\n@Boundary Web\nOrderController.'
    const pos = doc.length
    const ls = labels(completeAt(doc, pos))
    expect(ls).not.toContain('Web')
    expect(ls).not.toContain('OrderController')
  })

  // The reported repro (#dot-method-slot): `A.m { B }`, type `.` after B. The cursor
  // lands in B's method-name slot — offering participants A/B (incl. B itself → `B.B`)
  // was the bug. After the dot the popup must stay empty.
  it('suppresses participants right after the dot inside a block (A.m { B. })', () => {
    const doc = 'A.m {\n  B.\n}'
    const pos = doc.indexOf('B.') + 2 // cursor immediately after the dot
    const ls = labels(completeAt(doc, pos))
    expect(ls).not.toContain('A')
    expect(ls).not.toContain('B')
  })

  // BOUNDARY: the dot suppression must NOT bleed into the arrow endpoint. After `A->`
  // the next token IS a participant, so names stay offered there.
  it('STILL offers participant names after an arrow (A->) — a participant IS expected', () => {
    const doc = '@Actor B\n@Actor C\nB->'
    const pos = doc.length
    const ls = labels(completeAt(doc, pos))
    expect(ls).toContain('C')
  })

  it('offers participant names at message start inside a block', () => {
    // A control-flow block (while) keeps the cursor in a real StatementBraceBlock
    // — verified zero-error, zone 'block'. (A `Name.method(){}` block would be
    // swallowed by the Head-greedy grammar gap and produce no block here.)
    const doc = '@Actor B\n@Actor C\nwhile (x) {\n  \n}'
    const pos = doc.indexOf('{') + 3 // blank statement line inside the block
    expect(resolveZone(stateAt(doc), pos)).toBe('block')
    const ls = labels(completeAt(doc, pos, true))
    expect(ls).toContain('B')
    expect(ls).toContain('C')
  })

  it('excludes the participant token currently under the cursor', () => {
    // The cursor sits on a fresh "Ali" token. The Head-greedy grammar gap makes
    // getParticipants include "Ali" (it parses as a bare Participant>Name), so
    // this genuinely exercises the by-text exclusion against the real source:
    // "Ali" (the cursor token) is dropped; the other declared names remain.
    const doc = '@Actor Alice\n@Boundary Bob\nAli'
    const pos = doc.length
    const ls = labels(completeAt(doc, pos))
    expect(ls).toContain('Alice')
    expect(ls).toContain('Bob')
    expect(ls).not.toContain('Ali')
  })
})

describe('normal completions — zone-gated keywords', () => {
  it('offers block keywords (if/while/try) inside a block, not head keywords', () => {
    const doc = 'A.run() {\n  \n}'
    const pos = doc.indexOf('{') + 3
    const ls = labels(completeAt(doc, pos, true))
    expect(ls).toContain('if')
    expect(ls).toContain('while')
    expect(ls).toContain('try')
    expect(ls).not.toContain('title')
  })

  it('offers head keywords (title/group) in the head, not block keywords', () => {
    const doc = '@Actor A\n'
    const ls = labels(completeAt(doc, doc.length, true))
    expect(ls).toContain('group')
    expect(ls).toContain('title')
    expect(ls).not.toContain('if')
    expect(ls).not.toContain('while')
  })

  // Bug: the NAME slot of an annotated participant must not offer keywords. After
  // `@Actor ` a participant NAME is expected — offering `as` (a label modifier) or
  // title/group there is wrong (`as` only follows a complete name).
  it('does NOT offer "as"/title/group while typing the name after @Actor', () => {
    const doc = '@Actor a'
    const ls = labels(completeAt(doc, doc.length))
    expect(ls).not.toContain('as')
    expect(ls).not.toContain('title')
    expect(ls).not.toContain('group')
  })

  it('does NOT offer keywords after a bare annotation with no name yet ("@Actor ")', () => {
    const doc = '@Actor '
    const ls = labels(completeAt(doc, doc.length, true))
    expect(ls).not.toContain('as')
    expect(ls).not.toContain('title')
    expect(ls).not.toContain('group')
  })

  it('STILL offers "as" after a complete participant name (the modifier slot)', () => {
    const doc = '@Actor Alice '
    const ls = labels(completeAt(doc, doc.length, true))
    expect(ls).toContain('as')
  })

  // Same class as the @Actor name slot: after `group` a group NAME is expected,
  // so keywords (as/title/group) must not leak into that slot.
  it('does NOT offer keywords while typing a group name ("group a")', () => {
    const doc = 'group a'
    const ls = labels(completeAt(doc, doc.length))
    expect(ls).not.toContain('as')
    expect(ls).not.toContain('group')
    expect(ls).not.toContain('title')
  })

  // Guard: a bare identifier at statement-start is NOT a name slot — title/group
  // keyword completions remain available there (e.g. typing `t` -> title).
  it('STILL offers title/group at statement start (bare "t")', () => {
    const ls = labels(completeAt('t', 1, true))
    expect(ls).toContain('title')
    expect(ls).toContain('group')
  })
})

describe('normal completions — annotations', () => {
  it('offers @-annotations when the typed token starts with "@"', () => {
    const doc = '@Ac'
    const ls = labels(completeAt(doc, 3))
    expect(ls).toContain('@Actor')
    expect(ls).toContain('@Database')
  })

  it('offers cloud annotations too', () => {
    const doc = '@'
    const ls = labels(completeAt(doc, 1))
    expect(ls).toContain('@Lambda')
    expect(ls).toContain('@S3')
  })

  it('does NOT offer annotations inside a block on a plain word', () => {
    const doc = 'A.run() {\n  i\n}'
    const pos = doc.indexOf('  i') + 3
    const ls = labels(completeAt(doc, pos))
    expect(ls).not.toContain('@Actor')
  })

  it('does NOT offer annotations when typing "@" inside a block', () => {
    // Annotations are head-only; a "@" inside a StatementBraceBlock must not pop
    // @Actor/@Database (those declare participants, which only live in the head).
    const doc = 'while (x) {\n  @\n}'
    const pos = doc.indexOf('@') + 1
    expect(resolveZone(stateAt(doc), pos)).toBe('block')
    const ls = labels(completeAt(doc, pos))
    expect(ls).not.toContain('@Actor')
    expect(ls).not.toContain('@Database')
  })
})

describe('no completions inside a comment', () => {
  it('does not offer slash commands inside a comment ("// /sync")', () => {
    const doc = '// /sync'
    expect(labels(completeAt(doc, doc.length))).toEqual([])
  })

  it('does not offer keywords/names inside a comment ("// whi")', () => {
    const doc = '// whi'
    expect(labels(completeAt(doc, doc.length, true))).toEqual([])
  })
})

describe('EMPTY free-text regions must offer NO completions (degenerate-region class)', () => {
  // The populated free-text guard (Content/LineContent/Comment/Label/String) only
  // fires once the node EXISTS; at the zero-width state right after `: ` / `title ` /
  // `== ` the cursor sits in an error-recovery region and completions leak. This is
  // the exact empty-parse-region class that bit cjkAutocorrect (961a221) — its
  // isFreeTextSpan grew AsyncMessage/Colon + Title + Divider branches; the completion
  // guard did not.

  // CANDIDATE BUG #814 TT-A1 (TEST_TREES.md): empty free-text region leaks completions —
  // it.fails documents the defect; flip to it() when fixed. (18 keywords at HEAD.)
  it.fails('offers nothing in an EMPTY message label ("A->B: " + Ctrl+Space)', () => {
    expect(completeAt('A->B: ', 'A->B: '.length, true)).toBeNull()
  })

  // CANDIDATE BUG #814 TT-A2 (TEST_TREES.md): empty free-text region leaks completions —
  // it.fails documents the defect; flip to it() when fixed. (42 options at HEAD.)
  it.fails('offers nothing in an EMPTY title ("title " + Ctrl+Space)', () => {
    expect(completeAt('title ', 'title '.length, true)).toBeNull()
  })

  // CANDIDATE BUG #814 TT-A34 (TEST_TREES.md): empty free-text region leaks completions —
  // it.fails documents the defect; flip to it() when fixed. (42 options at HEAD;
  // third instance of the degenerate-region class — the divider slot.)
  it.fails('offers nothing in an EMPTY divider ("== " + Ctrl+Space)', () => {
    expect(completeAt('== ', '== '.length, true)).toBeNull()
  })
})

describe('zenumlCompletionKeymap', () => {
  it('binds Tab, Enter, and Escape', () => {
    const keys = zenumlCompletionKeymap.map((k) => k.key)
    expect(keys).toContain('Tab')
    expect(keys).toContain('Enter')
    expect(keys).toContain('Escape')
  })

  it('every binding has a run command', () => {
    for (const b of zenumlCompletionKeymap) {
      expect(typeof b.run).toBe('function')
    }
  })
})
