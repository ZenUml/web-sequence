// Tests for the LRLanguage-based ZenUML highlighter.
//
// Methodology:
//  - Parse a snippet with the configured parser (grammar + styleTags).
//  - Walk the tree to confirm the target node exists (avoids false-pass
//    assertions when a node isn't reached because the snippet doesn't produce it).
//  - Use highlightTree + classHighlighter to resolve CSS class names.
//
// classHighlighter class-name facts (verified empirically — do NOT change
// assertions based on intuition; run the tests):
//  - t.lineComment       → "tok-comment"   (same as t.comment; sub-tags collapse)
//  - t.controlKeyword    → "tok-keyword"   (sub-tag of t.keyword)
//  - t.null              → "tok-keyword"   (sub-tag of t.keyword)
//  - t.bool              → "tok-bool"      (distinct)
//  - t.bracket           → "tok-punctuation" (sub-tag of t.punctuation)
//  - t.function(t.variableName) → "tok-variableName"  (modifier invisible to
//    classHighlighter; the semantic distinction matters for real app themes)
//  - t.className         → "tok-className" (distinct — used for Name/Identifier)
//
// Traps avoided:
//  - Async-message content after `:` is Content { LineContent }, NOT a String node.
//    Pick snippets where String appears as a grammar Atom (inside conditions, etc.).

import { describe, it, expect } from 'vitest'
import { highlightTree, classHighlighter } from '@lezer/highlight'
import { zenumlLanguage, zenumlSupport, zenumlStream } from './zenumlLanguage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseWithTags(src: string) {
  return zenumlLanguage.parser.parse(src)
}

/** Return every { text, classes } pair produced by highlightTree for `src`. */
function highlightedTokens(src: string): Array<{ text: string; classes: string }> {
  const tree = parseWithTags(src)
  const result: Array<{ text: string; classes: string }> = []
  highlightTree(tree, classHighlighter, (from, to, classes) => {
    result.push({ text: src.slice(from, to), classes })
  })
  return result
}

/** First highlighted token whose text matches exactly. */
function tokenFor(src: string, text: string) {
  return highlightedTokens(src).find((tok) => tok.text === text)
}

/** Assert that `text` within `src` produces CSS classes containing `tag`. */
function expectTag(src: string, text: string, tag: string) {
  const tok = tokenFor(src, text)
  expect(tok, `no highlighted token for "${text}" in: ${src}`).toBeDefined()
  expect(tok!.classes, `"${text}" should carry "${tag}" but got "${tok!.classes}"`).toContain(tag)
}

/** Confirm a node name exists in the parse tree (guards against false-pass assertions). */
function assertNodeExists(src: string, nodeName: string) {
  const tree = parseWithTags(src)
  let found = false
  tree.iterate({ enter: (n) => { if (n.name === nodeName) found = true } })
  expect(found, `node "${nodeName}" not found in parse tree for: ${src}`).toBe(true)
}

// ── LRLanguage structure ───────────────────────────────────────────────────────

describe('zenumlLanguage (LRLanguage)', () => {
  it('has the correct language name', () => {
    expect(zenumlLanguage.name).toBe('zenuml')
  })

  it('has a configured parser', () => {
    expect(zenumlLanguage.parser).toBeDefined()
  })

  it('zenumlSupport() returns a LanguageSupport wrapping zenumlLanguage', () => {
    const support = zenumlSupport()
    expect(support.language).toBe(zenumlLanguage)
  })
})

// ── Comment highlighting ───────────────────────────────────────────────────────
// t.lineComment → classHighlighter emits "tok-comment"

describe('Comment → tok-comment', () => {
  it('single-line comment gets tok-comment class', () => {
    const src = '// this is a comment\nA.b()'
    assertNodeExists(src, 'Comment')
    expectTag(src, '// this is a comment', 'tok-comment')
  })
})

// ── String highlighting ────────────────────────────────────────────────────────
// String must appear as a grammar Atom, not as message content after `:`.

describe('String → tok-string', () => {
  it('quoted string in condition gets tok-string class', () => {
    const src = 'if ("hello") {\n  A.b()\n}'
    assertNodeExists(src, 'String')
    expectTag(src, '"hello"', 'tok-string')
  })

  it('quoted string as Starter argument gets tok-string class', () => {
    const src = '@Starter("Alice")\nA.b()'
    assertNodeExists(src, 'String')
    expectTag(src, '"Alice"', 'tok-string')
  })
})

