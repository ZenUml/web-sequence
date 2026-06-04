---
name: validate-branch
description: Run local validation checks for ZenUML web-sequence before pushing, opening a PR, or merging. Use when the user says "validate", "check branch", "run tests", "preflight", "is this ready", or before submit-branch or ship-branch. Covers Yarn/Vite/Jest/Playwright checks, build/release risk, and spot-check plans for UI/diagram changes (see spot-check skill).
---

# Validate Branch

Verify the current branch is locally sane before it reaches GitHub Actions.

## Repo Facts

- Repository: `ZenUml/web-sequence`
- Base branch: `master`
- Package manager for local development: Yarn (`yarn install`, `yarn dev`, `yarn build`)
- CI currently uses pnpm in GitHub Actions, so note any Yarn/pnpm divergence instead of hiding it.
- App dev server is Vite on `http://127.0.0.1:3000` (Playwright can auto-start via `pnpm dev`).

## Workflow

### 1. Check Scope

Run:

```bash
git status --short --branch
git diff --name-only master...HEAD
```

If the worktree has unrelated local changes, do not stage or revert them. Validate the current branch changes and mention the unrelated files in the report.

### 2. Choose Checks

Run the smallest set that gives real confidence:

- Always: `yarn build`
- Unit-test changes or shared logic: `yarn test`
- UI behavior changes: start `yarn dev`, test the changed flow in browser, and run `yarn test:e2e` when the smoke suite is relevant.
- Release/extension changes: `yarn release` after `yarn build`
- Firebase/functions changes: inspect `functions/package.json` and run the relevant functions build/test/deploy dry-run command if available.
- Lint-sensitive changes: `yarn lint`, but if local ESLint is blocked by missing `eslint-config-synacor`, report that as an environment/config blocker and continue with other checks.

Do not run expensive or stateful deploy commands unless the user explicitly asks.

### 3. Feature spot check (UI / diagram changes)

**When to skip:** docs-only, CI/workflow-only, unrelated skill files.

For changes under `src/components`, `src/style.css`, `src/assets/tailwind.css`, `vite.config.js`, `e2e/`, or `@zenuml/core` integration:

#### 3a. Write a spot check plan first

Use the **spot-check** skill — write the plan (behavior, target URL, assertions, method) **before** touching the browser or Playwright.

#### 3b. Choose how to test

| Situation | Target |
|-----------|--------|
| Branch not deployed yet | `yarn dev` → `http://127.0.0.1:3000` |
| Validating staging deploy | `PW_BASE_URL=https://staging.zenuml.com` + Playwright |
| `@zenuml/core` / preview iframe | Assert inside `#demo-frame` (see **spot-check** skill) |
| Broad DSL/renderer regression | Run `e2e/tests/dsl-spot-check.spec.js` as a recipe (optional) |

#### 3c. Execute the plan

Follow the **spot-check** skill workflow. Prefer Playwright CLI for repeatability; use browser MCP for ad-hoc steps.

For each `[ ]` assertion: interact → observe signal → screenshot diagram/preview when visual proof matters.

If every assertion passes: Step 3 **PASS**. If any fails: **FAIL** — include which assertion failed and evidence path; fix code, then re-run from §2.

**Common gotchas:** see **spot-check** skill (iframe scope, `loginAndsaveMessageSeen`, third-party console noise). Branch-specific:

- *Dev vs CI package manager:* local `yarn build`, CI `pnpm build` — run `pnpm build` if the change touches lockfile or Vite resolution.
- *Empty preview canvas with passing text poll:* capture `render-diagram-*` screenshot; layout/CSS regressions need visual evidence.

### 4. Report

Use this shape:

```text
Validation: PASS|FAIL|PARTIAL
- Build: ...
- Tests: ...
- Browser smoke: ...
- Skipped: ... (reason)
- Unrelated local changes: ...
```

FAIL means a required check failed. PARTIAL means useful checks passed but one check could not run because of environment, credentials, missing config, or an intentionally skipped scope.

## Rules

- Never mark validation PASS if a required check was skipped or blocked.
- Never clean, revert, or stage unrelated local files.
- Prefer fixing reproducible local failures before suggesting CI retry.
- Preserve the exact failing command and the important error lines in the final report.
