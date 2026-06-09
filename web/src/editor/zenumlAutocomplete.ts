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

import { syntaxTree } from '@codemirror/language'
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
import type { SyntaxNode } from '@lezer/common'
import { commandsForZone, type SlashZone } from './slashCommands'
import { getParticipants } from './participantManager'
import { CLOUD_ANNOTATIONS, CORE_ANNOTATIONS } from './annotations'

// ---------------------------------------------------------------------------
// 1. Zone resolution
// ---------------------------------------------------------------------------

/**
 * Derive the cursor's zone from the syntax tree.
 *
 *  - inside a StatementBraceBlock (the body of a sync message / control-flow
 *    block) => 'block'
 *  - everywhere else — the document Head, a group's participant list, or before
 *    the first statement => 'head'
 *
 * Robust to partial/empty docs: an empty or whitespace-only document, or a
 * cursor that resolves to no meaningful container, defaults to 'head' (the
 * place you start a diagram — declaring participants).
 */
export function resolveZone(state: EditorState, pos: number): SlashZone {
  const tree = syntaxTree(state)
  // resolveInner(pos, -1): bias toward the node ending at pos, so that a cursor
  // sitting just inside a freshly-typed `{` lands in the brace block, and a
  // cursor at the very end of a token is associated with that token.
  let node: SyntaxNode | null = tree.resolveInner(pos, -1)
  while (node) {
    // The body of a message/control-flow block. This is the authoritative
    // 'block' container. (Group's body is GroupBraceBlock — still 'head',
    // because only participant declarations live there.)
    if (node.name === 'StatementBraceBlock') return 'block'
    // Once we hit the document Head or a group's participant list, we're in
    // 'head' territory and can stop climbing.
    if (node.name === 'Head' || node.name === 'GroupBraceBlock' || node.name === 'Group') {
      return 'head'
    }
    node = node.parent
  }
  // Not inside a Head/Group/brace → the document TOP LEVEL, where both
  // declarations and statements (messages, control flow) are valid. 'top' offers
  // the union of head + block commands/keywords (fixes the top-level slash gap
  // where `/sync` used to insert literal text — ADR 0002 open work #2).
  return 'top'
}

/**
 * True when the cursor sits in the NAME slot of a declaration that already has a
 * leading marker before the name — an `@annotation`/`<<stereotype>>` (participant,
 * e.g. `@Actor a`) or the `group` keyword (e.g. `group a`). In that slot a NAME is
 * expected, so head keywords (title/group/as) must NOT be offered: `as` is a label
 * modifier that only follows a complete name, and title/group are statement-start
 * keywords. A BARE leading identifier (`t`) is statement-start, not a name slot, so
 * keyword completions stay available there. Once the cursor moves past the name
 * (the modifier slot, or a group's `{ }` body) the keywords are valid again.
 */
function isNamingDeclaration(state: EditorState, pos: number): boolean {
  // Text guard FIRST: when the name being typed is itself a reserved keyword
  // (`group if`, `@Actor while`), the lexer emits a keyword token that escapes the
  // Participant/Group subtree, so the tree walk below finds no declaration ancestor
  // and wrongly reports "not naming" — leaking block keywords into the name slot
  // (#806). A same-line marker (`group `/`@Annotation `/`<<stereo>> `) immediately
  // before the cursor word is an unambiguous NAME slot regardless of how the token
  // lexed. The line-start anchor keeps a NEXT-line `group\nif` (a real top-level `if`
  // statement) offering keywords. The marker must be the FIRST word on the line, so a
  // completed name + modifier slot (`@Actor Alice a`) does NOT match (Alice intervenes).
  const before = state.doc.sliceString(Math.max(0, pos - 80), pos)
  if (/(?:^|\n)[ \t]*(?:group|@\w+|<<[^>]+>>)[ \t]+\w*$/.test(before)) return true

  let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1)
  while (node && node.name !== 'Participant' && node.name !== 'Group') node = node.parent
  if (!node) return false
  const nameNode = node.getChild('Name')
  // Past the name (a participant's modifier slot, or inside a group's `{ }` body)
  // → no longer naming.
  if (nameNode && pos > nameNode.to) return false
  // The slot is a NAME (not a fresh statement-start token) only if the declaration
  // has a leading marker before the name. `@Actor ` with no name yet parses as
  // ParticipantType + error and still counts (nameNode is null → naming).
  return !!(
    node.getChild('ParticipantType') ||
    node.getChild('Stereotype') ||
    node.getChild('GroupKeyword')
  )
}

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

// True when the cursor sits inside an async-message LABEL (the free-text Content of
// `A->B: …`). A label is neither a declaration nor a statement-start, so participant
// annotations (`@Actor`, …) must never be offered there — even though the label sits
// at document top level where `resolveZone` returns 'top' (#805). Walks ancestors
// for a Content / AsyncMessage node.
function isInsideMessageContent(state: EditorState, pos: number): boolean {
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (n.name === 'Content' || n.name === 'AsyncMessage') return true
  }
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
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (
      n.name === 'Comment' ||
      n.name === 'Content' ||
      n.name === 'LineContent' ||
      n.name === 'Label' ||
      n.name === 'String'
    )
      return null
  }

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
