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
// ── Architecture (TEST_TREES.md "Product decisions 2026-06-10": D1, D2, D3) ──────────
//
// Implemented as an EditorView.updateListener that lets the ORIGINAL transaction commit
// (the typed `。` actually enters the document and the undo history) and then dispatches
// the correction as its OWN, history-isolated transaction. This replaced the original
// transactionFilter design, which rewrote the insert before anything entered history —
// correct-looking, but it made three ratified product decisions impossible:
//
//  - D2 (undo restores the typed original): the first undo must bring back the literal
//    `。`/`→` the user typed; the second removes it. That requires the original char to
//    enter history and the correction to be a separate event — `isolateHistory('full')`
//    on the correction transaction pins exactly that. (Dispatching from an update
//    listener is safe: CodeMirror invokes listeners after `updateState` returns to Idle.)
//  - D1 (composition-safe): never rewrite while an IME composition session is active.
//    Transactions flagged `input.type.compose` while `view.compositionStarted` only
//    ACCUMULATE the composed region; the correction applies when the composed text
//    commits (the post-compositionend change, or a deferred flush when the session ends
//    with the text already committed). A transactionFilter rewrote mid-composition,
//    which desyncs the IME's idea of the composition string from the document.
//  - D3 (corrected openers auto-pair): a corrected lone opener (`（`→`(`, `｛『〖`→`{`)
//    routes through @codemirror/autocomplete's exported `insertBracket`, so the closer
//    is injected with the cursor inside AND the pending-closer state matches ASCII
//    autopair exactly — a subsequently typed `)`/`）` types over the injected closer and
//    Backspace between the pair deletes both. Multi-char runs (paste) never pair.
//
// The correction transaction re-carries a user-input `userEvent` so autocompletion's
// activateOnTyping still fires after a corrected `.` / `－＞` / `→` (the 09f95e3 class).
// Programmatic edits, undo/redo, and our own correction transactions are never corrected.

import {
  Annotation,
  EditorState,
  Transaction,
  type ChangeSpec,
  type Extension,
} from '@codemirror/state'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { isolateHistory } from '@codemirror/commands'
import { insertBracket } from '@codemirror/autocomplete'

// Full-width / CJK punctuation → ASCII. Almost every entry is 1 codepoint → 1 codepoint;
// the lone exception is `→` → `->` (1 → 2). Cursor positions are preserved by CodeMirror
// mapping the selection through the correction changes (a typing cursor sits at the end
// of the replaced range, so it lands after the replacement text — incl. after `->`).
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
  // where the DSL needs the two-char `->`. The ONLY multi-char replacement in the map.
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

// True when `pos` sits in a free-text span where CJK punctuation is intentional content:
// a message/title/divider LABEL (`Content`/`LineContent`), a quoted `String`, or a
// `Comment`. Same span set the completion logic treats as free text (#813).
//
// D7 (TEST_TREES.md product decisions): the bare METHOD-NAME slot (`A.|`, `A.pay|`) is
// deliberately CODE here, even though the completion side treats the post-dot slot as a
// free-typing zone (76bddeb suppresses the popup there). The asymmetry is INTENDED:
// completion suppression exists because any method name is valid (nothing useful to
// offer), but the grammar's Identifier cannot hold full-width punctuation — an
// uncorrected `。` inside a bare method name always breaks the parse. A user who truly
// wants CJK punctuation in a method name has the quoted escape hatch `A."支付。"()`,
// which this classifier preserves via the `String` branch. Changing either side is a
// product decision, not a refactor.
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

// Marks our own correction transactions so the update listener never re-processes them
// (recursion guard; also keeps them out of the "user input" classification).
const cjkCorrection = Annotation.define<boolean>()

type Region = { from: number; to: number }

/** Inserted ranges of a transaction, in its new-doc coordinates. */
function insertedRegions(tr: Transaction): Region[] {
  const out: Region[] = []
  tr.changes.iterChanges((_fromA, _toA, fromB, toB, inserted) => {
    if (inserted.length) out.push({ from: fromB, to: toB })
  })
  return out
}

/** Union regions, merging overlapping/adjacent ones; drops empties. */
function unionRegions(regions: Region[]): Region[] {
  const sorted = regions
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from)
  const out: Region[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to)
    else out.push({ from: r.from, to: r.to })
  }
  return out
}

// D1: per-view accumulator for the region a live IME composition session has touched.
// Keyed by view (WeakMap, not closure state) so two mounted DSL editors never share a
// session. Regions are kept mapped through every doc change until the session commits.
const composeSessions = new WeakMap<EditorView, Region[]>()

