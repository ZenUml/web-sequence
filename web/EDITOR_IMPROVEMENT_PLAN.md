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
