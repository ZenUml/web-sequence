# 0002 — Editor parser: a simple subset parser, kept semantically non-conflicting with ANTLR via a test-time conformance gate

- Status: Accepted
- Date: 2026-06-08
- Deciders: MrCoder (eagle.xiao@gmail.com)
- Supersedes: the "Known grammar gaps — deferred milestone" stance in `CONTEXT.md`
  (which assumed fixing the Lezer grammar gap-by-gap toward correctness).
- Filename note: the slug says "reuse-antlr-via-tree-adapter" for a full-parity
  migration that was **considered and rejected** during the grilling (see
  Alternatives). The accepted decision is the lighter design below.

## Context

The `web/` editor (CodeMirror 6) parses the ZenUML DSL with a hand-written **Lezer**
grammar (`web/src/editor/grammar/zenuml.grammar`), maintained in parallel with the
renderer's authoritative **ANTLR** grammar (`zenuml-core-25/src/g4/`). The two drift.

Verified empirically (`parser.parse()` on `@Actor Alice\nAlice->Bob: Hello`): the whole
document collapses into one greedy `Head`; `Alice`/`Bob`/`Hello` become bare-`Name`
`Participant`s and `->`/`:`/`.`/`()` become `⚠` error nodes. The user-visible damage is
that `participantManager` collects a **fabricated** set `{Alice, Alice, Bob, Hello}` —
the editor asserts a *meaning* the renderer's parser rejects. It is invisible in
screenshots because the ANTLR renderer draws the diagram correctly while the editor's
Lezer layer is wrong underneath.

### The goal is non-conflict, NOT parity

The objective is **not** an editor parser that accepts everything ANTLR accepts
(parity). The objective is: ship a deliberately **simpler** parser that may understand
*less*, but whose **semantic analysis never contradicts ANTLR** — now or as we extend
it. Stated as a rule: **"abstain, don't fabricate."**

The two failure modes, made distinct:

- **Contradiction (forbidden):** claiming `{…, Bob, Hello}` are participants when ANTLR
  says `Hello` is a message label. Asserting a meaning ANTLR rejects.
- **Incompleteness (allowed):** not highlighting `Hello` as a message label yet because
  the simple parser doesn't model that construct. Under-claiming doesn't mislead.

### Are "non-conflict forever" and "full parity" equivalent? No.

Decompose into two properties: **soundness** (every judgement we make agrees with ANTLR)
and **completeness** (we judge every valid input).

- **Parity = soundness + completeness.**
- **Non-conflict = soundness only.**

Non-conflict is strictly weaker: a parser that abstains on everything is perfectly
non-conflicting with zero parity. So they are not equivalent.

The catch that links them: *safe abstention requires the parser to reliably know when it
is out of its depth.* For **ambiguous** constructs (participant-decl vs message — our
exact bug), knowing "don't claim this as a participant" requires the **same
disambiguation** as parsing it correctly. So on ambiguous points, non-conflict costs
about the same as parity; the savings appear on **unambiguous-but-deep** constructs
(e.g. recognise "this is an `if` condition" and abstain on the boolean expression tree
inside). Precisely:

> **non-conflict = (parity on the subset we choose to support) + (safe abstention on the
> rest).**

It does not drag us to full parity (unsupported constructs may stay abstained forever),
but it does not let us dodge the core participant-vs-message disambiguation that caused
the bug.

## Decision

Keep **our own simple parser** (the existing Lezer grammar, fixed) doing both
highlighting and semantic extraction, as a deliberate subset. Make ANTLR the
**test-time conformance oracle**, and gate every change on a mechanical **subset
invariant** so the parser can never contradict ANTLR's semantics.

### 1. Engine — keep the Lezer parser

We do **not** replace the parser with ANTLR, and we do **not** build an ANTLR→Lezer tree
adapter. The existing Lezer grammar, tree vocabulary (`Participant`, `Head`,
`AsyncMessage`, …), and all consumers (highlighter, `participantManager`, `resolveZone`,
`indentNodeProp`, HintBar) stay. No `antlr4` in the runtime bundle. No `@zenuml/core`
parser export required.

### 2. ANTLR — test-time oracle only

The conformance harness runs `rootContext` + `ToCollector` from `zenuml-core-25`'s
renderer-free parser layer (`src/parser/`) inside the **node** test harness (dev-only).
It is the reference for "what does this input actually mean."