/**
 * Compute per-char correction changes for `regions` of `state`'s document.
 *
 * TT-I14 (product decisions): classification is PER CHARACTER of the inserted content
 * against the POST-INSERT parse — not once at the insertion point. A multi-line mixed
 * paste (`A->B: 你好。\nC。d()`) at a code position keeps the label's `。` (that char
 * resolves inside `LineContent`) while the code line's `。` corrects, because each
 * mapped char is classified where it actually landed in the new tree.
 */
function correctionChanges(
  state: EditorState,
  regions: Region[],
): { from: number; to: number; insert: string }[] {
  const changes: { from: number; to: number; insert: string }[] = []
  const maxTo = regions.reduce((m, r) => Math.max(m, r.to), 0)
  // The pasted/composed content must be parsed before per-char classification; for
  // large pastes the background parse may not have reached it yet. If the budget runs
  // out before the parse frontier reaches the content, FAIL SAFE: preserve (skip
  // correction) past the frontier rather than misclassify free text as code and corrupt
  // a label — the exact corruption class TT-I14 exists to prevent. An uncorrected char
  // in a code position merely leaves a visible parse error the user can retype; a
  // silently rewritten label is data loss.
  const target = Math.min(maxTo, state.doc.length)
  const tree = ensureSyntaxTree(state, target, 250)
  const frontier = tree ? target : (syntaxTree(state).length ?? 0)
  for (const r of regions) {
    const text = state.doc.sliceString(r.from, r.to)
    let pos = r.from
    for (const ch of text) {
      const mapped = CJK_TO_ASCII[ch]
      // Classify at the char's START with side -1 — the char's LEFT context, the same
      // semantics the insertion-point classification always had. (Classifying at the
      // char's end resolves the char itself, and error recovery does not extend a
      // free-text node over an unknown char: `as "标签` + `（` puts the `（` in an error
      // node OUTSIDE the Label, which would wrongly correct it.)
      if (mapped !== undefined && pos <= frontier && !isFreeTextSpan(state, pos)) {
        changes.push({ from: pos, to: pos + ch.length, insert: mapped })
      }
      pos += ch.length
    }
  }
  return changes
}

/**
 * D3: when the correction is a SINGLE typed char that maps to a single-char bracket and
 * the cursor sits right after it, route it through closeBrackets' `insertBracket` so the
 * result behaves exactly like typing the ASCII char with autopair on:
 *  - lone opener `(`/`{` (and `"` where ASCII would pair) → closer injected, cursor
 *    inside, pending-closer state set → later `)`/`）` types over, Backspace pair-deletes;
 *  - closer `)`/`}` against a pending injected closer → types over (no doubling).
 * Returns true if it dispatched. Falls back (false) whenever insertBracket declines —
 * same situations where ASCII typing would not pair (word char after cursor, `[`/`'`
 * excluded from the language's closeBrackets config per D4, no pending closer, …).
 */
function tryPairedCorrection(
  view: EditorView,
  region: Region,
  ascii: string,
): boolean {
  if (ascii.length !== 1) return false
  const sel = view.state.selection.main
  if (!sel.empty || sel.head !== region.to) return false
  // Delete the typed original, then ask insertBracket what ASCII typing would do here.
  const deletion = view.state.changes({ from: region.from, to: region.to, insert: '' })
  const afterDelete = view.state.update({ changes: deletion }).state
  let paired: Transaction | null = null
  try {
    paired = insertBracket(afterDelete, ascii)
  } catch {
    // insertBracket touches closeBrackets' internal state field on its type-over path;
    // in a host without the closeBrackets extension that throws. Fall back to a plain
    // replacement — matching ASCII behavior, which would not pair there either.
    paired = null
  }
  if (!paired) return false
  // Compose deletion + insertBracket's changes into ONE history-isolated transaction
  // (D2: a single undo restores the typed original). insertBracket built its selection
  // and pending-closer effects against the post-deletion doc; both the deletion and the
  // insertion happen at the same offset, so they are valid in the composed result too.
  view.dispatch({
    changes: deletion.compose(paired.changes),
    selection: paired.newSelection,
    effects: paired.effects,
    scrollIntoView: true,
    userEvent: 'input.type',
    annotations: [cjkCorrection.of(true), isolateHistory.of('full')],
  })
  return true
}

/**
 * Correct CJK punctuation inside `regions` (post-insert coordinates of the current doc).
 * Dispatches at most one correction transaction; it is history-isolated (D2) and carries
 * a user-input userEvent so completion still fires after it (Z4 class).
 */
