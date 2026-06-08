# ZenUML DSL Editor — Browser Test Catalog

Behavioral catalog for the editor-intelligence layer, **all driven through a real
browser** (CodeMirror 6 keymap/snippet/popup/highlight machinery does not run
faithfully in jsdom — see `docs/superpowers/specs/2026-06-08-editor-verification-retrospective.md`).

Format: **GIVEN** I typed `xxx`, **WHEN** I type/press `yyy`, **THEN** `zzz`.

Status legend:
- ✅ driven live and passing (this catalog's bring-up session)
- ◻️ authored, not yet driven
- ⚠️ known gap / expected-fail on current code (linked to ADR 0002 open work)

---

## Harness — how to drive these (verified agent-browser recipe)

These are the **working** primitives discovered during bring-up. Wrong ones (and
why) are listed at the end so nobody re-discovers them.

```
# 1. open + seed onboarding so the editor is reachable, then reload
agent-browser open http://localhost:3000
agent-browser eval 'localStorage.setItem("onboarded","true");localStorage.setItem("lastSeenVersion","\"9999.0.0\"");localStorage.setItem("pledgeModalSeen","true");localStorage.setItem("loginAndsaveMessageSeen","true");"seeded"'
agent-browser open http://localhost:3000
agent-browser wait "[data-testid=dsl-editor] .cm-content"

# 2. if a "Welcome to ZenUML" modal is present, CLOSE it (it eats keystrokes)
agent-browser snapshot -i            # find the "Close" button ref
agent-browser click @<close-ref>

# 3. find the editor ref once (unnamed textbox); reuse it as @EDITOR
agent-browser snapshot -i            # the editor is `textbox [ref=eNN]:` (no name)

# CLEAR (start of EVERY case) — variable-free eval (eval context persists!):
agent-browser eval 'document.querySelector("[data-testid=dsl-editor] .cm-content").focus();document.execCommand("selectAll");document.execCommand("delete");"cleared"'

# TYPE literal text: use the element-scoped command, NOT `keyboard type`
agent-browser type @EDITOR "@Actor Alice"
# newline:
agent-browser press Enter

# PRESS keys / accept:
agent-browser press Tab          # accept completion / advance snippet field
agent-browser press Enter        # accept completion / newline
agent-browser press Escape       # close popup
agent-browser press Control+Space  # force-open completion (needed after multi-char `type`)

# OBSERVE — popup option rows (label+detail concatenated):
agent-browser eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.cm-tooltip-autocomplete li')].map(e=>e.textContent))
EOF
# OBSERVE — editor text:
agent-browser eval 'JSON.stringify(document.querySelector("[data-testid=dsl-editor] .cm-content").innerText)'
# OBSERVE — snippet field count:
agent-browser eval 'String(document.querySelectorAll("[data-testid=dsl-editor] .cm-snippetField").length)'
# OBSERVE — error markers:
agent-browser eval 'String(document.querySelectorAll(".cm-lintRange-error, .cm-lint-marker-error").length)'
# OBSERVE — token color of a span (highlighting):
agent-browser eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('[data-testid=dsl-editor] .cm-line span')].map(e=>({t:e.textContent,c:getComputedStyle(e).color})))
EOF
```

Caveats (DO NOT re-learn the hard way):
- A pre-written script/subagent with these UNVERIFIED would not fail fast — it
  **hangs** (agent-browser default timeout is 25s/command; a flailing driver
  burns minutes). Bring up the primitives interactively first, then script.
- `keyboard type "multiChar"` throws `Invalid 'text' parameter`. Use `type @ref`.
- `Meta+a` / `Control+a` do **not** trigger CM6 select-all here. Use `execCommand`.
- `eval` runs in ONE persistent context — top-level `const`/`let` collide across
  calls. Use no variables, or wrap in `(function(){…})()`.
- Multi-char `type "/sync"` does not keep the completion popup live; type the
  trigger and re-open with `Control+Space`, or type the last char separately.
- `type` can drop some punctuation (`.`, `(`) under closeBrackets; verify the
  editor text before trusting a popup assertion. Prefer block openers without
  them (e.g. `par {`) when you just need a block.
- After typing a trigger char, `agent-browser wait 300` before reading the popup
  (past CM's 75ms completion interactionDelay).

---

## A. Annotation completion (`@`)

**A1** ✅ GIVEN an empty editor, WHEN I type `@`, THEN the popup lists participant-type annotations including `@Actor`, `@Database`, `@Boundary`, and cloud types (`@Lambda`, `@S3`).

**A2** ◻️ GIVEN an empty editor, WHEN I type `@Da`, THEN the popup narrows to annotations beginning "Da" (e.g. `@Database`, `@DynamoDB`) and excludes `@Actor`.

**A3** ✅ GIVEN an empty editor, WHEN I type `@` then press Tab, THEN `@Actor` is accepted and the line reads `@Actor` with NO leading whitespace.

**A4** ◻️ GIVEN an empty editor, WHEN I type `@` then press Enter, THEN `@Actor` is accepted and the line reads `@Actor`.

**A5** ◻️ GIVEN I typed `par {` then Enter (cursor inside the block), WHEN I type `@`, THEN NO annotation popup appears (annotations are head-only).

---

## B. Slash commands — zone gating, insertion, field navigation

**B1** ✅ GIVEN an empty editor, WHEN I type `/`, THEN the popup offers exactly `/participant` and `/group` (head zone).

**B2** ✅ GIVEN I typed a brace block and put the cursor inside it (`par {` + Enter), WHEN I type `/`, THEN the popup offers block commands (`/sync`, `/async`, `/if`, `/while`, `/par`, `/opt`, `/try`, `/return`, `/reply`, `/new`, `/section`, `/ref`, `/note`) and NOT `/participant`/`/group`.

**B3** ◻️ GIVEN I typed `group G {` then Enter (cursor in the group body), WHEN I type `/`, THEN the popup offers head commands (`/participant`, `/group`) — group bodies hold participant declarations.

**B4** ⚠️ GIVEN an empty editor (top-level statement position), WHEN I type `/sync`, THEN `/sync` is NOT offered (only `/participant`/`/group` show) — message commands are unavailable at the top level. *Known top-level slash-zone gap (ADR 0002 open work #2); desired behavior is to offer block commands here.*

**B5** ◻️ GIVEN the cursor is in a block, WHEN I type `/if` and accept, THEN the editor inserts `if(condition) {` with the `condition` field active and one snippet field present.

**B6** ✅ GIVEN I accepted `/sync` inside a block (snippet active, target field selected), WHEN I type `Svc`, press Tab, type `doWork`, THEN the editor contains `Svc.doWork() {` (target in field 1, method in field 2).

**B7** ◻️ GIVEN I accepted `/sync` in a block and typed `Svc`, Tab, `doWork`, WHEN I press Shift-Tab and type `X`, THEN field 1 becomes `X` while field 2 keeps `doWork` → `X.doWork() {`.

**B8** ◻️ GIVEN the cursor is in a block, WHEN I accept `/try`, THEN the editor inserts a `try { … } catch(e) { }` template with the try-body field active.

**B9** ◻️ GIVEN the cursor is in a block, WHEN I accept `/note`, THEN the editor inserts `// comment` with the comment text field active.

---

## C. Head keyword sub-positions (statement-start vs name slot vs modifier slot)

**C1** ✅ GIVEN an empty editor, WHEN I type `t`, THEN the popup offers `title`.

**C2** ◻️ GIVEN an empty editor, WHEN I type `g`, THEN the popup offers `group`.

**C3** ✅ GIVEN I typed `@Actor ` (trailing space), WHEN I type `a`, THEN the popup does NOT offer `as` (this slot is the participant name).

**C4** ◻️ GIVEN I typed `@Actor ` (trailing space), WHEN I type `t`, THEN the popup does NOT offer `title` (name slot, not statement-start).

**C5** ✅ GIVEN I typed `group ` (trailing space), WHEN I type `a`, THEN the popup does NOT offer `as` (this slot is the group name).

**C6** ✅ GIVEN I typed `@Actor Alice ` (a complete name then a space), WHEN I type `a`, THEN the popup OFFERS `as` (the label/modifier slot — `as` is valid here).

**C7** ◻️ GIVEN I typed `@Actor <<service>> ` (annotation + stereotype + space), WHEN I type `a`, THEN the popup does NOT offer `as` (still the name slot).

---

## D. Block keywords

**D1** ◻️ GIVEN the cursor is in a block, WHEN I type `i`, THEN the popup offers `if` and NOT the head keyword `title`.

**D2** ◻️ GIVEN the cursor is in a block, WHEN I type `w`, THEN the popup offers `while`.

**D3** ◻️ GIVEN the cursor is in a block, WHEN I type `@`, THEN NO `@`-annotation popup appears (annotations are head-only).

---

## E. Participant-name completion

**E1** ◻️ GIVEN I typed `@Actor OrderController`, Enter, `@Boundary Web`, Enter, WHEN I type `OrderController.`, THEN the popup offers participant names (`Web`, `OrderController`) after the dot.

**E2** ◻️ GIVEN two declared participants and the cursor at a message-start line inside a block, WHEN I type a partial name and press Control+Space, THEN the declared names are offered.

**E3** ✅ GIVEN I typed `@Actor Alice`, Enter, `@Actor Bob`, Enter, WHEN I type `Al` then press Control+Space, THEN the popup offers `Alice` (Bob filtered out by the prefix), labeled "participant".

**E4** ◻️ GIVEN declared `A` and `B` and the cursor in a block, WHEN I type `A->` then press Control+Space, THEN the popup offers `B` (a To-endpoint position).

**E5** ◻️ GIVEN declared `Alice` and `Bob`, WHEN I am typing the token `Ali` (the in-progress name), THEN the popup does NOT suggest the token currently under the cursor (no self-suggestion), but still offers `Bob`.

---

## F. Accept & keymap mechanics (must outrank @uiw `indentWithTab`)

**F1** ✅ GIVEN the `@` popup is open with `@Actor` highlighted, WHEN I press Tab, THEN `@Actor` is accepted (NOT indentation inserted before `@`).

**F2** ◻️ GIVEN a line with text and NO completion popup open, WHEN I press Tab at the line start, THEN the line indents (Tab falls through to `indentWithTab`).

**F3** ◻️ GIVEN a completion popup is open, WHEN I press Escape, THEN the popup closes and no text is inserted.

**F4** ◻️ GIVEN the `@` popup is open, WHEN I press Enter, THEN `@Actor` is accepted (NOT a newline inserted).

**F5** ◻️ GIVEN no popup and no active snippet, WHEN I press Enter, THEN a newline is inserted.

**F6** ◻️ GIVEN a multi-field snippet is active on field 2, WHEN I press Shift-Tab, THEN the cursor returns to field 1 (Shift-Tab outranks `indentLess`).

---

## G. Syntax highlighting

**G1** ✅ GIVEN an empty editor, WHEN I type `A->B: Hello`, THEN the `Hello` span has a non-default color (message content) and the `->` span is operator-colored.

**G2** ✅ GIVEN I typed `@Actor Alice` then Enter, WHEN I type `Alice->Bob: Hello`, THEN `Hello` has the SAME color as in a lone `A->B: Hello` (declare-then-message parses structurally — ADR 0002).

**G3** ◻️ GIVEN an empty editor, WHEN I type `@Actor Client`, THEN `@Actor` renders in the annotation/meta color, distinct from the `Client` name color.

**G4** ◻️ GIVEN an empty editor, WHEN I type `A.method()`, THEN the `method` span is function-colored, distinct from the base foreground.

---

## H. Auto-indentation

**H1** ◻️ GIVEN I typed `A.run() {` as a bare opener, WHEN I press Enter, THEN the new body line is indented exactly one unit (2 spaces).

**H2** ◻️ GIVEN the cursor is on an indented body line in a block, WHEN I type `}`, THEN it dedents to the opener's column.

**H3** ◻️ GIVEN nested brace blocks, WHEN I type each inner body line, THEN indentation is one unit per depth (2 spaces, then 4).

**H4** ◻️ GIVEN I typed `if(ready) {`, WHEN I press Enter, THEN the body indents (indent applies to control-flow blocks, not only method blocks).

---

## I. Hint Bar (context strip above the editor)

**I1** ◻️ GIVEN the cursor is in the document head, THEN the Hint Bar shows head commands (participant / group).

**I2** ◻️ GIVEN the cursor moves into a brace block, THEN the Hint Bar updates to show block commands.

---

## J. Negative / edge / no-false-positives

**J1** ◻️ GIVEN I typed `@Actor Client #FFEBE6`, Enter, `@Database DB`, Enter, `Client->DB: query`, THEN zero error markers appear (renderer-valid DSL; the linter is intentionally unwired).

**J2** ◻️ GIVEN I type garbage `!!!@@@###`, THEN the editor does not crash, shows no error markers, and fabricates no participant.

**J3** ✅ GIVEN I typed `@Actor Alice`, Enter, `Alice->Bob: Hello`, WHEN I inspect participant suggestions on a later line, THEN `Hello` is NOT offered as a participant (no fabrication — the conformance invariant, observed in-browser).

**J4** ◻️ GIVEN a mid-edit dangling arrow `A->` (no target yet), THEN the editor does not crash and fabricates no participant.

**J5** ◻️ GIVEN a freshly loaded, seeded editor, THEN no completion popup appears until I start typing (no spurious popup on load/focus).

**J6** ◻️ GIVEN I typed a comment line `// ` and then `/sync`, THEN no slash-command popup appears inside the comment. *(Verify — current behavior may differ; the slash source does not yet check for comment context.)*

---

## Coverage summary

| Area | Cases | Driven ✅ |
|---|---|---|
| A. Annotation completion | 5 | 2 |
| B. Slash commands | 9 | 3 |
| C. Head keyword sub-positions | 7 | 4 |
| D. Block keywords | 3 | 0 |
| E. Participant names | 5 | 1 |
| F. Accept & keymap | 6 | 1 |
| G. Highlighting | 4 | 2 |
| H. Auto-indentation | 4 | 0 |
| I. Hint Bar | 2 | 0 |
| J. Negative / edge | 6 | 1 |
| **Total** | **51** | **14** |

`⚠️` known gaps: **B4** (top-level slash zone). `J6` needs a behavior decision.
