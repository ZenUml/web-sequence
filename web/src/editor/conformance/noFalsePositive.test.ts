// No-false-positive conformance: the editor's Lezer grammar must NOT emit error
// nodes on inputs the renderer (ANTLR) accepts. This is the property the disabled
// linter needs (modes.ts) — every Lezer error node on renderer-valid DSL is a
// false positive that would mislead the user. As grammar gaps close, this guard
// keeps them closed.
//
// Each VALID_INPUTS entry is a construct verified to parse with ZERO ANTLR errors
// (checked against the oracle during the campaign). A failure here = the editor
// grammar regressed or still under-accepts that construct.

import { describe, it, expect } from 'vitest'
import { parser } from '../grammar/zenuml-parser.js'

function lezerErrorCount(src: string): number {
  let errs = 0
  parser.parse(src).iterate({
    enter: (n) => {
      if (n.type.isError) errs++
    },
  })
  return errs
}

// Renderer-valid constructs (ANTLR parses each with 0 errors).
const VALID_INPUTS: Array<[string, string]> = [
  ['sync message', 'A.method()'],
  ['async message', 'A->B: hello'],
  ['sync with block', 'A.m() {\n  B.n()\n}'],
  ['annotated participant', '@Actor A'],
  ['participant + color', '@Actor A #FF0000'],
  ['string label', '@Actor A as "The User"'],
  ['string label + color', '@Actor A as "The User" #FF0000'],
  ['stereotype', '<<service>> A'],
  ['group', 'group G {\n  @Actor A\n  @Actor B\n}'],
  ['if', 'if (x) {\n  A.b()\n}'],
  ['if/else-if/else', 'if (x) {\n  A.b()\n} else if (y) {\n  A.c()\n} else {\n  A.d()\n}'],
  ['while', 'while (cond) {\n  A.b()\n}'],
  ['par', 'par {\n  A.b()\n}'],
  ['opt', 'opt {\n  A.b()\n}'],
  ['try/catch/finally', 'try {\n  A.b()\n} catch (e) {\n  C.d()\n} finally {\n  E.f()\n}'],
  ['critical', 'critical {\n  A.b()\n}'],
  ['section', 'section (name) {\n  A.b()\n}'],
  ['ref', 'ref (A, B)'],
  ['new', 'new A()'],
  ['assigned new', 'a = new A()'],
  ['assigned call', 'ret = A.compute()'],
  ['return', 'A.m() {\n  return x\n}'],
  ['reply', '@Return B->A: done'],
  ['title', 'title My Diagram'],
  ['divider', '== Divider =='],
  ['comment', '// a comment'],
  ['declare-then-message', '@Actor A\nA->B: msg'],
  ['multiple decls then msgs', '@Actor A\n@Actor B\nA->B: hi\nB->A: bye'],
  ['nested chained call', 'A.a().b()'],
  ['self message', 'A.m() {\n  A.self()\n}'],
  ['comment then message', '// note\nA->B: hi'],
  // i18n (closed by #809)
  ['chinese name', '用户->服务: 请求'],
  ['chinese method', 'A.方法()'],
  // quoted method name (closed by #810)
  ['quoted method', 'A."some method"()'],
  // ── Gaps under repair (#811): un-skip each as the grammar fix lands ──────────
  ['async prefix message', 'async A->B: msg'],
  ['loop keyword', 'loop (3) {\n  A.b()\n}'],
  ['starter with arg', '@Starter(A)\nA.b()'],
  ['method-arg literals', 'A.b(1, "two", true)'],
  // #812 — bare `return` with no value
  ['bare return', 'return'],
  ['bare return in block', 'A.b() {\n  return\n}'],
]

describe('no false positives — editor grammar accepts all renderer-valid DSL', () => {
  it.each(VALID_INPUTS)('parses %s with zero Lezer error nodes', (_label, src) => {
    expect(lezerErrorCount(src)).toBe(0)
  })
})