// ── Number highlighting ────────────────────────────────────────────────────────

describe('Number → tok-number', () => {
  it('integer literal in condition gets tok-number class', () => {
    const src = 'if (42) {\n  A.b()\n}'
    assertNodeExists(src, 'Number')
    expectTag(src, '42', 'tok-number')
  })
})

// ── Boolean highlighting ───────────────────────────────────────────────────────
// t.bool → "tok-bool" (distinct from tok-keyword)

describe('TrueKeyword / FalseKeyword → tok-bool', () => {
  it('true gets tok-bool class', () => {
    const src = 'if (true) {\n  A.b()\n}'
    assertNodeExists(src, 'TrueKeyword')
    expectTag(src, 'true', 'tok-bool')
  })

  it('false gets tok-bool class', () => {
    const src = 'if (false) {\n  A.b()\n}'
    assertNodeExists(src, 'FalseKeyword')
    expectTag(src, 'false', 'tok-bool')
  })
})

// ── Null / Undefined highlighting ─────────────────────────────────────────────
// t.null is a sub-tag of t.keyword; classHighlighter emits "tok-keyword".
// Real app themes (ink) target [t.bool, t.null] explicitly for visual distinction.

describe('NullKeyword / UndefinedKeyword → tok-keyword (t.null sub-tag)', () => {
  it('null gets tok-keyword class', () => {
    const src = 'if (null) {\n  A.b()\n}'
    assertNodeExists(src, 'NullKeyword')
    expectTag(src, 'null', 'tok-keyword')
  })
})

// ── Control-flow keyword highlighting ─────────────────────────────────────────
// t.controlKeyword is a sub-tag of t.keyword; classHighlighter emits "tok-keyword".
// Real app themes distinguish controlKeyword from keyword visually.

describe('Control-flow keywords → tok-keyword (t.controlKeyword sub-tag)', () => {
  it('if gets tok-keyword class', () => {
    const src = 'if (x) {\n  A.b()\n}'
    assertNodeExists(src, 'IfKeyword')
    expectTag(src, 'if', 'tok-keyword')
  })

  it('else gets tok-keyword class', () => {
    const src = 'if (x) {\n  A.b()\n} else {\n  A.c()\n}'
    assertNodeExists(src, 'ElseKeyword')
    expectTag(src, 'else', 'tok-keyword')
  })

  it('while gets tok-keyword class', () => {
    const src = 'while (x) {\n  A.b()\n}'
    assertNodeExists(src, 'WhileKeyword')
    expectTag(src, 'while', 'tok-keyword')
  })

  it('try gets tok-keyword class', () => {
    const src = 'try {\n  A.b()\n} catch {\n  C.d()\n}'
    assertNodeExists(src, 'TryKeyword')
    expectTag(src, 'try', 'tok-keyword')
  })

  it('catch gets tok-keyword class', () => {
    const src = 'try {\n  A.b()\n} catch {\n  C.d()\n}'
    assertNodeExists(src, 'CatchKeyword')
    expectTag(src, 'catch', 'tok-keyword')
  })

  it('par gets tok-keyword class', () => {
    const src = 'par {\n  A.b()\n}'
    assertNodeExists(src, 'ParKeyword')
    expectTag(src, 'par', 'tok-keyword')
  })

  it('opt gets tok-keyword class', () => {
    const src = 'opt {\n  A.b()\n}'
    assertNodeExists(src, 'OptKeyword')
    expectTag(src, 'opt', 'tok-keyword')
  })
})

// ── Plain keyword highlighting ─────────────────────────────────────────────────

describe('Other keywords → tok-keyword', () => {
  it('new gets tok-keyword class', () => {
    const src = 'A.m() {\n  new B()\n}'
    assertNodeExists(src, 'NewKeyword')
    expectTag(src, 'new', 'tok-keyword')
  })

  it('return gets tok-keyword class', () => {
    const src = 'A.m() {\n  return 1\n}'
    assertNodeExists(src, 'ReturnKeyword')
    expectTag(src, 'return', 'tok-keyword')
  })
})

// ── Operator highlighting ──────────────────────────────────────────────────────

