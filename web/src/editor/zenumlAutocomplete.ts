// Context-aware autocomplete + slash commands for the ZenUML DSL editor.
//
// Three exports:
//   1. resolveZone(state, pos)      — derive the cursor's parse zone ('head' | 'block')
//   2. zenumlCompletions(context)   — the CodeMirror completion source
//   3. zenumlCompletionKeymap       — Tab/Enter/Escape bindings for the popup
//
// Design notes (lessons from the reference impl ZenUml/codemirror-extensions):
//   - We NEVER call parser.parse() ourselves. Zones and participant names come
//     from syntaxTree(state), the tree CodeMirror already maintains.
//   - Completions are parse-context aware: slash commands and keywords are gated
//     by zone, and participant names are boosted only where a message endpoint is
//     plausible. The reference impl showed one flat list everywhere — a bug.
//   - The participant currently under the cursor is excluded by POSITION, not by
//     Set insertion order (the reference impl's `slice(0, size-1)` was a bug:
//     Set order != cursor position).
//
// Only REAL node names from grammar/zenuml-parser.terms.js are referenced.

import type { EditorState } from '@codemirror/state'
import {
  snippetCompletion,
  acceptCompletion,
  closeCompletion,
  hasNextSnippetField,
  hasPrevSnippetField,
  nextSnippetField,
  prevSnippetField,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { KeyBinding } from '@codemirror/view'
import { commandsForZone, type SlashZone } from './slashCommands'
import { getParticipants } from './participantManager'
import { isFreeTextSpan, isInsideMessageContent, isNamingDeclaration, resolveZone } from './cursorContext'
import { CLOUD_ANNOTATIONS, CORE_ANNOTATIONS } from './annotations'

// resolveZone moved to cursorContext.ts (#903); re-exported for existing callers.
export { resolveZone }

// ---------------------------------------------------------------------------
// 1. Zone resolution: resolveZone, isNamingDeclaration and
//    isInsideMessageContent live in cursorContext.ts (#903).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2. Participant names
// ---------------------------------------------------------------------------
//
// The single source of truth is participantManager.getParticipants(state),
// which reads the SHARED syntax tree via a StateField (no independent parse).
// We deliberately do NOT re-walk the tree here: the Hint Bar and this popup
// must show the SAME participant set, so both consume getParticipants(). Any
// gap in that set (first-mention message endpoints, method-name pollution from
// the Head-greedy grammar gap) is participantManager's scope to close, not
// ours to paper over with a divergent second definition.

/**
 * Participant names to offer, with the identifier currently under the cursor
 * removed (excluded by the cursor token's text — the `[from,to]` slice — not by
 * Set insertion order, which was the reference impl's `slice(0, size-1)` bug).
 */
function participantOptions(state: EditorState, cursorToken: string): string[] {
  const all = getParticipants(state)
  const out: string[] = []
  for (const name of all) {
    if (cursorToken && name === cursorToken) continue
    out.push(name)
  }
  return out
}

// ---------------------------------------------------------------------------
// 3. Keyword catalogs, gated by zone
// ---------------------------------------------------------------------------

const HEAD_KEYWORDS: Completion[] = [
  { label: 'title', type: 'keyword', detail: 'Diagram title' },
  { label: 'group', type: 'keyword', detail: 'Group participants under a box' },
  { label: 'as', type: 'keyword', detail: 'Alias / label a participant' },
]

const BLOCK_KEYWORDS: Completion[] = [
  { label: 'if', type: 'keyword', detail: 'Conditional (alt) block' },
  { label: 'else', type: 'keyword', detail: 'Else / else-if branch' },
  { label: 'while', type: 'keyword', detail: 'Loop block' },
  { label: 'par', type: 'keyword', detail: 'Parallel block' },
  { label: 'opt', type: 'keyword', detail: 'Optional block' },
  { label: 'critical', type: 'keyword', detail: 'Critical block' },
  { label: 'section', type: 'keyword', detail: 'Named section' },
  { label: 'frame', type: 'keyword', detail: 'Named frame' },
  { label: 'ref', type: 'keyword', detail: 'Reference to another diagram' },
  { label: 'try', type: 'keyword', detail: 'Try / catch / finally' },
  { label: 'catch', type: 'keyword', detail: 'Catch branch' },
  { label: 'finally', type: 'keyword', detail: 'Finally branch' },
  { label: 'return', type: 'keyword', detail: 'Return a value to the caller' },
  { label: 'new', type: 'keyword', detail: 'Create a new instance' },
  { label: 'async', type: 'keyword', detail: 'Async message' },
]

function keywordsForZone(zone: SlashZone): Completion[] {
  if (zone === 'head') return HEAD_KEYWORDS
  if (zone === 'block') return BLOCK_KEYWORDS
  return [...HEAD_KEYWORDS, ...BLOCK_KEYWORDS] // 'top': both are valid
}

// Annotations (@Actor, @Database, ...) are only valid where a ParticipantType
// is — i.e. the head. The full catalog lives in ./annotations.
function annotationCompletions(): Completion[] {
  return [...CORE_ANNOTATIONS, ...CLOUD_ANNOTATIONS].map((name) => ({
    label: name,
    type: 'type',
    detail: 'Participant annotation',
  }))
}

// ---------------------------------------------------------------------------
// 4. The completion source
// ---------------------------------------------------------------------------

/**
 * Convert slash commands for a zone into snippet completions. The `/` and the
 * typed name are both replaced by the snippet (apply spans [from, pos]), so the
 * template's `${1:..}` placeholders become real tab stops.
 */
function slashCompletions(zone: SlashZone): Completion[] {
  return commandsForZone(zone).map((cmd) =>
    snippetCompletion(cmd.template, {
      label: '/' + cmd.name,
      detail: cmd.detail,
      type: 'keyword',
    }),
  )
}

/** True when the cursor is in a position where a message endpoint is plausible. */
function atMessageEndpoint(state: EditorState, pos: number): boolean {
  const before = state.doc.sliceString(Math.max(0, pos - 40), pos)
  // After an arrow ("A->"), or at the start of a line in a block (message source
  // position). Identifier chars are Unicode-aware (`\p{L}\p{N}_`, not ASCII `\w`) so
  // CJK / accented names are recognised too (#809 — completion layer). NOTE: a dot
  // ("Order.") is deliberately NOT an endpoint — the slot after a dot is a free-text
  // method name, and the caller suppresses participant names there via `afterDot`.
  if (/->\s*[\p{L}\p{N}_]*$/u.test(before)) return true
  // Start of a fresh statement line (only leading whitespace since newline).
  if (/(^|\n)\s*[\p{L}\p{N}_]*$/u.test(before)) return true
  return false
}

export function zenumlCompletions(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context

  // No completions inside free-text spans:
  //  - a `Comment` (the `/` in `// /sync` must NOT pop the slash menu; a word in a
  //    comment must not pop keywords/participant names).
  //  - a message/title/divider LABEL (`Content` / `LineContent`). A label word that
  //    happens to prefix a keyword — "title screen", "while loading", "new feature" —
  //    must NOT surface that keyword as noise (#813). `From`/`To` endpoints are siblings
  //    of `Content` under the message node, so participant completion at endpoints is
  //    unaffected.
  //  - a participant alias `as "…"` (`Label` / `String`). The alias value is free text
  //    (a quoted string or a bare label name); typing `as "title screen"` must not pop
  //    the `title` keyword (#813). The `as` keyword itself is offered BEFORE the Label
  //    node exists, so head-keyword completion of `as` is unaffected.
  //  - an EMPTY free-text region (#814): right after `A->B: ` / `title ` / `== ` the
  //    Content node does not exist yet, so a plain ancestor walk finds nothing and
  //    completions leak into a slot the user is about to fill with prose. The shared
  //    classifier isFreeTextSpan (cursorContext.ts, grown for the same empty-region
  //    class in 961a221) covers the node set above PLUS those zero-width regions —
  //    one source of truth for "is this slot free text?".
  if (isFreeTextSpan(state, pos)) return null

  // ---- SLASH MODE -------------------------------------------------------
  // Match a `/word` immediately before the cursor. The `/` must be the trigger;
  // we anchor on it so `A.b()/2` (a stray slash) inside text doesn't pop the
  // command menu unless the slash directly precedes the (partial) command.
  const slash = context.matchBefore(/\/\w*/)
  if (slash) {
    const zone = resolveZone(state, slash.from)
    const options = slashCompletions(zone)
    if (!options.length) return null
    return {
      from: slash.from,
      to: pos,
      options,
      // Re-query while the user keeps typing the command name.
      validFor: /^\/\w*$/,
    }
  }

  // ---- NORMAL MODE ------------------------------------------------------
  // Unicode-aware word match (`\p{L}\p{N}_`, not ASCII `\w`) so the popup fires while
  // typing CJK / accented participant names like `用户` (#809 — completion layer).
  const word = context.matchBefore(/[\p{L}\p{N}_@]*/u)
  if (!word) return null
  // Nothing typed and not explicitly invoked: stay quiet — UNLESS the cursor
  // sits immediately after a trigger (`.` or `->`), where offering participant
  // names with an empty word is exactly the point. The gate stays narrow on
  // purpose: a line-start trigger would fire the popup on every newline.
  const beforeWord = state.doc.sliceString(Math.max(0, word.from - 3), word.from)
  // Two structurally different triggers sit before the word, and they want OPPOSITE
  // completions:
  //   - `A->`  : the next token IS a participant (the message To) → offer names.
  //   - `Name.`: the next token is a free-text METHOD name (the renderer stores it as
  //              Content, never a participant) → offer NOTHING. Participant names — and
  //              especially the receiver itself (`B.B`) — are noise here.
  // `afterTrigger` (either) still gates keyword/annotation suppression; `afterDot`
  // additionally suppresses participant names.
  const afterArrow = /->\s*$/.test(beforeWord)
  const afterDot = /\.\s*$/.test(beforeWord)
  const afterTrigger = afterArrow || afterDot
  if (word.from === word.to && !context.explicit && !afterTrigger) return null

  const from = word.from
  const typed = word.text
  const zone = resolveZone(state, from)
  const options: Completion[] = []

  // Annotations are ONLY valid where a ParticipantType is — the head. Gate the
  // whole branch on zone so typing "@A" inside a block does NOT offer @Actor etc.
  // Also suppressed (a) immediately after a `.`/`->` trigger — that slot is a message
  // endpoint, not a declaration, so an explicit Ctrl+Space must not surface @Actor
  // (#803); and (b) inside an async-message label `A->B: @` (#805).
  if (
    !afterTrigger &&
    !isInsideMessageContent(state, pos) &&
    (zone === 'head' || zone === 'top') &&
    (typed.startsWith('@') || context.explicit)
  ) {
    options.push(...annotationCompletions())
  }

  if (!typed.startsWith('@')) {
    // Participant names — boosted where a message endpoint is plausible. NEVER after a
    // `.`: that slot is a free-text method name, not a participant endpoint (block zone
    // would otherwise offer names there unconditionally).
    if (!afterDot && (zone === 'block' || atMessageEndpoint(state, pos))) {
      for (const name of participantOptions(state, typed)) {
        options.push({ label: name, type: 'variable', detail: 'participant', boost: 50 })
      }
    }
    // Zone-gated keywords — but NOT (a) while typing the name of an annotated
    // participant (`@Actor a`): that slot is the participant NAME, not a keyword, so
    // title/group/as must stay out of it; and NOT (b) immediately after a `.`/`->`
    // trigger, where only a message endpoint participant is legal, never a keyword
    // (#803).
    if (
      !afterTrigger &&
      !((zone === 'head' || zone === 'top') && isNamingDeclaration(state, pos))
    ) {
      options.push(...keywordsForZone(zone))
    }
  }

  if (!options.length) return null
  return {
    from,
    to: word.to,
    options,
    // Unicode-aware so the popup stays valid as the user keeps typing a CJK / accented
    // name (#809).
    validFor: /^[\p{L}\p{N}_@]*$/u,
  }
}

// ---------------------------------------------------------------------------
// 5. Keymap
// ---------------------------------------------------------------------------

// Tab/Shift-Tab drive snippet field navigation FIRST, then fall through to
// completion accept. CodeMirror's auto-installed snippet keymap (addSnippetKeymap)
// does not fire inside this editor's composed/compartment keymap setup — verified
// in a real browser: Tab did not advance ${1}→${2} even immediately after insert,
// with no popup open. Without this explicit binding every slash-command snippet's
// tab stops are dead. acceptCompletion returns false when no popup is open, so a
// lone Tab outside a snippet does nothing (safe).
export const zenumlCompletionKeymap: KeyBinding[] = [
  {
    key: 'Tab',
    run: (view) => (hasNextSnippetField(view.state) ? nextSnippetField(view) : acceptCompletion(view)),
  },
  {
    key: 'Shift-Tab',
    run: (view) => (hasPrevSnippetField(view.state) ? prevSnippetField(view) : false),
  },
  { key: 'Enter', run: acceptCompletion },
  { key: 'Escape', run: closeCompletion },
]
