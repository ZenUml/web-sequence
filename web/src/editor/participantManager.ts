// Participant name tracker for the ZenUML DSL editor.
//
// Provides a CodeMirror StateField that maintains the set of declared
// participant names by walking the SHARED incremental syntax tree, never
// calling parser.parse() independently (that was the reference implementation's
// double-parse bug).
//
// Integration note: this field returns an empty set unless the editor state
// carries a real Lezer LRLanguage (LRLanguage.define({ parser })). The switch
// from the legacy StreamLanguage to the Lezer language in modes.ts is the
// controller's integration step; once that lands, participants are populated.
// Downstream autocomplete imports getParticipants() to populate From/To lists.

import { StateField } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { EditorState, Transaction } from '@codemirror/state'

// Stable empty set — returned by getParticipants when the field is not installed.
const EMPTY: ReadonlySet<string> = new Set()

/**
 * Collect all participant names from the syntax tree of `state`.
 *
 * Walks every `Participant` node and reads its **direct** `Name` child
 * (using `node.getChild('Name')` — direct-child-only lookup). This correctly
 * handles:
 *   - `@Actor Client` → "Client"
 *   - `@Actor <<service>> Client` → "Client" (skips the Stereotype's Name)
 *   - bare `OrderController` (no annotation) → "OrderController"
 *   - participants inside `group { }` blocks
 *
 * Does NOT include the group's own name (`group myGroup { }` → "myGroup" is
 * a Name child of Group, not of any Participant, so it's never visited here).
 */
function collectParticipants(state: EditorState): Set<string> {
  const names = new Set<string>()
  const tree = syntaxTree(state)

  tree.iterate({
    enter(nodeRef) {
      if (nodeRef.name !== 'Participant') return
      // getChild performs a direct-children-only scan — it will NOT descend into
      // Stereotype's own Name child even though Stereotype is also a child of
      // Participant. This is safe because Lezer's getChild matches the first
      // direct child of the requested type at depth 1 only.
      const nameNode = nodeRef.node.getChild('Name')
      if (nameNode) {
        names.add(state.doc.sliceString(nameNode.from, nameNode.to))
      }
    },
  })

  return names
}

/**
 * CodeMirror StateField that tracks declared participant names.
 *
 * Recomputes only when the document changes. Returns a stable reference to the
 * prior set when the names have not actually changed, to avoid triggering
 * needless downstream recompute in facets and effects that subscribe to this
 * field.
 *
 * Must be listed in the extensions array AFTER the language extension so that
 * syntaxTree(state) sees the freshly-parsed tree for the current transaction.
 */
export const zenumlParticipantField: StateField<ReadonlySet<string>> = StateField.define<ReadonlySet<string>>({
  create(state) {
    return collectParticipants(state)
  },

  update(value, tr: Transaction) {
    // Short-circuit: if the document did not change the tree is unchanged.
    if (!tr.docChanged) return value

    const next = collectParticipants(tr.state)

    // Return the prior reference when contents are identical — downstream code
    // that compares by reference (e.g. memoised autocomplete sources) does not
    // re-fire unnecessarily.
    if (next.size === value.size && [...next].every((n) => (value as Set<string>).has(n))) {
      return value
    }

    return next
  },
})

/**
 * Return the current set of declared participant names from `state`.
 *
 * Safe to call even if `zenumlParticipantField` is not installed in the state
 * — returns an empty set in that case rather than throwing.
 *
 * Downstream autocomplete imports this to populate From/To completion lists.
 */
export function getParticipants(state: EditorState): ReadonlySet<string> {
  return state.field(zenumlParticipantField, false) ?? EMPTY
}
