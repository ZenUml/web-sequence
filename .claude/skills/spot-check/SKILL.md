---
name: spot-check
description: >
  Ad hoc, AI-driven verification of a specific behavior on ZenUML web-sequence —
  not a new checked-in E2E test. Use after developing a feature, fixing a bug,
  validating a branch, checking staging, or post-release on app.zenuml.com.
  Drives Playwright (CLI or MCP) against the live app and #demo-frame preview.
  Triggers on "spot check", "run a spot check on X", "spot check this fix",
  "spot check on staging", "spot check staging.zenuml.com", "verify on prod".
---

# Spot Check

A **spot check** is an ad hoc, AI-driven, ephemeral verification of a specific behavior. It is not meant to become a permanent regression suite entry unless the team explicitly promotes it later.

**What it is NOT:** inventing a new `e2e/tests/*.spec.js` during the spot check, a full regression pass, or a substitute for CI.

**What it CAN reuse:** existing Playwright specs as **recipes** (run them; do not edit them unless fixing a real bug).

## Key principles

- **Lightweight** — smallest set of checks that cover the delta.
- **AI-driven** — plan assertions first, then execute with Playwright CLI and/or browser tools.
- **Ephemeral** — steps live in the chat/report, not a new committed test file.
- **Targeted** — verify the behavior under review, not every sidebar modal.
- **Real world** — prefer deployed staging/prod when the question is “did the deploy work?”

## Write the plan first

**STOP.** Do not open the browser or run Playwright until the plan is written.

Each planned check must name:

1. **Behavior** — what changed or what you are verifying
2. **Observable signal** — DOM text in `#demo-frame`, visible SVG, modal title, localStorage key, network response, etc.
3. **Method** — Playwright step, `pnpm exec playwright test …`, screenshot, console check

Each item must be independently pass/fail before you run it.

```text
Spot check plan: <short title>

Target: <http://127.0.0.1:3000 | https://staging.zenuml.com | https://app.zenuml.com>
  - [ ] <specific observable assertion>  [method]
  - [ ] <specific observable assertion>  [method]

Skipped: <anything out of scope> — <reason>
```

For **post-release** spot checks (release delta, commit triage, N/A rules), follow Step 5.5 in the **release-app** skill.

For **branch validation** before push, follow Step 3 in the **validate-branch** skill after writing the plan here.

## Choosing the environment

| Situation | Target |
|-----------|--------|
| Unreleased frontend (local branch) | `yarn dev` → `http://127.0.0.1:3000` (Vite default) |
| PR / “did staging deploy work?” | `https://staging.zenuml.com` |
| Production issue or post-release | `https://app.zenuml.com` |
| Prod-build bundling only (no deploy) | `PW_PROD_BUILD=1 pnpm exec playwright test e2e/tests/production-build.spec.js` |
| CI already green on staging | Trust gate, then spot-check only the **delta** on staging or prod |

## Verification methods

| Signal | How |
|--------|-----|
| Diagram render / DSL | Set CodeMirror value or type; poll `#demo-frame` `contentDocument` for SVG + label text; screenshot preview |
| Editor / modals / pages | Playwright on parent page (`getByTitle`, `getByRole('dialog')`) |
| Save / localStorage | `Meta+s` / `Control+s`; poll `item-*` keys (see `e2e/tests/smoke.spec.js`) |
| Deployed URL regression (broad) | `PW_BASE_URL=<url> pnpm exec playwright test --project=chromium` |
| DSL shapes (recipe) | `PW_BASE_URL=<url> pnpm exec playwright test e2e/tests/dsl-spot-check.spec.js --project=chromium --workers=1` |
| Fast prod sanity (recipe) | `PW_BASE_URL=https://app.zenuml.com pnpm exec playwright test --grep @smoke --project=chromium` |
| Analytics (optional) | Mixpanel MCP if the change emits events |

## Pre-flight (UI checks)

Before interacting on any URL:

1. **Suppress first-save dialog** (unsigned-in): in `page.addInitScript` or browser console before reload:
   `localStorage.setItem('loginAndsaveMessageSeen', 'true')`
2. **Preview iframe** — most diagram truth lives in `#demo-frame`, not the parent DOM. Use `page.frameLocator('#demo-frame')` or `contentDocument` polling like the smoke spec.
3. **Third-party noise** — GTM/Zaraz/Paddle may throw; CI ignores known sources (`THIRD_PARTY_ERROR_SOURCES` in `smoke.spec.js`). Do not fail the spot check on those alone.

## Workflow

1. **Plan** — behavior, target URL, observable assertion per line (see above).
2. **Choose environment** — table above.
3. **Execute** — run each `[ ]` check; capture screenshots for diagram assertions (`render-diagram-*` style evidence in report).
4. **Report** — pass / fail / skipped per assertion; attach screenshot paths or Playwright report URL.

```text
Spot check report: <title>
- Target: <url>
- Results: <n> pass, <n> fail, <n> skipped
- Evidence: <screenshots / playwright report / CI run>
- Failures: <assertion> — <what you saw>
```

## Playwright recipes (existing specs)

Use these when they match the plan — **do not** treat running a spec as “the whole spot check” unless the delta is genuinely “general deploy health.”

| Recipe | Command |
|--------|---------|
| Full staging gate (CI parity) | `PW_BASE_URL=https://staging.zenuml.com pnpm exec playwright test --project=chromium --workers=1` |
| DSL + diagram screenshots | `PW_BASE_URL=<url> pnpm exec playwright test e2e/tests/dsl-spot-check.spec.js --project=chromium --workers=1` |
| Prod smoke subset | `PW_BASE_URL=https://app.zenuml.com pnpm exec playwright test --grep @smoke --project=chromium` |
| Static `dist/` guard | `pnpm build && PW_PROD_BUILD=1 pnpm exec playwright test e2e/tests/production-build.spec.js --project=chromium` |

After a recipe run, open the HTML report if the user needs visual proof:

```bash
pnpm exec playwright show-report
```

## Browser tooling

| Tool | Use for |
|------|---------|
| **Playwright CLI** | Repeatable checks, CI parity, screenshot attachments in report |
| **Playwright MCP** (`user-playwright`) | Ad-hoc navigation when CLI is awkward |
| **cursor-ide-browser** | Quick visual confirmation; use `browser_cdp` / `Runtime.evaluate` for `#demo-frame` innards |

The preview iframe is same-origin accessible from Playwright tests; still scope selectors to the frame for diagram content.

## Related skills

| Skill | When |
|-------|------|
| **validate-branch** | Pre-push; write plan here, then execute |
| **release-app** | Step 5.5 — release-delta spot check after publish |
| **ship-branch** | Merge path; staging gate is CI, not a substitute for delta spot check |
| **babysit-pr** | Fix CI, not product verification |

## Rules

- Never mark PASS without observing the planned signal (text in iframe, screenshot, or green Playwright assertion).
- Never write a new spec file during a spot check unless the user asks to promote the check into CI.
- Never spot-check prod with destructive flows (account deletion, billing, mass Firebase writes).
- Prefer staging for experimental DSL edits; use prod for release-delta confirmation only.
