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

import { EditorState, Transaction, type Extension, type TransactionSpec } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// Full-width / CJK punctuation → ASCII. Every entry is 1 codepoint → 1 codepoint, so
// applying the remap never shifts any cursor/selection position.
const CJK_TO_ASCII: Record<string, string> = {
  '。': '.',
  '，': ',',
  '、': ',',
  '；': ';',
  '：': ':',
  '（': '(',
  '）': ')',
  '｛': '{',
  '｝': '}',
  '【': '[',
  '】': ']',
  '〔': '[',
  '〕': ']',
  '＜': '<',
  '＞': '>',
  '《': '<',
  '》': '>',
  '“': '"',
  '”': '"',
  '＂': '"',
  '‘': "'",
  '’': "'",
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
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      const text = inserted.toString()
      if (text && hasCjkPunct(text) && !isFreeTextSpan(tr.startState, fromA)) {
        const out = remap(text)
        if (out !== text) {
          changed = true
          specs.push({ from: fromA, to: toA, insert: out })
          return
        }
      }
      specs.push({ from: fromA, to: toA, insert: text })
    })
    if (!changed) return tr
    // 1:1 remaps preserve every position, so the original selection stays valid.
    return [{ changes: specs, selection: tr.selection, scrollIntoView: tr.scrollIntoView }]
  },
)
