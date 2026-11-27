// Cursor-context classifiers for the ZenUML editor (#903): "what kind of slot
// is the cursor in?", answered from the shared syntax tree. Completion
// (zenumlAutocomplete.ts) and CJK autocorrect (cjkAutocorrect.ts) both import
// from here; neither imports the other.
//
// Every walk starts at resolveInner(pos, -1): bias toward the node ending at
// pos, so a cursor at the very end of a token belongs to that token.
//
// Two rules that differ on purpose between the two features:
//   - D7: the bare method-name slot (`A.|`) is CODE for autocorrect but a
//     free-typing zone for completion. See isFreeTextSpan.
//   - #805: isInsideMessageContent counts a whole AsyncMessage (endpoints
//     included), unlike isFreeTextSpan, so participant annotations are never
//     offered anywhere in an async message.
//
// Only REAL node names from grammar/zenuml-parser.terms.js are referenced.

import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import type { SlashZone } from './slashCommands'

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
export function isNamingDeclaration(state: EditorState, pos: number): boolean {
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

// True when the cursor sits inside an async-message LABEL (the free-text Content of
// `A->B: …`). A label is neither a declaration nor a statement-start, so participant
// annotations (`@Actor`, …) must never be offered there — even though the label sits
// at document top level where `resolveZone` returns 'top' (#805). Walks ancestors
// for a Content / AsyncMessage node.
export function isInsideMessageContent(state: EditorState, pos: number): boolean {
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (n.name === 'Content' || n.name === 'AsyncMessage') return true
  }
  return false
}
