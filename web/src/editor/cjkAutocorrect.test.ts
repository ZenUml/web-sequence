// Tests for CJK/full-width punctuation auto-correction.
//
// HARNESS NOTE (product decisions, TEST_TREES.md 2026-06-10): the autocorrect moved from
// an EditorState transactionFilter to an EditorView.updateListener — D2 requires the
// typed original to enter the document + history BEFORE the correction lands as its own
// isolated step, and a filter rewrites before anything enters history. The harness
// therefore drives a real EditorView in jsdom (dispatch-level behavior works there).
//  - zenumlSupport() supplies the Lezer tree AND the language's closeBrackets config
//    (brackets ['(','{','"'] — same data the production editor reads), so D3 pairing
//    decisions here match the real editor, including the D4 exclusion of `[`/`'`.
//  - closeBrackets() mirrors basicSetup's `closeBrackets: true` — D3's type-over rides
//    its pending-closer state field.
//  - history() backs the D2 undo/redo contract tests.

import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { history, undo, redo } from '@codemirror/commands'
import { closeBrackets, deleteBracketPair } from '@codemirror/autocomplete'
import { zenumlSupport } from './zenumlLanguage'
import { cjkPunctuationAutocorrect } from './cjkAutocorrect'

function makeView(doc: string, anchor = 0): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor },
      extensions: [zenumlSupport(), closeBrackets(), history(), cjkPunctuationAutocorrect],
    }),
  })
}

/** Poll until `fn()` is true (or ~1s passes) — for the deferred composition flush. */
async function waitFor(fn: () => boolean): Promise<void> {
  const start = Date.now()
  while (!fn() && Date.now() - start < 1000) {
    await new Promise((r) => setTimeout(r, 10))
  }
}

/**
 * Type `insert` at `pos` as one user input event — cursor placed after the inserted
 * text, like a real typing/paste transaction — and return the resulting doc string.
 */
function type(doc: string, pos: number, insert: string, userEvent = 'input.type'): string {
  const view = makeView(doc, pos)
  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length },
    userEvent,
  })
  const text = view.state.doc.toString()
  view.destroy()
  return text
}

