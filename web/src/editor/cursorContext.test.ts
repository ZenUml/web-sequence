import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LRLanguage, LanguageSupport, ensureSyntaxTree } from '@codemirror/language'
import { parser } from './grammar/zenuml-parser.js'
import { isFreeTextSpan, isInsideMessageContent, isNamingDeclaration, resolveZone } from './cursorContext'
import completionSource from './zenumlAutocomplete.ts?raw'
import autocorrectSource from './cjkAutocorrect.ts?raw'

const zenuml = () => new LanguageSupport(LRLanguage.define({ parser }))

// `|` marks the cursor.
function at(docWithCursor: string): [EditorState, number] {
  const pos = docWithCursor.indexOf('|')
  const doc = docWithCursor.replace('|', '')
  const state = EditorState.create({ doc, extensions: [zenuml()] })
  if (!ensureSyntaxTree(state, state.doc.length, 5000)) throw new Error('parse did not finish')
  return [state.update({}).state, pos]
}

describe('cursorContext module boundary (#903)', () => {
  it('completion and autocorrect do not import each other', () => {
    expect(completionSource).not.toMatch(/from '\.\/cjkAutocorrect'/)
    expect(autocorrectSource).not.toMatch(/from '\.\/zenumlAutocomplete'/)
  })
})

// Behaviour is pinned by zenumlAutocomplete*.test.ts and cjkAutocorrect.test.ts,
// which stay unchanged. These cases only show each classifier from its new home.
describe('cursor classifiers', () => {
  it('isFreeTextSpan: a message label is free text, an endpoint is not', () => {
    expect(isFreeTextSpan(...at('A->B: hel|lo'))).toBe(true)
    expect(isFreeTextSpan(...at('A->B|: hello'))).toBe(false)
  })

  it('resolveZone: head, block and top', () => {
    expect(resolveZone(...at('|'))).toBe('top')
    expect(resolveZone(...at('A.m() {\n  |\n}'))).toBe('block')
  })

  it('isNamingDeclaration: the name slot after an annotation', () => {
    expect(isNamingDeclaration(...at('@Actor a|'))).toBe(true)
    expect(isNamingDeclaration(...at('a|'))).toBe(false)
  })

  it('isInsideMessageContent: an async message counts, a sync call does not', () => {
    expect(isInsideMessageContent(...at('A->B: hi|'))).toBe(true)
    expect(isInsideMessageContent(...at('A.m|()'))).toBe(false)
  })
})
