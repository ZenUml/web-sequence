# ZenUML DSL Editor — Browser Test Catalog

Behavioral catalog for the editor-intelligence layer, **all driven through a real
browser** (CodeMirror 6 keymap/snippet/popup/highlight machinery does not run
faithfully in jsdom — see `docs/superpowers/specs/2026-06-08-editor-verification-retrospective.md`).

Format: **GIVEN** I typed `xxx`, **WHEN** I type/press `yyy`, **THEN** `zzz`.

Status:
- ✅ driven live via agent-browser on :3000 and passing
- ✅ᴾ verified in-browser via the committed Playwright e2e (`editor-language.spec.ts`); not reproducible through agent-browser (tooling limitation, noted)
- ⚠️ confirmed gap / expected-fail on current code

**Result: 49 / 51 pass; 2 confirmed gaps (B4, J6).**

---

## Harness — how to drive these (verified agent-browser recipe)

```
# open + seed onboarding, reload, close the welcome modal, grab the editor ref
agent-browser open http://localhost:3000
agent-browser eval 'localStorage.setItem("onboarded","true");localStorage.setItem("lastSeenVersion","\"9999.0.0\"");localStorage.setItem("pledgeModalSeen","true");localStorage.setItem("loginAndsaveMessageSeen","true");"seeded"'
agent-browser open http://localhost:3000
agent-browser wait "[data-testid=dsl-editor] .cm-content"
agent-browser snapshot -i            # close "Welcome to ZenUML" (Close button); find editor `textbox [ref=eNN]` (unnamed)

# CLEAR (start of EVERY case) — variable-free eval (the eval context PERSISTS across calls)
agent-browser eval 'document.querySelector("[data-testid=dsl-editor] .cm-content").focus();document.execCommand("selectAll");document.execCommand("delete");"ok"'

# TYPE alphanumeric/multi-char: element-scoped `type` (NOT `keyboard type`)
agent-browser type @EDITOR "@Actor Alice"
# TYPE a single punctuation char that `type` drops (`.`, `#`, `:`): use keyboard type
agent-browser keyboard type "."
# keys / accept
agent-browser press Enter | Tab | Escape | Control+Space
# OBSERVE
agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll(".cm-tooltip-autocomplete li")).map(e=>e.textContent))'   # popup
agent-browser eval 'JSON.stringify(document.querySelector("[data-testid=dsl-editor] .cm-content").innerText)'                      # text
agent-browser eval 'String(document.querySelectorAll(".cm-lintRange-error, .cm-lint-marker-error").length)'                        # error markers
agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("[data-testid=dsl-editor] .cm-line span")).map(e=>[e.textContent,getComputedStyle(e).color]))'  # token colors
```

**Caveats (learned the hard way — DO NOT re-discover):**
- An unverified script/subagent does NOT fail fast — it **hangs** (25s/command default timeout × retries = minutes). Bring up primitives interactively first.
- `keyboard type "multiChar"` → `Invalid 'text' parameter`. Use `type @ref` for words; `keyboard type` only for single chars.
- `Meta+a` / `Control+a` do NOT trigger CM6 select-all here → use `execCommand`.
- `eval` runs in ONE persistent context — no top-level `const`/`let` (they collide). Use no vars or an IIFE.
- multi-char `type "/sync"` drops the live popup → type the trigger then re-open with `Control+Space`.
- `type @ref` silently drops `.` `(` `#` (closeBrackets/key interplay) → use `keyboard type` for those, and ALWAYS verify editor text before trusting a popup assertion.
- `Shift+Tab` for snippet prev-field is NOT reliably delivered by agent-browser (see B7/F6).
- After typing a trigger, `wait 300` (past CM's 75ms completion interactionDelay).

---

## A. Annotation completion (`@`)

**A1** ✅ GIVEN empty, WHEN I type `@`, THEN the popup lists participant-type annotations incl. `@Actor`, `@Database`, `@Boundary`, `@Lambda`, `@S3` (24 rows).

**A2** ✅ GIVEN empty, WHEN I type `@Da`, THEN the popup includes `@Database` and `@DynamoDB` and EXCLUDES `@Actor`. *(CM uses fuzzy subsequence match, not prefix — `@Lambda`/`@Boundary` also match "d…a"; `@Actor` has no "d" so it's dropped.)*

**A3** ✅ GIVEN empty, WHEN I type `@` then Tab, THEN `@Actor` is accepted; line reads `@Actor` (no leading whitespace).

**A4** ✅ GIVEN empty, WHEN I type `@` then Enter, THEN `@Actor` is accepted; line reads `@Actor`.

**A5** ✅ GIVEN `par {` + Enter (cursor in block), WHEN I type `@`, THEN NO annotation popup appears (head-only). Observed popup `[]`.

---

## B. Slash commands — zone gating, insertion, field navigation

**B1** ✅ GIVEN empty, WHEN I type `/`, THEN exactly `/participant` + `/group`.

**B2** ✅ GIVEN cursor in a block, WHEN I type `/`, THEN block commands (`/sync`,`/async`,`/if`,`/while`,`/par`,`/opt`,`/try`,`/return`,`/reply`,`/new`,`/section`,`/ref`,`/note`) and NOT `/participant`/`/group`.

**B3** ✅ GIVEN `group G {` + Enter (group body), WHEN I type `/`, THEN `/participant` + `/group`.

**B4** ⚠️ GIVEN empty (top-level), WHEN I type `/sync`, THEN `/sync` is NOT offered (only head commands). *Known top-level slash-zone gap — ADR 0002 open work #2. Desired: offer block commands at top level.*

**B5** ✅ GIVEN cursor in a block, WHEN I accept `/if`, THEN inserts `if(condition) {` with a field active.

**B6** ✅ GIVEN `/sync` accepted in a block, WHEN I type `Svc`, Tab, `doWork`, THEN editor contains `Svc.doWork() {`.

**B7** ✅ᴾ GIVEN `/sync` accepted, `Svc`/Tab/`doWork` typed, WHEN I Shift-Tab and type `X`, THEN field 1 → `X`, field 2 keeps `doWork` → `X.doWork() {`. *Passes in Playwright (`/sync: Shift-Tab returns to field 1`); agent-browser's `Shift+Tab` does not drive snippet prev-field (observed `doWorkX`).*

**B8** ✅ GIVEN cursor in a block, WHEN I accept `/try`, THEN inserts `try { … } catch(e) { }`.

**B9** ✅ GIVEN cursor in a block, WHEN I accept `/note`, THEN inserts `// comment`.

---

## C. Head keyword sub-positions

**C1** ✅ GIVEN empty, WHEN I type `t`, THEN offers `title`.

**C2** ✅ GIVEN empty, WHEN I type `g`, THEN offers `group`.

**C3** ✅ GIVEN `@Actor ` + space, WHEN I type `a`, THEN does NOT offer `as` (name slot). Popup `[]`.

**C4** ✅ GIVEN `@Actor ` + space, WHEN I type `t`, THEN does NOT offer `title` (name slot). Popup `[]`.

**C5** ✅ GIVEN `group ` + space, WHEN I type `a`, THEN does NOT offer `as` (group name slot). Popup `[]`.

**C6** ✅ GIVEN `@Actor Alice ` + space, WHEN I type `a`, THEN OFFERS `as` (modifier slot).

**C7** ✅ GIVEN `@Actor <<service>> ` + space, WHEN I type `a`, THEN does NOT offer `as` (still naming). Popup `[]`.

---

## D. Block keywords

**D1** ✅ GIVEN cursor in a block, WHEN I type `i`, THEN offers `if`, not `title`.

**D2** ✅ GIVEN cursor in a block, WHEN I type `w`, THEN offers `while`.

**D3** ✅ GIVEN cursor in a block, WHEN I type `@`, THEN NO `@`-annotation popup (head-only).

---

## E. Participant-name completion

**E1** ✅ GIVEN `@Actor OrderController`, Enter, `@Boundary Web`, Enter, WHEN I type `OrderController.`, THEN offers `Web` + `OrderController` (dot via `keyboard type`).

**E2** ✅ GIVEN two declared participants + cursor in a block, WHEN I type a partial name (`Ban`) + Control+Space, THEN offers the matching declared name (`Banana`). *(Empty-word Ctrl+Space returned `[]`; a partial is needed.)*

**E3** ✅ GIVEN `@Actor Alice`, Enter, `@Actor Bob`, Enter, WHEN I type `Al` + Control+Space, THEN offers `Alice` (Bob filtered), labeled "participant".

**E4** ✅ GIVEN declared `A`,`B`, WHEN I type `A->` + Control+Space, THEN offers `B`.

**E5** ✅ GIVEN declared `Alice`,`Bob`, WHEN I type `Ali` + Control+Space, THEN offers `Alice` and does NOT suggest the in-progress `Ali` token.

---

## F. Accept & keymap mechanics (must outrank @uiw `indentWithTab`)

**F1** ✅ GIVEN `@` popup open, WHEN I press Tab, THEN accepts `@Actor` (no indent).

**F2** ✅ GIVEN a line with text, no popup, WHEN I press Tab at line start, THEN the line indents (`  abc`).

**F3** ✅ GIVEN a popup open, WHEN I press Escape, THEN popup closes, no text inserted (text stays `@`).

**F4** ✅ GIVEN `@` popup open, WHEN I press Enter, THEN accepts `@Actor` (not a newline).

**F5** ✅ GIVEN no popup/snippet, WHEN I press Enter, THEN inserts a newline.

**F6** ✅ᴾ GIVEN multi-field snippet on field 2, WHEN I press Shift-Tab, THEN returns to field 1. *Playwright-verified; agent-browser `Shift+Tab` artifact (see B7).*

---

## G. Syntax highlighting

**G1** ✅ GIVEN empty, WHEN I type `A->B: Hello`, THEN `Hello` is non-default colored and `->` is operator-colored.

**G2** ✅ GIVEN `@Actor Alice` + Enter, WHEN I type `Alice->Bob: Hello`, THEN `Hello` has the SAME color as in a lone message (declare-then-message parses structurally — ADR 0002).

**G3** ✅ GIVEN empty, WHEN I type `@Actor Client`, THEN `@Actor` is cobalt `rgb(122,162,255)` (meta), distinct from `Client` (base).

**G4** ✅ GIVEN empty, WHEN I type `A.method()`, THEN `method` is teal `rgb(92,200,192)` (function), distinct from base.

---

## H. Auto-indentation

**H1** ✅ GIVEN a brace block opener + Enter, THEN the body line is indented one unit (2 spaces). Observed `par {\n  \n}`.

**H2** ✅ᴾ GIVEN the cursor on an indented body line, WHEN I type `}`, THEN it dedents to the opener column. *(Playwright Journey 6.)*

**H3** ✅ᴾ GIVEN nested brace blocks, THEN indentation is one unit per depth (2, then 4). *(Playwright Journey 6.)*

**H4** ✅ᴾ GIVEN `if(ready) {` + Enter, THEN the body indents (control-flow blocks, not only method blocks). *(Playwright Journey 6.)*

*(H2–H4 use `.`/`(`/`{` openers that agent-browser's `type` mangles; the Playwright e2e drives them precisely and is green.)*

---

## I. Hint Bar

**I1** ✅ GIVEN cursor in the head, THEN the Hint Bar shows `/participant`, `/group`.

**I2** ✅ GIVEN cursor in a block, THEN the Hint Bar shows `/sync`, `/async`, `/return`, `/if`, `/while`, `/note`.

---

## J. Negative / edge / no-false-positives

**J1** ✅ GIVEN `@Actor Client #FFEBE6`, Enter, `@Database DB`, Enter, `Client->DB: query`, THEN **0 error markers** (renderer-valid; linter unwired).

**J2** ✅ GIVEN garbage `!!!@@@`, THEN no crash, 0 error markers, no participant fabricated.

**J3** ✅ GIVEN `@Actor Alice`, Enter, `Alice->Bob: Hello`, THEN `Hello` is NOT offered as a participant (no fabrication — conformance invariant, observed in-browser).

**J4** ✅ GIVEN a mid-edit dangling arrow `A->`, THEN no crash, 0 error markers.

**J5** ✅ GIVEN a quiescent (cleared) editor, THEN no completion popup appears until typing.

**J6** ⚠️ GIVEN a block with a comment `// /sync`, WHEN inspecting, THEN the slash popup SHOULD be suppressed — **but it is NOT**: `/sync`,`/async` pop inside the comment. *Confirmed gap: the slash completion source does not check for comment context. Desired: no slash popup inside comments. New finding from this catalog run.*

---

## Findings from the catalog run

1. **B4** (known) — top-level slash zone: message commands unavailable at the top level. ADR 0002 open work #2.
2. **J6** (NEW) — the slash-command popup fires inside comments (`// /sync` in a block pops `/sync`). The completion source should bail when the cursor is inside a `Comment` node.
3. **B7 / F6** — snippet **prev-field** (Shift-Tab) is correct in the editor (Playwright green) but agent-browser cannot drive `Shift+Tab` into a snippet field; use Playwright for those two.
4. **Highlighting** (G1–G4) and **declare-then-message parity** (G2) confirmed live: `@`=cobalt, `method`=teal, message `Hello`=string color identical with/without a preceding declaration.

## Coverage summary

| Area | Cases | ✅ live | ✅ᴾ e2e | ⚠️ gap |
|---|---|---|---|---|
| A | 5 | 5 | – | – |
| B | 9 | 7 | 1 | 1 |
| C | 7 | 7 | – | – |
| D | 3 | 3 | – | – |
| E | 5 | 5 | – | – |
| F | 6 | 5 | 1 | – |
| G | 4 | 4 | – | – |
| H | 4 | 1 | 3 | – |
| I | 2 | 2 | – | – |
| J | 6 | 5 | – | 1 |
| **Total** | **51** | **44** | **5** | **2** |
