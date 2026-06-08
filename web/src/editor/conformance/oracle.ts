// The ANTLR conformance oracle — the renderer's authoritative parser, used as
// the reference for "what does this DSL actually mean" in the semantic
// non-conflict gate (docs/adr/0002).
//
// Backed by the committed, generated bundle (antlr-oracle.generated.mjs). We only
// expose the semantic projections the gate compares against — currently the
// participant set (which, via ToCollector.onTo, already includes message
// From/To endpoints, so it covers both declared participants and message
// endpoints in one dimension).

// @ts-expect-error — generated JS bundle ships no type declarations.
import { RootContext, Participants } from './antlr-oracle.generated.mjs'

/**
 * The set of participant names ANTLR recognises for `src` — declared
 * participants AND message endpoints. ANTLR error-recovers, so even malformed
 * input yields a best-effort set (never throws). The gate asserts our parser's
 * set is a SUBSET of this: we may know fewer, never more.
 */
export function oracleParticipants(src: string): Set<string> {
  const ctx = RootContext(src)
  if (!ctx) return new Set()
  const collected = Participants(ctx)
  const names: string[] =
    collected && typeof collected.Names === 'function' ? collected.Names() : []
  return new Set(names)
}