describe('cjkPunctuationAutocorrect', () => {
  describe('corrects in code positions', () => {
    it('。 → . after a participant (method-call dot)', () => {
      expect(type('Order', 5, '。')).toBe('Order.')
    })

    it('（） → () for an invocation (two-char run: corrected, NOT paired)', () => {
      // Type the two parens after `A.save` in one input — a run, so D3 pairing stays out.
      expect(type('A.save', 6, '（）')).toBe('A.save()')
    })

    it('： → : at a message boundary', () => {
      expect(type('A->B', 4, '：')).toBe('A->B:')
    })

    // D3 (TEST_TREES.md decisions): corrected openers now pair — the lone `｛` corrects
    // to `{` AND injects the matching `}` with the cursor inside, like ASCII autopair.
    it('｛ → { opening a block auto-pairs the closer', () => {
      expect(type('A.run() ', 8, '｛')).toBe('A.run() {}')
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

    // `→` → `->` is the map's only 1→2 replacement (feature, TEST_TREES.md gap 19 /
    // TT-A9 class): an IME arrow candidate becomes the DSL's two-char arrow, and the
    // selection mapping must land the cursor AFTER the `->`, not between `-` and `>`.
    it('→ corrects to -> in a code position', () => {
      expect(type('A', 1, '→')).toBe('A->')
    })

    it('→ correction moves the typing cursor past the inserted ->', () => {
      const view = makeView('A', 1)
      view.dispatch({
        changes: { from: 1, insert: '→' },
        selection: { anchor: 2 }, // where a real typing transaction puts the cursor
        userEvent: 'input.type',
      })
      expect(view.state.doc.toString()).toBe('A->')
      expect(view.state.selection.main.head).toBe(3) // after `->`, shifted by the remap
      view.destroy()
    })

    it('→ corrects inside a pasted mixed run (with the cursor shift compounding)', () => {
      expect(type('A', 1, '→B：hi', 'input.paste')).toBe('A->B:hi')
    })
  })

  describe('preserves CJK punctuation in free-text', () => {
    it('keeps → inside a message label (no arrow correction in free text)', () => {
      expect(type('A->B: x', 'A->B: x'.length, '→')).toBe('A->B: x→')
    })

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
      const view = makeView('Order', 5)
      view.dispatch({ changes: { from: 5, insert: '。' } })
      expect(view.state.doc.toString()).toBe('Order。')
      view.destroy()
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
    it('『』 → {} opening / closing a block', () => {
      // D3 (TEST_TREES.md decisions): corrected openers now pair — the lone `『`
      // corrects to `{` and injects the `}`.
      expect(type('A.run() ', 8, '『')).toBe('A.run() {}')
      // A corrected `』` with no pending injected closer inserts a plain `}`.
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

  // ── D2: undo restores the typed original (TEST_TREES.md product decisions) ───
  // The correction is its OWN history-isolated step: the FIRST undo brings back the
  // literal char the user typed; the SECOND removes it. Redo replays symmetrically.
  // Undo/redo transactions themselves are never re-corrected (invariant 5).
  describe('D2 — undo restores the typed original; redo symmetric', () => {
    it('。 → . : undo #1 restores 。, undo #2 removes it; redo replays both', () => {
      const view = makeView('Order', 5)
      view.dispatch({ changes: { from: 5, insert: '。' }, selection: { anchor: 6 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('Order.')
      undo(view)
      expect(view.state.doc.toString()).toBe('Order。') // the typed original is back
      undo(view)
      expect(view.state.doc.toString()).toBe('Order') // and now it is gone
      redo(view)
      expect(view.state.doc.toString()).toBe('Order。') // redo #1: original re-typed
      redo(view)
      expect(view.state.doc.toString()).toBe('Order.') // redo #2: correction re-applied
      view.destroy()
    })

    it('→ → -> : undo #1 restores →, undo #2 removes it', () => {
      const view = makeView('A', 1)
      view.dispatch({ changes: { from: 1, insert: '→' }, selection: { anchor: 2 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A->')
      undo(view)
      expect(view.state.doc.toString()).toBe('A→')
      undo(view)
      expect(view.state.doc.toString()).toBe('A')
      view.destroy()
    })

    it('（ → () pairing (D3) is still ONE correction step: undo #1 restores （', () => {
      const view = makeView('A.save', 6)
      view.dispatch({ changes: { from: 6, insert: '（' }, selection: { anchor: 7 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A.save()')
      undo(view)
      expect(view.state.doc.toString()).toBe('A.save（')
      undo(view)
      expect(view.state.doc.toString()).toBe('A.save')
      view.destroy()
    })
  })

  // ── D1: composition-safe (TEST_TREES.md product decisions) ────────────────────
  // Never rewrite while an IME composition session is active; the correction applies
  // when the composed text commits. The synthetic events drive CodeMirror's real
  // composition bookkeeping (view.compositionStarted) — the same signal the listener
  // gates on in a live browser.
  describe('D1 — no rewrite during composition; correct on commit', () => {
    it('compose-flagged input mid-session is untouched; commit applies the correction', async () => {
      const view = makeView('Order', 5)
      view.contentDOM.dispatchEvent(new Event('compositionstart'))
      view.dispatch({
        changes: { from: 5, insert: '。' },
        selection: { anchor: 6 },
        userEvent: 'input.type.compose',
      })
      // Session still open — the IME owns this text; it must NOT be rewritten yet.
      expect(view.state.doc.toString()).toBe('Order。')
      view.contentDOM.dispatchEvent(new Event('compositionend'))
      // The commit flush is deferred past CodeMirror's own compositionend bookkeeping.
      await waitFor(() => view.state.doc.toString() === 'Order.')
      expect(view.state.doc.toString()).toBe('Order.')
      view.destroy()
    })

    it('a compose-flagged change landing AFTER compositionend corrects immediately', () => {
      // CodeMirror flags the change that flushes right after compositionend as
      // input.type.compose (compositionPendingChange path); the session is already
      // over, so this IS the commit and corrects synchronously.
      const view = makeView('Order', 5)
      view.contentDOM.dispatchEvent(new Event('compositionstart'))
      view.contentDOM.dispatchEvent(new Event('compositionend'))
      view.dispatch({
        changes: { from: 5, insert: '。' },
        selection: { anchor: 6 },
        userEvent: 'input.type.compose',
      })
      expect(view.state.doc.toString()).toBe('Order.')
      view.destroy()
    })

    it('a multi-step composition accumulates and corrects the whole committed text', async () => {
      const view = makeView('A', 1)
      view.contentDOM.dispatchEvent(new Event('compositionstart'))
      // IME builds the text incrementally (each step is a minimal diff, like a real
      // composition session: '－' then '－＞').
      view.dispatch({
        changes: { from: 1, insert: '－' },
        selection: { anchor: 2 },
        userEvent: 'input.type.compose',
      })
      view.dispatch({
        changes: { from: 2, insert: '＞' },
        selection: { anchor: 3 },
        userEvent: 'input.type.compose',
      })
      expect(view.state.doc.toString()).toBe('A－＞') // untouched mid-session
      view.contentDOM.dispatchEvent(new Event('compositionend'))
      await waitFor(() => view.state.doc.toString() === 'A->')
      expect(view.state.doc.toString()).toBe('A->')
      view.destroy()
    })

    it('composed text committed inside a label stays untouched after the flush', async () => {
      const view = makeView('A->B: ', 6)
      view.contentDOM.dispatchEvent(new Event('compositionstart'))
      view.dispatch({
        changes: { from: 6, insert: '你好。' },
        selection: { anchor: 9 },
        userEvent: 'input.type.compose',
      })
      view.contentDOM.dispatchEvent(new Event('compositionend'))
      // Asserting NO change: this 90ms timer is registered after the flush's 60ms timer,
      // so by due-time ordering it always runs after the flush had its chance.
      await new Promise((r) => setTimeout(r, 90))
      expect(view.state.doc.toString()).toBe('A->B: 你好。')
      view.destroy()
    })
  })

  // ── D3: corrected openers auto-pair (TEST_TREES.md product decisions) ─────────
  // A corrected lone opener routes through closeBrackets' insertBracket: closer
  // injected, cursor inside, pending-closer state set — so type-over and pair-delete
  // behave exactly like ASCII autopair. Runs (paste) never pair.
  describe('D3 — corrected openers pair; type-over and pair-delete work', () => {
    it('（ corrected at a code position injects ) with the cursor inside', () => {
      const view = makeView('A.save', 6)
      view.dispatch({ changes: { from: 6, insert: '（' }, selection: { anchor: 7 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A.save()')
      expect(view.state.selection.main.head).toBe(7) // inside the pair
      view.destroy()
    })

    it('a subsequently typed ） types OVER the injected closer (no doubling)', () => {
      const view = makeView('A.save', 6)
      view.dispatch({ changes: { from: 6, insert: '（' }, selection: { anchor: 7 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A.save()')
      // The user hand-closes with the full-width ）: corrected to ) and consumed by the
      // pending-closer state — the text must not gain a second closer.
      view.dispatch({ changes: { from: 7, insert: '）' }, selection: { anchor: 8 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A.save()')
      expect(view.state.selection.main.head).toBe(8) // moved past the closer
      view.destroy()
    })

    it('Backspace between the corrected pair deletes both (deleteBracketPair)', () => {
      const view = makeView('A.save', 6)
      view.dispatch({ changes: { from: 6, insert: '（' }, selection: { anchor: 7 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A.save()')
      deleteBracketPair(view)
      expect(view.state.doc.toString()).toBe('A.save')
      view.destroy()
    })

    it('a pasted lone opener does NOT pair (runs are corrected verbatim)', () => {
      expect(type('A.save', 6, '（', 'input.paste')).toBe('A.save(')
    })

    it('［ → [ does not pair — [ is excluded from closeBrackets (D4)', () => {
      expect(type('A.b', 3, '［')).toBe('A.b[')
    })

    it('a corrected opener directly before a word char does not pair (ASCII parity)', () => {
      // ASCII closeBrackets declines to pair when the next char is a word char; the
      // corrected opener must behave identically.
      const view = makeView('A.savex', 2) // cursor between `A.` and `savex`
      view.dispatch({ changes: { from: 2, insert: '（' }, selection: { anchor: 3 }, userEvent: 'input.type' })
      expect(view.state.doc.toString()).toBe('A.(savex')
      view.destroy()
    })
  })

  // ── TT-I14: paste per-region classification (TEST_TREES.md product decisions) ─
  // Classification happens per char of the pasted content against the POST-INSERT
  // parse — a mixed multi-line paste keeps free-text 。 and corrects code 。.
  describe('TT-I14 — mixed multi-line paste classifies per region', () => {
    it('label 。 preserved, code-line 。 corrected, in one paste', () => {
      expect(type('', 0, 'A->B: 你好。\nC。d（）', 'input.paste')).toBe('A->B: 你好。\nC.d()')
    })

    it('paste at a code position still preserves a later pasted label', () => {
      expect(type('X', 1, '。run（）\nA->B: 等待。', 'input.paste')).toBe('X.run()\nA->B: 等待。')
    })

    it('pasted comment line keeps its 。 while the code line corrects', () => {
      expect(type('', 0, '// 备注。\nA。b（）', 'input.paste')).toBe('// 备注。\nA.b()')
    })
  })

  // ── D7: bare method-name slot is CODE for autocorrect (TEST_TREES.md decisions) ─
  // INTENDED asymmetry with completion: completion suppresses the post-dot popup
  // (76bddeb — any method name is valid, nothing to offer) but autocorrect still
  // treats the slot as code, because the grammar's Identifier cannot hold full-width
  // punctuation. The quoted method name `A."…"()` is the preserved escape hatch.
  describe('D7 — method-name slot: code for autocorrect, asymmetric with completion', () => {
    it('。 typed in the bare method-name slot corrects (slot is code)', () => {
      expect(type('A.pay', 5, '。')).toBe('A.pay.')
    })

    it('the quoted method-name escape hatch preserves CJK punctuation', () => {
      // The real typed flow: `"` after `A.` auto-pairs to `A.""` and the user types
      // INSIDE the closed string. (A dangling-unclosed `A."支付` has no String node in
      // the editor grammar's error recovery — the same under-acceptance documented in
      // modes.ts — so the closed form is the guaranteed escape hatch.)
      expect(type('A."支付"', 5, '。')).toBe('A."支付。"')
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

  // D3 (TEST_TREES.md decisions): corrected openers now pair — a lone TYPED fullwidth
  // opener corrects to its ASCII form AND injects the matching closer (only for the
  // brackets in the language's closeBrackets config: `(` and `{`; `[`/`'` stay
  // unpaired per D4, and `"` after a word char declines like ASCII).
  const PAIRS_ON_CORRECTION: Record<string, string> = {
    '（': '()', // U+FF08
    '｛': '{}', // U+FF5B
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

    // #815 TT-A22 (TEST_TREES.md): FIXED — ＇ ［ ］ ＿ joined the map, so the
    // independent table now holds for the WHOLE punctuation subset, no exclusions.
    it('every fullwidth punctuation char corrects to cp − 0xFEE0 (openers pair, D3)', () => {
      for (const ch of punctuation) {
        const expected = PAIRS_ON_CORRECTION[ch] ?? toAscii(ch)
        expect(
          type('Order', 5, ch),
          `U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch} should correct to ${expected}`,
        ).toBe('Order' + expected)
      }
    })

    // Regression guard for #815 specifically (subsumed by the enumeration above,
    // kept as the named record of the gap class).
    it('＇ ［ ］ ＿ correct to their ASCII counterparts (#815)', () => {
      for (const ch of ['＇', '［', '］', '＿']) {
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
    // D3 (TEST_TREES.md decisions): corrected openers now pair — `｟ 『 〖` correct
    // to `(`/`{` and inject the closer; `【〔` map to the unpaired `[` (D4).
    const CJK_EXPECTED: Array<[string, string]> = [
      ['。', '.'], // U+3002 ideographic full stop
      ['｡', '.'], // U+FF61 halfwidth ideographic full stop
      ['、', ','], // U+3001 ideographic comma
      ['､', ','], // U+FF64 halfwidth ideographic comma
      ['｟', '()'], // U+FF5F fullwidth white parenthesis — pairs (D3)
      ['｠', ')'], // U+FF60
      ['〈', '<'], // U+3008 angle bracket
      ['〉', '>'], // U+3009
      ['《', '<'], // U+300A double angle bracket
      ['》', '>'], // U+300B
      ['『', '{}'], // U+300E white corner bracket — pairs (D3)
      ['』', '}'], // U+300F
      ['〖', '{}'], // U+3016 white lenticular bracket — pairs (D3)
      ['〗', '}'], // U+3017
      ['【', '['], // U+3010 black lenticular bracket
      ['】', ']'], // U+3011
      ['〔', '['], // U+3014 tortoise shell bracket
      ['〕', ']'], // U+3015
      ['“', '"'], // U+201C curly double quotes (no pair after a word char — ASCII parity)
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
