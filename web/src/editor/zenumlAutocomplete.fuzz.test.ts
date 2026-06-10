// Completion robustness fuzz. `zenumlCompletions` runs on EVERY keystroke through
// custom logic (resolveZone, atMessageEndpoint, isNamingDeclaration, the free-text
// guards). A throw there crashes the editor mid-type. This guard invokes completion at
// EVERY cursor offset of a diverse + adversarial corpus, both explicit and not, and
// asserts it never throws and always returns null or a well-formed result.

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LRLanguage, LanguageSupport } from '@codemirror/language'
import { CompletionContext } from '@codemirror/autocomplete'
import { parser } from './grammar/zenuml-parser.js'
import { zenumlParticipantField } from './participantManager'
import { zenumlCompletions } from './zenumlAutocomplete'

const zenumlLanguage = LRLanguage.define({ parser })
const zenuml = () => new LanguageSupport(zenumlLanguage)

function completeAt(doc: string, pos: number, explicit: boolean) {
  const state = EditorState.create({ doc, extensions: [zenuml(), zenumlParticipantField] })
  const ctx = new CompletionContext(state, pos, explicit)
  return zenumlCompletions(ctx)
}

// Diverse + adversarial inputs: valid shapes, half-typed, unclosed delimiters, garbage,
// unicode, deep nesting, mixed, and known edge tokens.
const CORPUS: string[] = [
  '',
  ' ',
  '\n\n\n',
  '@',
  '@Actor',
  '@Actor A',
  '@Actor A as "',
  '@Actor A as "unclosed',
  '<<',
  '<<svc',
  '<<svc>>',
  'group',
  'group {',
  'group G {',
  'A.',
  'A->',
  'A->B:',
  'A->B: hello world',
  'A->B: title screen while loading',
  'A."',
  'A."m',
  'A.b(',
  'A.b(1, "two", true,',
  'if (',
  'if (x) {',
  'try {',
  '} catch (',
  'return',
  'new ',
  'new A(',
  '= = =',
  '!!!@@@###',
  '{{{{{{',
  '))))))',
  '..::..',
  '@@@@@',
  '"""""',
  '用户->服务: 请求',
  '@Actor 用户 as "名字" #f00',
  'ifService.whileWorker(',
  'A.b() {\n  if (x) {\n    while (y) {\n      C.d()\n',
  'title 标题 while if for',
  '== divider : with colons ==',
  '// comment with /sync and @Actor inside',
  'async A->B',
  'loop (3) {',
  '@Starter(',
  'a = new B().c().d(',
  'A->B->C->D',
  'A as B as C',
  '@Actor\n@Actor\n@Actor',
  '\t\t\tA.b()',
  'A.b()A.c()A.d()',
]

describe('completion never throws (robustness fuzz)', () => {
  it('survives every cursor position of every corpus input, explicit and not', () => {
    let calls = 0
    for (const doc of CORPUS) {
      for (let pos = 0; pos <= doc.length; pos++) {
        for (const explicit of [false, true]) {
          calls++
          // Must not throw. Result must be null or a well-formed CompletionResult.
          const r = completeAt(doc, pos, explicit)
          if (r !== null) {
            expect(typeof r.from).toBe('number')
            expect(Array.isArray(r.options)).toBe(true)
            expect(r.from).toBeLessThanOrEqual(pos)
          }
        }
      }
    }
    // Sanity: we actually exercised a large surface.
    expect(calls).toBeGreaterThan(1000)
  })
})
