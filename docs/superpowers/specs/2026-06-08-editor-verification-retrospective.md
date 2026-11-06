# Editor Language Rewrite — Verification Failure Retrospective & Plan

Trigger: the `/if` slash command inserts its snippet but **Tab does not advance**
between snippet fields (condition → body). A user hit it immediately; I had declared
the feature verified and committed it (`a020e52`). This document is the honest
root-cause of why my verification missed it, the verification strategy that would
have caught it, and the improvement plan.

## What actually broke

`if(${1:condition}) {\n  ${0}\n}` inserts correctly, but pressing Tab from field 1
does not move to `${0}`. Proven by a 3-scenario Playwright probe: even pressing Tab
*immediately* after insert (no typing, no popup) leaves the cursor in the condition,
so `BODYMARK` lands as `if(BODYMARK)`. It is a keymap-wiring bug in `CodeEditor.tsx`
(the `Tab → acceptCompletion` binding vs. the snippet field keymap), NOT a popup edge
case. The interactive layer was simply never exercised end-to-end.

## Why I missed it (root cause — no excuses)

1. **I tested artifacts, not behavior.** The unit tests assert that `zenumlCompletions`
   returns Completion objects whose `apply` is a `snippet()` — the *data shape*. They
   never drive a real EditorView through `insert → Tab → type`. Such a test passes even
   when Tab navigation is 100% broken at runtime.

2. **I ignored an explicit "NOT CONFIRMED" flag from my own agent.** The integration
   agent's followup #1 said verbatim: *"SNIPPET TAB-STOP NOT EMPIRICALLY CONFIRMED …
   jsdom can't reliably dispatch it — controller should confirm in yarn dev or
   Playwright. Do NOT assume working."* I read it, reported it as a "noted followup,"
   and shipped. **A flagged unknown was silently downgraded to a footnote.**

3. **Confirmation-shaped live checks.** My headed demo and the browser subagent each
   filled the *first* tab stop and stopped. Replacing a selected placeholder does NOT
   exercise Tab-between-fields. The subagent even reported "Tab-stop mechanic works"
   from a check that never pressed Tab to advance. I generalized "first field works" →
   "tab stops work."

4. **No full-journey test.** I never ran the complete journey a user does:
   `/if → Enter → type condition → Tab → type body → assert final text`. Screenshots
   captured *states*, not the multi-step *interaction*. The single keystroke that
   matters (Tab-to-next-field) was never pressed in any verification until the user asked.

5. **jsdom false confidence.** vitest+jsdom cannot faithfully run CodeMirror's keymap /
   snippet machinery. "813 unit tests pass" says nothing about the interaction layer —
   yet I cited it as if it covered the feature. The hardest-to-test, highest-user-value
   layer got the *weakest* verification.

**The pattern:** I verified the layers that were easy to assert (parse trees, completion
objects, static screenshots) and declared the interactive layer verified *by proxy*.

## Verification strategy (the standard going forward)

Apply to every interactive editor/UI feature:

1. **Behavior over artifacts.** For any feature whose value is a runtime interaction,
   the binding test drives a real browser and asserts observable end state (final
   document text, rendered diagram, marker counts) — not the shape of the objects that
   *should* produce it.
2. **Full journey, not first step.** Test the entire user sequence. For snippets:
   insert → navigate EVERY field with Tab/Shift-Tab → assert the final text. Never
   generalize from step 1.
3. **Flagged unknowns are blocking gates.** Any agent/self "NOT CONFIRMED / DO NOT
   ASSUME / unverified" note is a release blocker. It is resolved (confirmed by test or
   fixed) before "done" — never carried as a footnote.
4. **Name the coverage gap.** jsdom unit counts may not touch a layer. State explicitly
   which layer each test tier covers and which it CANNOT — so "813 pass" is never
   mistaken for interaction coverage.
5. **Checked-in e2e, not ad-hoc driving.** Repeated browser steps become a checked-in
   Playwright helper+spec (this repo: `e2e/`), per the standing "extract repeated
   Playwright steps" rule — which I violated by hand-driving the same flow 4+ times.

## Improvement plan (executed via ultracode workflow)

1. **Fix** the Tab-advance bug in `CodeEditor.tsx` keymap wiring; prove the fix with a
   keystroke test that navigates all fields.
2. **Build** a checked-in Playwright e2e spec (helpers module + spec) covering the editor
   language journeys at keystroke level:
   - slash insert + **multi-field Tab/Shift-Tab navigation** → assert final text
   - zone gating (head vs block command sets)
   - participant autocomplete (declared names offered; Ctrl+Space)
   - no false error markers on renderer-valid DSL
   - highlighting presence (key tokens carry a non-default color class)
3. **Adversarially re-verify EVERY interactive claim** I made earlier, end-to-end,
   explicitly hunting for other "verified-by-proxy" claims that don't hold at runtime.
4. **Checklist** for future editor milestones (this strategy as a gate list).
