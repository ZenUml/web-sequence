---
name: bump-zenuml-core
description: Upgrade the @zenuml/core dependency in ZenUML web-sequence to a newer version and open a reviewable PR, with BEFORE/AFTER rendering evidence. Use when the user says "bump core", "update ZenUML core", "upgrade @zenuml/core", "更新 core 依赖", "core 有新版本", or asks to move the legacy app to a newer core. Covers both lockfiles, DOM-selector breakage, test baselines, PR body, and the separate legacy-app hosting deploy.
---

# Bump @zenuml/core

`@zenuml/core` renders every preview, export and embed. A bump is small in diff and large in blast radius, so the job is to prove what changed on screen, not only that tests pass.

```
npm latest ─► worktree + branch ─► pin both package.json ─► regen BOTH lockfiles
     ─► BEFORE shot (master) ─► typecheck/unit/e2e vs master baseline
     ─► fix DOM-coupled selectors ─► PR body (pr skill) ─► CI ─► land-pr
                                        (legacy hosting deploy = separate, confirm first)
```

## 1. Pick the version

```bash
npm view @zenuml/core version
gh release list --repo mermaid-js/zenuml-core --limit 15   # changelog between old and new
```

Read the notes between the current and target version. List anything that changes DOM, CSS hooks, props or events. Example from 4.9.0 → 4.12.1: lifeline `#id` removed (use `data-lifeline-id`), raw HTML in comments no longer rendered, new `onEventEmit` trackEvent. Say which of these web/ uses.

## 2. Branch

Work in a worktree, branch `chore/bump-zenuml-core-<version>`.

## 3. Pin and regenerate lockfiles

`@zenuml/core` is pinned exactly in two manifests: root `package.json` (legacy Preact app, kept for rollback) and `web/package.json` (the live rewrite). Edit both, then regenerate both lockfiles. CI uses `--frozen-lockfile`, so a stale lock fails the build.

```bash
npx -y pnpm@10 install --ignore-scripts                       # root -> pnpm-lock.yaml
cd web && npx -y pnpm@10 install --ignore-scripts --ignore-workspace   # -> web/pnpm-lock.yaml
```

Without `--ignore-workspace` the web install writes the root lock instead. Leave `yarn.lock` alone: it is stale and CI ignores it.

## 4. Capture BEFORE first

While still on master (old core), build the app and screenshot a DSL that exercises the changes you listed (stereotypes, fragments, refs, comments, themes):

```bash
cd web && pnpm build && pnpm exec vite preview     # production build, not dev
```

Take the same screenshot on the branch for AFTER. Push both images to the `pr-evidence` branch under `zenuml-core-<version>/`.

## 5. Verify against a baseline

Run in `web/`: `pnpm typecheck`, `pnpm test` (Vitest, unit), `pnpm exec playwright test` (end-to-end). Then run the same failing specs on master. A failure that also fails on master is pre-existing: list it by file and count, do not fix it here.

Hunt DOM coupling the tests may not cover:

```bash
grep -rnE "\.lifeline#|\.participant#|#zenuml|getElementById" web/e2e e2e/tests web/src
```

Also check custom-CSS templates (`web/src/domain/templates*`) for selectors on removed ids or classes. User CSS that targets removed ids stops matching: name this in Merge Danger.

Update version mentions in docs: `web/docs/document-surface.md`, `docs/outer-canvas-client-contract.md`, and the line in `CLAUDE.md` Technology Stack.

## 6. Open the PR

Follow `~/.claude/skills/pr/SKILL.md`: `## PR review support materials` first, BEFORE/AFTER pair, test table that names each type (static, unit, end-to-end), Summary diff, Merge Danger (door: two-way, revert the commit). Then use `submit-branch` and `babysit-pr`.

Traps:
- A staging-gate failure after a master merge needs a full rerun (empty commit); `gh run rerun --failed` never works there.
- Branch protection requires the branch to be up to date with master; merging master re-triggers CI.
- Only one PR gate at a time on shared staging, or "Deployed sha does not match" fails the others.
- Merge with `land-pr`. Merging deploys staging only.

## 7. Production is a separate decision

Merging does not change app.zenuml.com. Production moves only through the GitHub release flow (`release-app`). Check the trial note in memory (`legacy-rollback-trial-*`): while a rollback trial serves a legacy hosting version, do NOT publish a release; it would overwrite the trial.

### Legacy app live on hosting (only when a trial is running)

Ask the user first: this is a production change. It can be undone by re-releasing the previous hosting version; record both version ids before starting.

```bash
yarn build                                    # root vite build -> dist/
# assemble app/ (gitignored): static/ (minus manifest.json) -> app/static/; copy help, privacy-policy,
# End-User-License-Agreement; dist/* -> app/; help.html, ZenUML_Sequence_Diagram_addon_help.html,
# src/detached-window.js, static/manifest.json; icon-*.png come from static/ already.
node_modules/.bin/firebase hosting:channel:deploy <name> --project prod --config <tmp.json with hosting.public="app"> --expires 7d
# verify the preview URL (editor renders, ?embed=1&code={"js":...} shows code, PNG export, /track 200), then:
node_modules/.bin/firebase hosting:clone web-sequence-local:<name> web-sequence-local:live --project prod
```

Use the repo's `node_modules/.bin/firebase` (13.x). The global 9.x rejects `function: {functionId}` rewrites. `?embed=1&code=` takes a JSON object (`{"js": "..."}`), not raw DSL. Browser HTTP cache keeps the old HTML up to 1 hour: verify with a cache-busting query. Update the trial memory note with the new live version id.
