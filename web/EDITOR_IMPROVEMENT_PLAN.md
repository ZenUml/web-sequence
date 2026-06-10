# ZenUML DSL Editor — Improvement Campaign (autonomous)

> **Living state file.** Survives context compaction. On every re-entry: READ THIS
> FIRST, then `git log --oneline -15`, then check `/workflows`, then continue from
> the current phase. Append to the Progress Log; never rewrite history.

## Mission
Make the ZenUML DSL editor genuinely good **as judged by a real user authoring
sequence diagrams**. Tests are the vehicle to find/lock behavior, not the goal.
Branch: `rewrite/web-foundation`. Editor source: `web/src/editor/`.

## Operating rules (do not violate)
1. **Phasing:** never start fixing a bug before ALL find-cases have run — UNLESS the
   fix runs in a separate isolated subagent/worktree. (User constraint.)
2. **Every confirmed bug → GitHub issue** on `ZenUml/web-sequence` (label `bug`)
   BEFORE/with its fix. Dedup against the ledger below.
3. **Green gate:** the existing 51 (`catalog.spec.ts`) + new cases
   (`catalog-extended.spec.ts`) + unit tests (`yarn test`) must stay green after
   every fix. Re-run before committing.
4. **Isolated fixes:** one worktree-isolated subagent per bug to avoid parallel
   edit conflicts; controller integrates sequentially + re-runs the full suite.
5. **Adversarial verify:** a failing generated test = *candidate* bug. Confirm it's a
   real product defect (not a wrong expectation / flaky test) before filing+fixing.
6. **Commit incrementally**, one-line messages, keep working code at every commit.
7. Run mechanics: build once → `npx vite preview --port 4399 --strictPort`; run with
   `PW_BASE_URL=http://localhost:4399 npx playwright test <spec>` (skips the 120s
   rebuild). Rebuild after each source fix before re-running.

## Run/verify commands
```
cd web
yarn build && npx vite preview --port 4399 --strictPort &   # serve current source
PW_BASE_URL=http://localhost:4399 npx playwright test e2e/catalog-extended.spec.ts --reporter=json
PW_BASE_URL=http://localhost:4399 npx playwright test e2e/catalog.spec.ts          # regression
yarn test            # vitest unit
yarn typecheck && yarn lint
```

## Phases
- [x] P0 Skill port (`report-bug`) — committed `1a3d2c8`.
- [x] P1 File the 2 pre-found bugs — #803, #804.
- [x] P2 **Design** 100+ cases — DONE. 113 authored (areas K–V); critic audited.
      O7 dropped (mis-grounded). Assembled → `web/e2e/catalog-extended.spec.ts` (112 cases)
      via `e2e/_assemble_extended.mjs`. Regenerate from workflow output JSON if needed.
- [x] P3 **Find** — DONE. 112 ran: **94 pass / 18 fail**. Artifacts: /tmp/find-extended.json,
      e2e/_failures.json, e2e/_failures_enriched.json.
