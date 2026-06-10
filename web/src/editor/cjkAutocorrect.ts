// CJK / full-width punctuation auto-correction for the ZenUML DSL editor.
//
// A user typing with a Chinese (or Japanese/Korean) IME constantly produces full-width
// punctuation by accident — `。，：；（）｛｝＃＠` etc. — where ZenUML's syntax needs the
// ASCII forms (`.` for method calls, `()` for invocations, `:` for message labels, `{}`
// for blocks…). Without correction, `订单服务。save（）` fails to parse and the diagram
// breaks, even though the user "typed the right thing" in their IME.
//
// This auto-corrects those characters to ASCII AS THEY ARE TYPED — but ONLY in code
// positions. Inside a free-text span (a message/title/divider LABEL, a string, or a
// comment) CJK punctuation is legitimate content (a Chinese label `创建订单。` must keep
// its `。`), so it is left untouched. The free-text detection mirrors the completion
// guard in zenumlAutocomplete.ts (#813).
//
// Implemented as a transactionFilter (not an inputHandler) so it is robust to IME-
// committed input: a transactionFilter sees every document change, whereas an
// inputHandler can be bypassed by composition.

import {
  EditorSelection,
  EditorState,
  Transaction,
  type Extension,
  type TransactionSpec,
} from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// Full-width / CJK punctuation → ASCII. Almost every entry is 1 codepoint → 1 codepoint;
// the lone exception is `→` → `->` (1 → 2). When any replacement changes length, the
// filter re-maps the selection explicitly (see the delta logic below) instead of relying
// on positions being preserved.
const CJK_TO_ASCII: Record<string, string> = {
  // Periods: ideographic (U+3002), fullwidth (U+FF0E), halfwidth katakana (U+FF61).
  '。': '.',
  '．': '.',
  '｡': '.',
  // Commas: fullwidth (U+FF0C), ideographic (U+3001), halfwidth katakana (U+FF64).
  '，': ',',
  '、': ',',
  '､': ',',
  '；': ';',
  '：': ':',
  '（': '(',
  '）': ')',
  // Fullwidth white parentheses (U+FF5F/FF60).
  '｟': '(',
  '｠': ')',
  // Angle brackets (U+3008/3009) — for stereotypes `<<…>>` / comparisons.
  '〈': '<',
  '〉': '>',
  '｛': '{',
  '｝': '}',
  // White corner brackets — a CJK user reaches for these as block braces.
  '『': '{',
  '』': '}',
  '【': '[',
  '】': ']',
  '〔': '[',
  '〕': ']',
  // Fullwidth square brackets (U+FF3B/FF3D) — siblings of 【】〔〕 above (#815).
  '［': '[',
  '］': ']',
  '〖': '{',
  '〗': '}',
  '＜': '<',
  '＞': '>',
  '《': '<',
  '》': '>',
  '“': '"',
  '”': '"',
  '＂': '"',
  '‘': "'",
  '’': "'",
  // Fullwidth apostrophe (U+FF07) — sibling of ‘’ above (#815).
  '＇': "'",
  '＃': '#',
  '＠': '@',
  '＝': '=',
  '－': '-',
  '＋': '+',
  '＊': '*',
  '／': '/',
  '％': '%',
  '＆': '&',
  '！': '!',
  '？': '?',
  '｜': '|',
  '～': '~',
  '＄': '$',
  '＾': '^',
  '｀': '`',
  '＼': '\\',
  // Fullwidth low line (U+FF3F) — unlike fullwidth LETTERS, the grammar's Identifier
  // does NOT accept U+FF3F, so an uncorrected ＿ inside an identifier breaks the
  // parse (#815).
  '＿': '_',
  // Rightwards arrow (U+2192) — what an IME's "→" candidate or a symbol picker emits
  // where the DSL needs the two-char `->`. The ONLY multi-char replacement in the map;
  // the filter's selection remap below keeps the cursor after the inserted `->`.
  '→': '->',
  // Ideographic (full-width) space — between code tokens it is not whitespace to the
  // lexer and breaks the parse; ASCII-space it. (In a label it is preserved.)
  '　': ' ',
  // Full-width digits (method args, widths). Full-width LETTERS are NOT here — the
  // grammar's Identifier already accepts them (#809), so they parse as-is.
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
}

function hasCjkPunct(text: string): boolean {
  for (const ch of text) if (Object.prototype.hasOwnProperty.call(CJK_TO_ASCII, ch)) return true
  return false
}

