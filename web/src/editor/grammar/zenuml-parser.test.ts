import { describe, it, expect } from 'vitest'
import { parser } from './zenuml-parser.js'

/**
 * Collect every error node in a parse tree. Lezer emits error nodes for both
 * "skipped" recovery (node.type.isError) and unmatched expected tokens; we walk
 * the whole tree and return the offending ranges so failures are debuggable.
 */
function errorRanges(src: string): Array<[number, number]> {
  const tree = parser.parse(src)
  const errors: Array<[number, number]> = []
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) errors.push([node.from, node.to])
    },
  })
  return errors
}

function parse(src: string) {
  return parser.parse(src)
}

/** Return the source text of the first node with the given name, or undefined. */
function firstNodeText(src: string, name: string): string | undefined {
  const tree = parse(src)
  let found: string | undefined
  tree.iterate({
    enter: (node) => {
      if (found === undefined && node.name === name) {
        found = src.slice(node.from, node.to)
      }
    },
  })
  return found
}

/** Collect all node names that appear in the tree (depth-first). */
function nodeNames(src: string): string[] {
  const tree = parse(src)
  const names: string[] = []
  tree.iterate({
    enter: (node) => {
      names.push(node.name)
    },
  })
  return names
}

describe('zenuml lezer grammar', () => {
  describe('no error nodes for valid inputs', () => {
    const validInputs: Array<[string, string]> = [
      ['multi-word async message', 'A->B: hello world from me'],
      ['participant declaration with color', '@Actor Client #FFEBE6'],
      ['sync message with block', 'A.method() {\n  B.x()\n}'],
      ['if block', 'if (x) {\n  A.b()\n}'],
      ['if/else block', 'if (x) {\n  A.b()\n} else {\n  A.c()\n}'],
      ['par block', 'par {\n  A.b()\n}'],
      ['while block', 'while (x) {\n  A.b()\n}'],
      ['opt block', 'opt {\n  A.b()\n}'],
      ['try/catch block', 'try {\n  A.b()\n} catch {\n  C.d()\n}'],
      ['try/catch/finally block', 'try {\n  A.b()\n} catch {\n  C.d()\n} finally {\n  E.f()\n}'],
      ['reply form (@Return)', '@Return B->A: done'],
      ['divider with text', '== Phase 2 =='],
      ['divider with colon and trailing ==', '== Phase 2: the hard part =='],
      ['title with trailing newline', 'title Hello\n@Actor A'],
      ['top-level message with trailing newline', 'A.b()\n'],
      ['blank line in block', 'A.b() {\n\n  C.d()\n}'],
      ['leading blank line before first statement', '\nA.b()'],
      ['leading comment line then statement', '// a sample\nA.b()'],
    ]

    it.each(validInputs)('parses %s with no error nodes', (_label, src) => {
      expect(errorRanges(src)).toEqual([])
    })
  })

  describe('AsyncMessage Content tokenization', () => {
    it('captures the full free-form line as a single Content node', () => {
      const src = 'A->B: hello world from me'
      expect(errorRanges(src)).toEqual([])
      // The whole message body (not just the first word) must be the Content.
      expect(firstNodeText(src, 'Content')).toBe('hello world from me')
    })

    it('Content wraps a LineContent token (node names downstream phases rely on)', () => {
      const names = nodeNames('A->B: hello world')
      expect(names).toContain('AsyncMessage')
      expect(names).toContain('Content')
      expect(names).toContain('LineContent')
    })

    it('a following newline ends the Content', () => {
      const src = 'A->B: hello world\nC->D: next line'
      expect(errorRanges(src)).toEqual([])
      // First Content stops at the newline; it does not swallow the next line.
      expect(firstNodeText(src, 'Content')).toBe('hello world')
    })

    it('handles content with punctuation and numbers', () => {
      const src = 'Client->Server: GET /api/v1/users 200'
      expect(errorRanges(src)).toEqual([])
      expect(firstNodeText(src, 'Content')).toBe('GET /api/v1/users 200')
    })
  })

  describe('Divider free-text', () => {
    it('tolerates arbitrary to-end-of-line text after ==', () => {
      const src = '== Phase 2: the hard part =='
      expect(errorRanges(src)).toEqual([])
      // The text after "==" (including the trailing ==) is one LineContent.
      expect(firstNodeText(src, 'LineContent')).toBe('Phase 2: the hard part ==')
    })

    it('produces a Divider node', () => {
      expect(nodeNames('== Setup ==')).toContain('Divider')
    })
  })

  describe('participant declaration', () => {
    it('parses @Type Name #Color into a sane Head/Participant tree', () => {
      const src = '@Actor Client #FFEBE6'
      expect(errorRanges(src)).toEqual([])
      const names = nodeNames(src)
      expect(names).toContain('Head')
      expect(names).toContain('Participant')
      expect(names).toContain('ParticipantType')
      expect(names).toContain('Color')
      // Guard against a nonsense parse: the color must be captured as Color,
      // and there must be exactly one Participant (not split into Messages).
      expect(firstNodeText(src, 'Color')).toBe('#FFEBE6')
      expect(names.filter((n) => n === 'Participant')).toHaveLength(1)
      expect(names).not.toContain('Message')
    })

    it('parses multiple participant declarations', () => {
      const src = '@Actor A\n@Boundary B'
      expect(errorRanges(src)).toEqual([])
      expect(nodeNames(src).filter((n) => n === 'Participant')).toHaveLength(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Documented PRE-EXISTING gaps, outside the Grammar phase's named defects.
  // These reproduce identically on the original grammar (verified by reverting
  // only the expression/Title/Block changes). They are recorded as `skip` so
  // they are visible and will flip to passing when a later phase fixes them,
  // without misreporting the current state of this phase.
  // ---------------------------------------------------------------------------
  describe('Head/Statement disambiguation (participant-vs-message)', () => {
    // Previously skipped: `Head { (Participant ST?)+ }` greedily absorbed a bare
    // message source ("A") as another Participant, then errored on "->". Fixed by
    // making Head reduce (rather than chain another Participant) when the trailing
    // identifier begins a Statement — the `!headReduce` precedence on Head's
    // repetition resolves the LR-boundary in favour of ending the Head, so the
    // message parses cleanly with zero error nodes (docs/adr/0002).
    it('Head followed by a message with a bare source', () => {
      expect(errorRanges('@Actor A\n@Boundary B\nA->B: msg')).toEqual([])
    })
  })

  describe('known pre-existing limitations (skipped)', () => {
    // `Signature`/`MethodName` only accept Identifier, so a quoted-string
    // method name (used by the shipped "blue"/"black-white" templates, e.g.
    // `SGW."Get order by id"`) is rejected.
    it.skip('quoted-string method name', () => {
      expect(errorRanges('A."do it"()')).toEqual([])
    })
  })

  describe('realistic full diagram', () => {
    // First-mention auto-declaration form (no explicit Head). This exercises
    // every construct the Grammar phase fixed — title, async Content, sync +
    // block, if/else, @Return reply, free-text divider, par/while/try-catch —
    // in one realistic >20-line diagram.
    //
    // NOTE: an explicit participant Head *immediately followed by messages*
    // (e.g. "@Actor A\nA->B: x") is NOT used here. That triggers a pre-existing
    // ambiguity where `Head { (Participant ST?)+ }` greedily absorbs the bare
    // message source ("A") as another participant, then errors on "->". That
    // defect is outside the five fixed in this phase and reproduces identically
    // on the original grammar (verified by reverting only the expression/Title
    // changes). It needs a Head/Statement disambiguation decision.
    const demo = `title Order Processing
Customer->Web: place order
Web.submitOrder(items) {
  OrderService.validate()
  if (valid) {
    OrderService->PaymentGateway: charge
    PaymentGateway->OrderService: ok
    @Return OrderService->Web: confirmed
  } else {
    OrderService->Web: rejected
  }
}
== Phase 2: fulfillment ==
par {
  Web.notify()
  Web.ship()
}
while (pending) {
  OrderService.poll()
}
try {
  Web.commit()
} catch {
  Web.rollback()
}`

    it('is at least 20 lines', () => {
      expect(demo.split('\n').length).toBeGreaterThanOrEqual(20)
    })

    it('parses with zero error nodes', () => {
      expect(errorRanges(demo)).toEqual([])
    })

    it('produces the expected top-level constructs', () => {
      const names = nodeNames(demo)
      expect(names).toContain('Title')
      expect(names).toContain('AsyncMessage')
      expect(names).toContain('Alternative')
      expect(names).toContain('Return')
      expect(names).toContain('Divider')
      expect(names).toContain('Parallel')
      expect(names).toContain('Loop')
      expect(names).toContain('TryCatchFinally')
    })
  })
})
