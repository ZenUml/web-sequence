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

  describe('full-width space and digits (similar cases)', () => {
    it('　 (full-width space) → ASCII space between code tokens', () => {
      expect(type('A', 1, '　B')).toBe('A B')
    })
    it('full-width digits → ASCII digits in a method arg', () => {
      expect(type('A.b(', 4, '１２３')).toBe('A.b(123')
    })
    it('preserves full-width digits inside a label', () => {
      const doc = 'A->B: 第'
      expect(type(doc, doc.length, '１章')).toBe('A->B: 第１章')
    })
  })


  describe('empty free-text regions (first label/title char)', () => {
    it('preserves 。 typed as the FIRST char of a message label', () => {
      expect(type('A->B: ', 'A->B: '.length, '。')).toBe('A->B: 。')
    })
    it('preserves 。 typed immediately after the message colon', () => {
      expect(type('A->B:', 5, '。')).toBe('A->B:。')
    })
    it('preserves 。 typed as the FIRST char of a title', () => {
      expect(type('title ', 'title '.length, '。')).toBe('title 。')
    })
    it('still corrects 。 in the To-endpoint region (before the colon)', () => {
      // Before the `:` is code (the To endpoint), so punctuation is corrected there.
      expect(type('A->', 3, '。')).toBe('A->.')
    })
  })


  describe('CJK corner/lenticular brackets → braces', () => {
    it('『』 → {} opening a block', () => {
      expect(type('A.run() ', 8, '『')).toBe('A.run() {')
      expect(type('A.run() {\n  B.c()\n', 'A.run() {\n  B.c()\n'.length, '』')).toBe('A.run() {\n  B.c()\n}')
    })
    it('preserves 『』 inside a message label', () => {
      const doc = 'A->B: 引用'
      expect(type(doc, doc.length, '『内容』')).toBe('A->B: 引用『内容』')
    })
  })


  describe('full-width period variants', () => {
    it('．(U+FF0E) → . like 。(U+3002)', () => {
      expect(type('Order', 5, '．')).toBe('Order.')
    })
    it('halfwidth katakana ｡ → . and ､ → ,', () => {
      expect(type('A.b(1', 5, '､')).toBe('A.b(1,')
      expect(type('Order', 5, '｡')).toBe('Order.')
    })
  })


  // ── Anti-mirroring enumeration (TT-A22) ────────────────────────────────────
  // Every expectation below is derived INDEPENDENTLY from the Unicode Halfwidth
  // and Fullwidth Forms block (U+FF01–FF5E are the fullwidth variants of ASCII
  // U+0021–U+007E at a fixed offset of 0xFEE0) plus the CJK punctuation set —
  // NOT from the shipped CJK_TO_ASCII map. One-test-per-mapped-char mirrors the
  // implementation table (the 6eadee8 class); this enumeration catches chars the
  // map silently omits. All chars are typed at a code position (after `Order`).

  /** ASCII counterpart of a fullwidth char per the Unicode block layout. */
  const toAscii = (ch: string) => String.fromCodePoint(ch.codePointAt(0)! - 0xfee0)

  /** Fullwidth chars in [from, to] (inclusive codepoints). */
  const fullwidthRange = (from: number, to: number): string[] => {
    const out: string[] = []
    for (let cp = from; cp <= to; cp++) out.push(String.fromCodePoint(cp))
    return out
  }

  describe('anti-mirroring enumeration: fullwidth ASCII variants (U+FF01–FF5E)', () => {
    // The full punctuation subset of the block: everything that is not a
    // fullwidth digit (FF10–FF19) or letter (FF21–FF3A, FF41–FF5A).
    const isLetter = (cp: number) => (cp >= 0xff21 && cp <= 0xff3a) || (cp >= 0xff41 && cp <= 0xff5a)
    const isDigit = (cp: number) => cp >= 0xff10 && cp <= 0xff19
    const punctuation = fullwidthRange(0xff01, 0xff5e).filter((ch) => {
      const cp = ch.codePointAt(0)!
      return !isLetter(cp) && !isDigit(cp)
    })

    // CANDIDATE BUG #815 TT-A22 (TEST_TREES.md): four fullwidth punctuation chars are
    // NOT corrected at HEAD — ＇ U+FF07 (→ '), ［ U+FF3B (→ [), ］ U+FF3D (→ ]),
    // ＿ U+FF3F (→ _) — even though the map corrects their close siblings
    // (‘’ → ', 【】〔〕 → [], and the grammar's Identifier does NOT accept ＿ the
    // way it accepts fullwidth letters). it.fails documents the divergence from
    // the independent table; flip into the green test when the map is completed.
    const DIVERGENT_AT_HEAD = new Set(['＇', '［', '］', '＿'])

    it('every fullwidth punctuation char (except known-divergent) corrects to cp − 0xFEE0', () => {
      for (const ch of punctuation) {
        if (DIVERGENT_AT_HEAD.has(ch)) continue
        expect(
          type('Order', 5, ch),
          `U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch} should correct to ${toAscii(ch)}`,
        ).toBe('Order' + toAscii(ch))
      }
    })

    it.fails('＇ ［ ］ ＿ correct to their ASCII counterparts (divergent at HEAD — see comment)', () => {
      for (const ch of DIVERGENT_AT_HEAD) {
        expect(
          type('Order', 5, ch),
          `U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch} should correct to ${toAscii(ch)}`,
        ).toBe('Order' + toAscii(ch))
      }
    })

    it('fullwidth digits ０–９ correct to ASCII digits', () => {
      for (const ch of fullwidthRange(0xff10, 0xff19)) {
        expect(type('Order', 5, ch), `${ch} should correct to ${toAscii(ch)}`).toBe('Order' + toAscii(ch))
      }
    })

    it('fullwidth letters Ａ–Ｚ ａ–ｚ are deliberately preserved (grammar Identifier accepts them, #809)', () => {
      for (const ch of [...fullwidthRange(0xff21, 0xff3a), ...fullwidthRange(0xff41, 0xff5a)]) {
        expect(type('Order', 5, ch), `${ch} must be preserved`).toBe('Order' + ch)
      }
    })
  })

  describe('anti-mirroring enumeration: CJK punctuation set', () => {
    // Independent table: CJK punctuation a Chinese/Japanese IME produces where
    // ZenUML syntax needs ASCII. Corner brackets 「」 (and their halfwidth twins
    // ｢｣) are CJK quotation marks for prose — deliberately PRESERVED, not braces.
    const CJK_EXPECTED: Array<[string, string]> = [
      ['。', '.'], // U+3002 ideographic full stop
      ['｡', '.'], // U+FF61 halfwidth ideographic full stop
      ['、', ','], // U+3001 ideographic comma
      ['､', ','], // U+FF64 halfwidth ideographic comma
      ['｟', '('], // U+FF5F fullwidth white parenthesis
      ['｠', ')'], // U+FF60
      ['〈', '<'], // U+3008 angle bracket
      ['〉', '>'], // U+3009
      ['《', '<'], // U+300A double angle bracket
      ['》', '>'], // U+300B
      ['『', '{'], // U+300E white corner bracket
      ['』', '}'], // U+300F
      ['〖', '{'], // U+3016 white lenticular bracket
      ['〗', '}'], // U+3017
      ['【', '['], // U+3010 black lenticular bracket
      ['】', ']'], // U+3011
      ['〔', '['], // U+3014 tortoise shell bracket
      ['〕', ']'], // U+3015
      ['“', '"'], // U+201C curly double quotes
      ['”', '"'], // U+201D
      ['‘', "'"], // U+2018 curly single quotes
      ['’', "'"], // U+2019
      ['　', ' '], // U+3000 ideographic space
    ]

    it('each CJK punctuation char corrects to its ASCII counterpart in a code position', () => {
      for (const [ch, ascii] of CJK_EXPECTED) {
        expect(
          type('Order', 5, ch),
          `U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch} should correct to ${ascii}`,
        ).toBe('Order' + ascii)
      }
    })

    it('corner brackets 「」 / ｢｣ are deliberately preserved even in code positions', () => {
      for (const ch of ['「', '」', '｢', '｣']) {
        expect(type('Order', 5, ch), `${ch} must be preserved`).toBe('Order' + ch)
      }
    })
  })

})