describe('Operators → tok-operator', () => {
  it('arrow -> gets tok-operator class', () => {
    const src = 'A->B: hello'
    assertNodeExists(src, 'ArrowOp')
    expectTag(src, '->', 'tok-operator')
  })
})

// ── Punctuation / bracket highlighting ────────────────────────────────────────
// t.bracket is a sub-tag of t.punctuation; classHighlighter emits "tok-punctuation".

describe('Brackets / punctuation → tok-punctuation', () => {
  it('opening paren gets tok-punctuation class', () => {
    // Use the paren inside the condition — multiple `(` exist; find the right one.
    const src = 'if (x) {\n  A.b()\n}'
    const tokens = highlightedTokens(src)
    const paren = tokens.find((tok) => tok.text === '(' && tok.classes.includes('tok-punctuation'))
    expect(paren, 'should find a "(" with tok-punctuation').toBeDefined()
  })

  it('opening brace gets tok-punctuation class', () => {
    const src = 'if (x) {\n  A.b()\n}'
    const tokens = highlightedTokens(src)
    const brace = tokens.find((tok) => tok.text === '{' && tok.classes.includes('tok-punctuation'))
    expect(brace, 'should find a "{" with tok-punctuation').toBeDefined()
  })

  it('colon gets tok-punctuation class', () => {
    const src = 'A->B: message'
    assertNodeExists(src, 'Colon')
    expectTag(src, ':', 'tok-punctuation')
  })

  it('dot gets tok-punctuation class', () => {
    const src = 'A.myMethod()'
    assertNodeExists(src, 'Dot')
    expectTag(src, '.', 'tok-punctuation')
  })
})

// ── Context-path tagging: Name vs MethodName ──────────────────────────────────
// This test proves that the context paths in styleTags are active.
// Name/Identifier → t.className → "tok-className"
// MethodName/Identifier → t.function(t.variableName) → "tok-variableName"
// The two produce DIFFERENT classes despite both being Identifier nodes.

describe('Context-path tagging: Name → tok-className, MethodName → tok-variableName', () => {
  it('participant name gets tok-className (Name/Identifier path)', () => {
    // In "A.myMethod()", the To node wraps a Name wrapping an Identifier ("A").
    const src = 'A.myMethod()'
    assertNodeExists(src, 'Name')
    assertNodeExists(src, 'MethodName')
    const tokA = tokenFor(src, 'A')
    const tokMethod = tokenFor(src, 'myMethod')
    expect(tokA, '"A" should be highlighted').toBeDefined()
    expect(tokMethod, '"myMethod" should be highlighted').toBeDefined()
    // Name/Identifier → tok-className; MethodName/Identifier → tok-variableName
    expect(tokA!.classes).toContain('tok-className')
    expect(tokMethod!.classes).toContain('tok-variableName')
    // They must be different — the context paths are doing useful work.
    expect(tokA!.classes).not.toBe(tokMethod!.classes)
  })
})

// ── Keyword words inside free-text spans (TT-H9 + TT-H36) ─────────────────────
// A word that happens to be a DSL keyword ("if", "while", "new", "title") inside a
// free-text span must take the SPAN's class, never tok-keyword. #813's lesson: the
// guard must enumerate ALL free-text node types, not just message Content — a
// partial guard recurs. Each case asserts (a) the containing span carries its own
// class and NOT tok-keyword, and (b) no keyword word inside the span surfaces as a
// standalone tok-keyword token.