function remap(text: string): string {
  let out = ''
  for (const ch of text) out += CJK_TO_ASCII[ch] ?? ch
  return out
}

// True when `pos` sits in a free-text span where CJK punctuation is intentional content:
// a message/title/divider LABEL (`Content`/`LineContent`), a quoted `String`, or a
// `Comment`. Same span set the completion logic treats as free text (#813).
export function isFreeTextSpan(state: EditorState, pos: number): boolean {
  for (
    let n: ReturnType<typeof syntaxTree>['topNode'] | null = syntaxTree(state).resolveInner(pos, -1);
    n;
    n = n.parent
  ) {
    const nm = n.name
    // `Label` covers an in-progress alias `as "标签` whose unclosed string error-recovers
    // to an Identifier under Label rather than a complete `String` node (mirrors #813).
    if (
      nm === 'Content' ||
      nm === 'LineContent' ||
      nm === 'String' ||
      nm === 'Comment' ||
      nm === 'Label'
    )
      return true
    // EMPTY free-text regions, where the Content/LineContent node does not exist yet
    // (the user is typing the FIRST char of a label/title). Distinguish the label
    // region from the From/To endpoints (both live under AsyncMessage) by the Colon:
    // the cursor is in the label only once it is PAST the message's `:`.
    if (nm === 'AsyncMessage') {
      const colon = n.getChild('Colon')
      if (colon && pos > colon.from) return true
    }
    // Title text begins after the `title` keyword.
    if (nm === 'Title') {
      const kw = n.getChild('TitleKeyword')
      if (kw && pos > kw.to) return true
    }
    // Divider text (`== … ==`) is free text throughout.
    if (nm === 'Divider') return true
  }
  return false
}

/**
 * Editor extension: auto-correct full-width/CJK punctuation to ASCII on user input,
 * except inside free-text spans. Wire this into the DSL language extension only.
 */
export const cjkPunctuationAutocorrect: Extension = EditorState.transactionFilter.of(
  (tr): Transaction | readonly TransactionSpec[] => {
    if (!tr.docChanged) return tr
    // Only correct genuine typing/paste — never programmatic edits, undo/redo, etc.
    if (!(tr.isUserEvent('input') || tr.isUserEvent('paste'))) return tr

    let changed = false
    const specs: { from: number; to: number; insert: string }[] = []
    // Length deltas of remapped inserts, keyed by the insert's END position in the
    // ORIGINAL transaction's new-doc coords (toB). Almost every remap is 1:1 (delta 0);
    // `→` → `->` is +1 and shifts every selection position at/after it.
    const deltas: { toB: number; delta: number }[] = []
    tr.changes.iterChanges((fromA, toA, _fromB, toB, inserted) => {
      const text = inserted.toString()
      if (text && hasCjkPunct(text) && !isFreeTextSpan(tr.startState, fromA)) {
        const out = remap(text)
        if (out !== text) {
          changed = true
          specs.push({ from: fromA, to: toA, insert: out })
          if (out.length !== text.length) deltas.push({ toB, delta: out.length - text.length })
          return
        }
      }
      specs.push({ from: fromA, to: toA, insert: text })
    })
    if (!changed) return tr
    // 1:1 remaps preserve every position, so the original selection is usually valid
    // as-is. A length-changing remap (`→` → `->`) shifts everything at/after the
    // rewritten insert: re-map each selection position by the cumulative delta of the
    // remapped inserts that end at or before it (typing cursors sit exactly at an
    // insert's end, so `<=` keeps them after the replacement text).
    let selection = tr.selection
    if (selection && deltas.length) {
      const adj = (p: number) => deltas.reduce((acc, d) => acc + (d.toB <= p ? d.delta : 0), p)
      selection = EditorSelection.create(
        selection.ranges.map((r) => EditorSelection.range(adj(r.anchor), adj(r.head))),
        selection.mainIndex,
      )
    }
    // CRUCIAL: re-attach the original userEvent — a transactionFilter that returns a
    // fresh spec otherwise drops it, and CodeMirror's autocompletion (activateOnTyping)
    // and other input-driven behaviour key off `input.type`. Without this, the popup
    // would not open after an auto-corrected `.` (e.g. `订单服务。` → `订单服务.` with
    // no participant popup).
    const userEvent = tr.annotation(Transaction.userEvent)
    return [
      {
        changes: specs,
        selection,
        scrollIntoView: tr.scrollIntoView,
        ...(userEvent ? { userEvent } : {}),
      },
    ]
  },
)