function applyCorrection(view: EditorView, regions: Region[], userEvent: string): void {
  const merged = unionRegions(regions).filter(
    (r) => r.to <= view.state.doc.length && hasCjkPunct(view.state.doc.sliceString(r.from, r.to)),
  )
  if (!merged.length) return
  const changes = correctionChanges(view.state, merged)
  if (!changes.length) return
  // D3 pairing only for lone-char typing (incl. a single-char IME commit) — never for
  // pasted/dropped runs.
  if (
    changes.length === 1 &&
    merged.length === 1 &&
    merged[0].from === changes[0].from &&
    merged[0].to === changes[0].to &&
    userEvent.startsWith('input.type') &&
    tryPairedCorrection(view, merged[0], changes[0].insert)
  ) {
    return
  }
  view.dispatch({
    changes: changes as ChangeSpec,
    scrollIntoView: true,
    // Keep the triggering event's flavor: typing stays 'input.type' (completion's
    // activateOnTyping keys off it), paste stays 'input.paste'.
    userEvent,
    annotations: [cjkCorrection.of(true), isolateHistory.of('full')],
  })
}

/** Flush (and clear) a view's accumulated composition region — the D1 commit point. */
function flushComposition(view: EditorView): void {
  const pending = composeSessions.get(view)
  composeSessions.delete(view)
  // The composed text commits as one unit; an IME commit reads as typing to the rest of
  // the editor (completion may fire after a committed `->`), hence 'input.type'.
  if (pending && pending.length) applyCorrection(view, pending, 'input.type')
}

function handleUpdate(update: ViewUpdate): void {
  const view = update.view
  // Keep any accumulated composition region mapped through this update's changes.
  let pending = composeSessions.get(view)
  if (pending && update.docChanged) {
    pending = unionRegions(
      pending.map((r) => ({
        from: update.changes.mapPos(r.from, 1),
        to: update.changes.mapPos(r.to, -1),
      })),
    )
    composeSessions.set(view, pending)
  }
  if (!update.docChanged) return

  const immediate: Region[] = []
  let immediateEvent: string | null = null
  update.transactions.forEach((tr, i) => {
    if (!tr.docChanged) return
    // Never re-process our own correction transactions (recursion guard).
    if (tr.annotation(cjkCorrection)) return
    // Only genuine typing/paste — never programmatic edits, undo/redo, etc.
    const userEvent = tr.annotation(Transaction.userEvent)
    if (!userEvent || !(tr.isUserEvent('input') || tr.isUserEvent('paste'))) return
    // Map this transaction's inserted ranges through any LATER transactions bundled in
    // the same update, so the regions are valid in update.state coordinates.
    let regions = insertedRegions(tr)
    for (let j = i + 1; j < update.transactions.length; j++) {
      const later = update.transactions[j].changes
      regions = regions.map((r) => ({
        from: later.mapPos(r.from, 1),
        to: later.mapPos(r.to, -1),
      }))
    }
    if (userEvent.startsWith('input.type.compose')) {
      if (view.compositionStarted) {
        // D1: an IME composition session is live — never rewrite mid-session (the IME
        // owns that text); just remember where it is.
        composeSessions.set(view, unionRegions([...(composeSessions.get(view) ?? []), ...regions]))
        return
      }
      // Compose-flagged change arriving AFTER compositionend (CodeMirror's
      // compositionPendingChange path) — this IS the commit.
      regions = unionRegions([...(composeSessions.get(view) ?? []), ...regions])
      composeSessions.delete(view)
    }
    immediate.push(...regions)
    immediateEvent = userEvent
  })
  if (immediate.length && immediateEvent) applyCorrection(view, immediate, immediateEvent)
}

/**
 * Editor extension: auto-correct full-width/CJK punctuation to ASCII on user input,
 * except inside free-text spans. Wire this into the DSL language extension only.
 */
export const cjkPunctuationAutocorrect: Extension = [
  EditorView.updateListener.of(handleUpdate),
  EditorView.domEventHandlers({
    compositionend: (_event, view) => {
      // D1 commit point for sessions that end with the text already committed (no
      // post-compositionend change). Deferred past CodeMirror's own compositionend
      // bookkeeping — its pending-DOM-record flush (a microtask) and the up-to-50ms
      // window in which a final compose-flagged change may still arrive; if that change
      // comes, the update listener flushes first and this finds nothing left to do.
      setTimeout(() => flushComposition(view), 60)
      return false
    },
  }),
]