describe('Keyword words inside free-text spans take the span class, never tok-keyword', () => {
  const FREE_TEXT_CASES: Array<{
    label: string
    src: string
    node: string // parse-tree node guarding against false-pass
    spanText: string // the highlighted span enclosing the keyword words
    words: string[] // keyword words embedded in the span
    ownClass: string
  }> = [
    {
      label: 'message label Content',
      src: 'A->B: if while new',
      node: 'Content',
      spanText: 'if while new',
      words: ['if', 'while', 'new'],
      ownClass: 'tok-string',
    },
    {
      label: 'title TitleContent',
      src: 'title while loading',
      node: 'TitleContent',
      spanText: 'while loading',
      words: ['while'],
      ownClass: 'tok-string',
    },
    {
      label: 'comment',
      src: '// if x',
      node: 'Comment',
      spanText: '// if x',
      words: ['if'],
      ownClass: 'tok-comment',
    },
    {
      label: 'alias Label String',
      src: '@Actor A as "title screen"',
      node: 'String',
      spanText: '"title screen"',
      words: ['title'],
      ownClass: 'tok-string',
    },
    {
      label: 'quoted MethodName',
      src: 'A."if order"()',
      node: 'MethodName',
      spanText: '"if order"',
      words: ['if'],
      ownClass: 'tok-string',
    },
  ]

  for (const c of FREE_TEXT_CASES) {
    it(`${c.label}: keyword word(s) ${c.words.join('/')} stay ${c.ownClass}, never tok-keyword`, () => {
      assertNodeExists(c.src, c.node)
      const span = tokenFor(c.src, c.spanText)
      expect(span, `free-text span "${c.spanText}" should be highlighted in: ${c.src}`).toBeDefined()
      expect(span!.classes, `span "${c.spanText}" must carry its own class`).toContain(c.ownClass)
      expect(span!.classes, `span "${c.spanText}" must NOT carry tok-keyword`).not.toContain('tok-keyword')
      // No keyword word inside the span may escape as its own tok-keyword token.
      const tokens = highlightedTokens(c.src)
      for (const word of c.words) {
        const leaked = tokens.find((tok) => tok.text === word && tok.classes.includes('tok-keyword'))
        expect(leaked, `"${word}" must not surface as a standalone tok-keyword token in: ${c.src}`).toBeUndefined()
      }
    })
  }
})

// ── Transient half-typed states (TT-H1) ───────────────────────────────────────
// While the user is mid-keystroke the document passes through broken states
// (dangling arrow, empty label, unmatched brace). Parsing/highlighting must never
// throw, and the COMPLETE tokens already typed keep their lexical classes. No
// class assertions on the partial/error tokens themselves — only on completed ones.

describe('Transient half-typed states keep completed-token classes and never throw', () => {
  const HALF_TYPED = ['A-', 'A->', 'A->B: ', '}', '@', '/']

  it('parsing + highlighting never throw on any half-typed doc', () => {
    for (const src of HALF_TYPED) {
      expect(() => highlightedTokens(src), `should not throw for: ${JSON.stringify(src)}`).not.toThrow()
    }
  })

  it('"A-": A keeps its Name class (tok-className)', () => {
    expectTag('A-', 'A', 'tok-className')
  })

  it('"A->": A keeps tok-className and the completed arrow keeps tok-operator', () => {
    expectTag('A->', 'A', 'tok-className')
    expectTag('A->', '->', 'tok-operator')
  })

  it('"A->B: " (empty label): endpoints, arrow, and colon all keep their classes', () => {
    expectTag('A->B: ', 'A', 'tok-className')
    expectTag('A->B: ', 'B', 'tok-className')
    expectTag('A->B: ', '->', 'tok-operator')
    expectTag('A->B: ', ':', 'tok-punctuation')
  })
})

// ── Legacy stream export (backwards-compat until modes.ts migration) ──────────

describe('zenumlStream (legacy export — kept until modes.ts migration)', () => {
  class FakeStream {
    pos = 0
    constructor(public string: string) {}
    match(pattern: RegExp): boolean {
      const m = pattern.exec(this.string.slice(this.pos))
      if (m && m.index === 0) {
        this.pos += m[0].length
        return true
      }
      return false
    }
    next(): string {
      return this.string[this.pos++]
    }
    eol(): boolean {
      return this.pos >= this.string.length
    }
  }

  function firstToken(src: string): string | null {
    const s = new FakeStream(src) as unknown as Parameters<typeof zenumlStream.token>[0]
    return zenumlStream.token(s, {} as never) ?? null
  }

  it('marks keywords', () => {
    expect(firstToken('if (x) {')).toBe('keyword')
    expect(firstToken('while (x)')).toBe('keyword')
    expect(firstToken('return x')).toBe('keyword')
    expect(firstToken('new A()')).toBe('keyword')
  })

  it('marks comments', () => {
    expect(firstToken('// note here')).toBe('comment')
  })

  it('marks strings', () => {
    expect(firstToken('"hello"')).toBe('string')
  })

  it('marks identifiers as variableName and call targets as function', () => {
    expect(firstToken('Alice')).toBe('variableName')
    expect(firstToken('method(')).toBe('function')
  })
})