- [x] P4 **Verify+file** — DONE. 11 = known #803/#804. Of 7 candidates: 3 new real bugs
      filed (#805 K7, #806 P9, #807 U6); 4 bad tests (L4,M7,V4,V7) corrected in the spec.
- [x] P5 **Fix** — ALL 5 bugs fixed. #804/#803/#805/#806 committed `33a4010`. #807 (U6) via
      grammar @specialize (per-keyword named, node names preserved → no styleTags churn).
      CAUGHT a self-regression: my #804 Construct collection broke the `creation` conformance
      gate (`a = new A()` oracle = `a:A`, not bare `A`) — fixed to collect Construct ONLY for
      the anonymous `new X()` form. 194 unit pass. Final e2e (workers=1) running, then commit.
- [ ] P6 **UX improvement rounds** — broader real-user improvements (see backlog).
- [ ] P6 **UX improvement rounds** — see backlog; design→implement→test→commit, looping.
- [ ] P7 **Docs** — update BROWSER_TEST_CATALOG.md, CONTEXT/ADR, this plan.

## Bug ledger
| # | GH | Title | Location | Status |
|---|----|-------|----------|--------|
| 1 | [#803](https://github.com/ZenUml/web-sequence/issues/803) | keyword/@annotation pollution after `.`/`->` | zenumlAutocomplete.ts:258,272 | filed, unfixed. Find-run repro: O1,O3,U9 |
| 2 | [#804](https://github.com/ZenUml/web-sequence/issues/804) | message-introduced participants missing from autocomplete | participantManager.ts:39-51 | filed, unfixed. Find-run repro: N1,N2,N3,N5,N9,O4,O6,U10 |
| 3 | [#807](https://github.com/ZenUml/web-sequence/issues/807) | U6: keyword-prefixed names (`ifService`→`Service`) split by Lezer lexer (no word boundary) | grammar/zenuml.grammar | filed. Fix: @specialize keywords + regen. HIGH impact |
| 4 | [#806](https://github.com/ZenUml/web-sequence/issues/806) | P9: block keyword leaks into name slot when typed token IS a reserved keyword | zenumlAutocomplete isNamingDeclaration | filed. Fix: same-line text guard |
| 5 | [#805](https://github.com/ZenUml/web-sequence/issues/805) | K7: `@` inside a message label (`A->B: @`) offers participant annotations | zenumlAutocomplete:258 | filed. Fix: isInsideMessageContent guard |

| 6 | [#808](https://github.com/ZenUml/web-sequence/issues/808) | editor grammar rejects string labels `as "The User"` the renderer accepts | grammar Label rule | FIXED (Label arg required, accepts Identifier\|String) |
| 7 | [#809](https://github.com/ZenUml/web-sequence/issues/809) | editor rejects non-ASCII (Chinese) names the renderer accepts | grammar Identifier + autocomplete regexes | FIXED in 2 layers: grammar Unicode ranges + Unicode-aware completion (atMessageEndpoint/word/validFor) |

**Bad tests (verified — fix the SPEC, not the product):** L4 (single-field snippet paints 0
`.cm-snippetField` by CM design → assert 0 + `return value`), M7 (Shift-Tab no-op past last
field w/o `$0` → assert `B->A: msgCaller`), V4 (pos 0 = `top` union, correct → assert
hint-participant present, don't assert hint-sync absent), V7 (`}` line stays `block` by
left-bias → press Enter to a new line first, then assert hint-participant).

**P6 round 1 (i18n/quotes/special/scale — user-requested):** probed editor vs ANTLR oracle.
Found #808 (string labels) + #809 (Unicode names, 2 layers). NOT bugs (editor correctly
matches renderer): single-quote labels (`as 'x'`), emoji-led names — both rejected by the
renderer too. Added: 9 unit tests (participantManager i18n/scale incl. 100-participant doc) +
e2e area W (9 cases: Chinese completion, string/color labels, quotes, special chars, emoji
no-crash, 40-msg long DSL). Screenshot proof: web/tmp/chinese-render.png (Chinese diagram
renders end-to-end). 7 distinct bugs found+fixed total.

## Improvement backlog (real-user lens — refine as tests surface evidence)
Priority H/M/L. These are hypotheses; the find-run + user-journey thinking promote them.
- **H** Autocomplete after-dot context correctness (#803).
- **H** Message-endpoint participants in completion (#804).
- **H** No error feedback: linter is intentionally unwired (`modes.ts`); a user typing
  invalid DSL gets zero in-editor signal. Renderer logs to console only. Evaluate wiring
  diagnostics WITHOUT false-positiving on renderer-valid DSL (use the ANTLR oracle).
- **M** Participant label+color grammar gap: `@Type Name as "Label" #color` splits into
  two participants (noted in slashCommands.ts) — users want both label and color.
- **M** Snippet placeholder ergonomics (tab-stop flow, $0 final cursor, replace-on-type).
- **M** Autocomplete ranking/dedup quality (boost order, label+detail rows).
- **M** Forward-reference: participant used before declaration still offered.
- **L** Highlighting flat spots; comment/string completion suppression completeness.
- **L** Hint-bar zone-transition accuracy.

## Cleanup TODO
- Remove design-agent scratch spec(s): `web/e2e/_probe_indent.spec.ts` (and any `_*.spec.ts`)
  AFTER Workflow 1 finishes (deleting mid-run could race a live agent).

## Usage guardrail (user rule)
Cron `e876aa05` (every 30 min) checks https://claude.ai/settings/usage. **STOP the
campaign immediately if weekly "All models" ≥ 65% used.** Binding bucket = "All
models" weekly. Sonnet-only weekly has far more headroom → route fan-out subagents
to Sonnet (`model:'sonnet'`) to extend runway; keep main loop (Opus) for judgment.
Readings log:
- 2026-06-09 first check: All-models weekly **55%**, Sonnet-only 17%, session 17%. UNDER cap → continue.
- 2026-06-09 2nd check (~30m later): All-models **56%**, Sonnet-only 18%. +1%/30m despite 2 design + 1 verify workflow + grammar agent → Sonnet routing effective. UNDER cap → continue.

## Progress log (append-only, newest last)
- 2026-06-09 — P0/P1 done. Filed #803, #804. Built+served :4399. Launched Workflow 1
  (design-editor-100-cases). Wrote this plan. Awaiting design completion.
- 2026-06-09 — Set usage-guardrail cron e876aa05 (30 min). First reading 55% all-models
  weekly → continue. Decision: run future fan-out subagents on Sonnet (budget). Resuming
  campaign: waiting on Workflow 1, then assemble+run find phase.
- 2026-06-09 — P5 complete (5 bugs, commits 33a4010, c00501f). P6 round-1 (i18n, user-requested):
  found+fixed #808 (string labels) + #809 (Unicode/Chinese names, grammar + completion layers).
  Commit 1beb7f4. 7 bugs total. Suite: 172 e2e + 214 unit green. Screenshot web/tmp/chinese-render.png.
  Guardrail 56% at last check. NEXT P6 round-2: authoring journeys (rename/insert participant),
  control-flow nesting/fragments, undo/redo, paste — find→verify→fix.

## P6 round 2 — grammar-gap hunt toward error feedback
modes.ts disables the Lezer linter because the editor grammar under-accepts vs the renderer
(2 named false-positive cases: declare-then-message [now resolved] + quoted method names).
Closing gaps is the team's stated path to enabling error feedback. Found+fixed:
- #810 quoted method names `A."some method"()` — `MethodName { (Identifier | String) }`.
- #811 four under-accept gaps: `async A->B`, `loop (N){}` (new LoopKeyword), `@Starter(arg)`
  then statement (Head termination), method-arg literals `A.b(1,"two",true)` (Parameter Literal).
Added `src/editor/conformance/noFalsePositive.test.ts` — 38 renderer-valid inputs must parse with
0 Lezer error nodes (the linter-safety property). Both named blockers now clear. Bugs total: 9.
NEXT options: (a) more gap-hunting + enable linter via ANTLR oracle (no false-positive by
construction); (b) more authoring-journey find rounds.
- 2026-06-09 3rd check: All-models weekly **57%**, Sonnet-only 18%, session 25%. +1% over ~1h
  despite 2 grammar subagents + e2e cycles → Sonnet routing + script verification very efficient.
  UNDER cap → continue.
- 2026-06-09 — P6 round 3: authoring-journey e2e (area X, 7 cases, all green — journeys robust).
  Dogfooding (think-as-user) found #813 completion NOISE: typing a free-text label/title/alias
  whose word prefixes a keyword pops that keyword (`A->B: title screen` → `title`). Fixed with a
  free-text-span guard (Content/LineContent/Label/String → no completions); endpoint completion
  preserved. +area Y (5 cases). Commits e8af92a (X), e9a3738 (#813). Bugs total: 11 (#803-813).
  Remaining minor edges (not fixed): `#titl` invalid-color noise, `A."titl` quoted-method noise.

## P6 round 4 — FEATURE: CJK/full-width punctuation auto-correction (user-requested)
A CJK-IME user accidentally types full-width punctuation (。，：；（）｛｝＃＠…) where ZenUML needs
ASCII (`.` `,` `:` `;` `()` `{}` `#` `@`). New `src/editor/cjkAutocorrect.ts`: a transactionFilter
(robust to IME-committed input) rewrites these to ASCII AS TYPED — but only in CODE positions, never
inside a free-text label/title/comment/string (Content/LineContent/String/Comment/Label guard,
mirrors #813), where CJK punctuation is legitimate content. Wired into the DSL language only (modes.ts).
Tests: 14 unit (cjkAutocorrect.test.ts) + e2e area Z (3). e.g. `订单服务。save（）`→`订单服务.save()`,
label `创建订单。完成（确认）` preserved. Extends the #809 Chinese-author support.
- 2026-06-09 4th check: All-models weekly **58%**, Sonnet 18%, session reset to 3%. +1%. UNDER → continue.
- 2026-06-09 5th check: All-models weekly **59%**, Sonnet 18%, session 6%. +1%. UNDER → continue.
  CJK autocorrect (round 4) complete: punctuation + full-width space/digits + free-text preservation
  incl. the empty-first-char label/title edge (AsyncMessage-past-Colon / Title-past-keyword guard).
  21 unit + 3 e2e + demo (web/tmp/cjk-autocorrect-demo.png). Commits e986cba, +edge.
- 2026-06-09 6th check: All-models weekly **59%** (flat), Sonnet 18%, session 9%. UNDER → continue.
  CJK autocorrect: real-browser integration test caught that the transactionFilter dropped the
  userEvent → autocomplete stopped firing after an auto-corrected dot. Fixed by re-attaching
  userEvent; +Z4 e2e (autocorrect ∘ autocomplete). Feature now bulletproof: 21 unit + 4 e2e.
- 2026-06-09 7th check: All-models weekly **60%**, Sonnet 18%, session 13%. +1% (~2.5h runway to cap).
  Added 『』〖〗→{} CJK corner/lenticular brackets to autocorrect (user request); 「」 deliberately
  left out (ambiguous quote vs brace). +2 unit +Z5 e2e. NOTE: tighten verification (fewer full reruns)
  as we approach the 65% cap.
- 2026-06-09 8th check: All-models weekly **61%** (fresh), Sonnet 18%. ~4% headroom to the 65% cap
  (~2h). CJK autocorrect thread CLOSED (arrow → skipped: not keyboard-typable; 「」 skipped: ambiguous).
  Campaign deliverables complete: 11 bugs (#803-813) + CJK autocorrect feature; 189 e2e + 277 unit
  green; 19 commits; tree clean. HOLDING for user's next direction (wrap up / new direction / mine more).
- 2026-06-09 9th check: All-models weekly **61%** (flat — idle, holding for direction). UNDER → continue.

## State at pause (2026-06-09, usage 61%)
CJK autocorrect feature COMPLETE incl. variant-completeness audit (found 。 was the only period
variant → added ． U+FF0E, halfwidth ｡､, angle 〈〉, white parens ｟｠). Final: 280 editor unit +
189 e2e green; tree clean; 21 campaign commits. Deliverables done: 11 bugs (#803-813) + CJK
autocorrect. PAUSED for user direction (budget ~4% from the 65% cap; user away, guardrails auto-firing).
Resume options offered: wrap-up / new direction / more mining.
- 2026-06-09 10th check: All-models weekly **62%**, Sonnet 18%. ~3% headroom. UNDER → continue.
  Still PAUSED for direction (deliverables complete; conserving budget while user away).
- 2026-06-09 — Usage-guardrail cron e876aa05 CANCELLED by user. No scheduled jobs remain; no more
  automated usage checks. Campaign complete + paused; awaiting direction.
- 2026-06-10 — RESUMED by user request: tree-structured test catalog. (1) Fixed+committed user-reported
  dot bug (76bddeb: post-`Name.` participant popup suppressed — method-name slot). (2) 10-agent workflow
  built `e2e/TEST_TREES.md`: keyboard-first typing-path trees, 3 subsystems, 264 leaves
  (149 covered / 91 GAP / 34 GAP-UNSURE / 24 DEBATABLE / 25 needs-spec), 124-item gap ledger,
  top-25 shortlist. (3) Tranche 1 implemented: +47 unit (zenumlLanguage free-text keyword colors,
  half-typed states; cjkAutocorrect anti-mirror enumeration; NEW indentInvariant.test.ts gate) and
  NEW e2e/typing-mechanics.spec.ts (7: pair-delete, }-type-over, Enter-continuation, closer-column,
  mid-statement Enter, Shift-Tab dedent, multi-line Tab). (4) Bugs found+filed: #814 (empty free-text
  regions leak completions — TT-A1/A2/A34, it.fails), #815 (CJK map gaps ＇［］＿ — it.fails).
  (5) 76bddeb fallout: 15 stale catalog tests reconciled (5 flipped, 10 re-grounded on -> triggers).
  Suites: 329 unit (incl. 4 it.fails) + 196 e2e green. NEXT: fix #814/#815 test-first; shortlist
  items 7+ (TT-A9 fullwidth arrow e2e, TT-A14 backspace-refilter, TT-H34 font gate); needs-spec
  decisions (IME composition, undo-after-autocorrect, fullwidth-opener autopair).
- 2026-06-10 (cont.) — FIX ROUND: #814 fixed (completion guard now shares isFreeTextSpan with
  autocorrect — empty label/title/divider slots silent; 3 it.fails→green). #815 fixed
  (＇［］＿ added; enumeration exclusion-free). FEATURE: → U+2192 → '->' (first 1→2 map entry,
  selection remap keeps cursor after arrow, userEvent preserved → popup auto-fires; label →
  preserved; +5 unit). Both issues closed with evidence. Gates: unit 333×2 + tsc, e2e 213/213
  (fresh build), agent-browser live journeys (mandated) — incl. discovery that agent-browser
  `press Control+Space` emits a malformed keydown; synthetic KeyboardEvent + positive control
  is the working recipe (recorded in TEST_TREES.md update 2).
- 2026-06-10 (final) — DECISION ROUND: user ratified D1-D7 (recorded in TEST_TREES.md). Implemented via
  worktree subagent + adversarial review (1 minor finding fixed: parse-frontier fail-safe): autocorrect
  moved to updateListener architecture — undo restores typed original (D2), composition-safe (D1, CDP-IME
  e2e Z9), corrected openers autopair (D3, Z6), per-char paste classification (TT-I14 fixed, Z8), D7
  comment+test. Final test batch: TT-A14/A16/A19/A31/H14/H34 + D5/D6 pins. TOP-25 SHORTLIST CLOSED.
  Suites 353 unit + 229 e2e green; agent-browser live journeys for D2/D3/I14 (Meta+z also broken in
  agent-browser — synthetic KeyboardEvent recipe). Remaining: ~80 low-priority ledger items + open
  debatables (comment-in-label, hex-color token, quoted-method color, indent unit).
