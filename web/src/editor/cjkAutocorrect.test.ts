// Tests for CJK/full-width punctuation auto-correction.
//
// The free-text guard reads the Lezer syntax tree, so the state must carry the LR
// language (same harness pattern as zenumlAutocomplete.test.ts).

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { LRLanguage, LanguageSupport } from '@codemirror/language'
import { parser } from './grammar/zenuml-parser.js'
import { cjkPunctuationAutocorrect } from './cjkAutocorrect'

const lang = new LanguageSupport(LRLanguage.define({ parser }))

function stateFor(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [lang, cjkPunctuationAutocorrect] })
}

/** Type `insert` at `pos` as a user input event; return the resulting doc string. */
function type(doc: string, pos: number, insert: string, userEvent = 'input.type'): string {
  const tr = stateFor(doc).update({ changes: { from: pos, insert }, userEvent })
  return tr.state.doc.toString()
}

describe('cjkPunctuationAutocorrect', () => {
  describe('corrects in code positions', () => {
    it('。 → . after a participant (method-call dot)', () => {
      expect(type('Order', 5, '。')).toBe('Order.')
    })

    it('（） → () for an invocation', () => {
      // Type the two parens after `A.save`
      expect(type('A.save', 6, '（）')).toBe('A.save()')
    })

    it('： → : at a message boundary', () => {
      expect(type('A->B', 4, '：')).toBe('A->B:')
    })

    it('｛ → { opening a block', () => {
      expect(type('A.run() ', 8, '｛')).toBe('A.run() {')
    })

    it('， → , between method arguments', () => {
      expect(type('A.b(1', 5, '，')).toBe('A.b(1,')
    })

    it('＃ → # before a color', () => {
      expect(type('@Actor A ', 9, '＃')).toBe('@Actor A #')
    })

    it('corrects a whole pasted run of full-width punctuation in code', () => {
      expect(type('A', 1, '。b（）', 'input.paste')).toBe('A.b()')
    })
  })

  describe('preserves CJK punctuation in free-text', () => {
    it('keeps 。 inside a message label', () => {
      // `A->B: 你好` then type `。` at the end (inside the Content label).
      expect(type('A->B: 你好', 'A->B: 你好'.length, '。')).toBe('A->B: 你好。')
    })

    it('keeps 。 inside a title', () => {
      expect(type('title 标题', 'title 标题'.length, '。')).toBe('title 标题。')
    })

    it('keeps 。 inside a comment', () => {
      expect(type('// 注释', '// 注释'.length, '。')).toBe('// 注释。')
    })

    it('keeps （ inside a quoted string label', () => {
      // Inside `as "..."` the string content is free text.
      const doc = '@Actor A as "标签'
      expect(type(doc, doc.length, '（')).toBe('@Actor A as "标签（')
    })
  })

  describe('only acts on user input', () => {
    it('does NOT correct a programmatic (non-user) change', () => {
      // No userEvent → not user input → left as-is.
      const tr = stateFor('Order').update({ changes: { from: 5, insert: '。' } })
      expect(tr.state.doc.toString()).toBe('Order。')
    })

    it('leaves ASCII input untouched', () => {
      expect(type('Order', 5, '.')).toBe('Order.')
    })

    it('leaves non-punctuation CJK (letters) untouched in code', () => {
      expect(type('', 0, '用户')).toBe('用户')
    })
  })
})