### 3. The conformance gate — subset invariant (this is the definition of "non-conflict")

For each corpus input and each semantic dimension, OUR output must be a **subset** of
ANTLR's:

```
for input in corpus:
  assert ours.participants ⊆ antlr.participants     // ToCollector / OrderedParticipants
  assert ours.endpoints    ⊆ antlr.endpoints        // message From/To
  assert ours.zone(pos) is consistent with antlr's structure where we assign one
  PASS  = a (possibly empty) subset            // abstention is allowed
  FAIL  = any element we report that ANTLR does not   // fabrication
```

The oracle is auto-derived from `ToCollector` — no hand-maintained golden file, so the
gate itself cannot drift from ANTLR. Per-element granularity allows partial
understanding. This makes the "is non-conflict ≟ parity" question operationally moot: the
gate proves soundness at **every** step regardless of whether the endpoint converges.

### 4. The Head-greedy fix — abstain, don't fabricate

The bar is not "parse the message correctly" — it is "stop fabricating participants from
lines we don't model." A line we can't confidently classify must contribute **nothing**
to the participant/endpoint sets (error node / no claim), not a wrong claim. Note a
useful property: a consumer filter that only ever *removes* candidates can only move
toward abstention, so it trivially preserves the subset invariant — but a grammar-level
fix is preferred for fidelity. The locus (grammar vs consumer vs both) is an
implementation choice made TDD-style, guided by the gate.

### 5. Definition of done — non-conflict is the hard gate; completeness is optional

- **Hard requirement:** the subset gate is green across the corpus — zero contradictions.
- **Allowed to remain:** highlighting incompleteness (e.g. a flat message label after a
  declaration) — it under-claims, it does not mislead. Improving it is a separate,
  optional follow-up, not a blocker.
- Consumer hardening only for residual gaps the grammar fix can't reach.

### 6. Test strategy — three layers

1. **Subset conformance gate (node, ms) — the non-conflict gate.** Corpus → our semantics
   vs ANTLR `ToCollector`, subset invariant per §3.
2. **Consumer tests (node).** Participants, `resolveZone`, highlight token classes off the
   Lezer tree — pure functions, no jsdom limitation.
3. **Playwright.** The CM6-only interactive layer jsdom can't run (snippet Tab, live
   highlight render, autocomplete popup) — per the verification retrospective.

Corpus = the known divergences (head/statement, participant label+color, quoted method
names) + common shapes + adversarial edges, seeded from `zenuml-core`'s parser specs.

### 7. Process

No CM6-integration spike is needed (we keep the Lezer tree, so the "will CM6 accept a
non-Lezer tree" risk is gone). First build the conformance harness + corpus (red), then
make the head/statement case abstain (green), TDD. Larger fan-out (consumer rewrites +
corpus + Playwright) may run as an ultracode Workflow; controller integrates + commits.

## Consequences

- The known divergences stop being *contradictions*; some may remain *incomplete*
  (acceptable). The top-level slash-zone gap (`resolveZone` returning `head` for a
  top-level message) is in scope as a zone-classification conflict.
- All landed work is preserved (grammar, `basicSetup`-identity fix, HintBar, e2e). The
  only new permanent asset is the conformance harness + corpus.
- New **dev** dependency only: access to `zenuml-core-25`'s parser layer in tests. Nothing
  added to the shipped bundle.
- Future extensions are safe by construction: extend the parser freely; the subset gate
  fails the instant a new feature contradicts ANTLR.

## Alternatives considered (and rejected)

- **Full parity migration — reuse the ANTLR parser via an ANTLR→Lezer tree adapter, with
  faithful ANTLR node names and an equivalence (isomorphism) corpus.** Explored in depth.
  Rejected: parity is more than the non-conflict goal requires, it puts `antlr4` in the
  runtime bundle / needs a `@zenuml/core` parser export, and it discards working consumer
  code. The intermediate decisions made while exploring this path (redesign the tree
  vocabulary, use faithful ANTLR names) are obsolete with the adapter dropped — the
  existing Lezer vocabulary stays.
- **ANTLR as the runtime semantic source (hybrid: simple parser highlights, ANTLR does
  semantics live).** Rejected: conflict-free by construction but pulls `antlr4` into the
  shipped bundle and prevents *our* parser from owning/growing the semantics.
- **Curated golden expectations as the oracle.** Rejected: a hand-maintained second
  oracle that can itself drift from ANTLR — the exact problem we are eliminating.
