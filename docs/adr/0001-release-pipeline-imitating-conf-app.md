# 0001 — Release pipeline: adopt conf-app's transferable release practices

- Status: Accepted
- Date: 2026-06-04
- Deciders: MrCoder (eagle.xiao@gmail.com)

## Context

web-sequence ships to https://app.zenuml.com (Firebase Hosting) plus 6 Cloud
Functions and Firestore rules/indexes — `yarn deploy:prod` runs a **full**
`firebase deploy --project prod`. A Chrome extension is packaged separately.

The current release flow has gaps that recently caused a risky production
incident (CI breakage from the pnpm 11 / Node 20→22 upgrade; the `rollback-prod`
branch was cut to restore a known-good deploy path):

- **No gate.** `deploy-staging.yml` fires on `[push, pull_request]` for *every*
  branch and deploys staging with no test gate.
- **No proof the deployed site works.** The Playwright suite
  (`e2e/tests/smoke.spec.js`, ~30 tests on `master`) only runs against a local
  `pnpm dev` server (`baseURL: localhost:3000`). It never touches the deployed
  artifact, so "deploy succeeded" never means "the live site renders."
- **Manual, error-prone prod trigger.** Releasing means hand-crafting a
  `release-YYYYMMDDHHmm` tag / GitHub Release. `deploy-prod.yml` fires on
  `release: published`.
- **No post-deploy verification** of prod.
- **No defined rollback** for the multi-surface prod deploy.

The sibling project `conf-app` (Cloudflare Pages + Forge + D1) has a more mature
flow. We want its *practices*, not its mechanics — the two share almost no
deploy infrastructure.

## Decision

Cherry-pick conf-app's transferable release practices onto the Firebase stack.
Priority is **safety/reliability over convenience**, but we adopt both.

1. **E2E targets the deployed URL.** Parameterize `playwright.config.js`
   `baseURL` from `PW_BASE_URL` and make `webServer` conditional (skip it when a
   remote URL is set). The one existing spec then serves three roles: local dev
   (default `localhost:3000`), staging gate (`staging.zenuml.com`), and prod
   smoke (`app.zenuml.com`). The suite is entirely client-side / localStorage,
   so it is safe to run against prod (no server state mutated).

1b. **Pre-deploy build-render guard.** Before deploying, the build job serves the
   built `dist/` statically (`PW_PROD_BUILD=1`, a plain static server on a
   dedicated port) and runs `e2e/tests/production-build.spec.js`. The dev server
   transparently serves Vite `/@fs/<abs>` URLs, so deploy-only bundling bugs
   (e.g. an asset shim baking a dev-only path) are invisible to the dev-server
   suite and only surface once served statically. This guard runs on PRs too, so
   the bug class is caught at PR time — not just by the post-deploy gate. (The
   pipeline's first real run caught exactly such a bug: the `@zenuml/core` UMD
   shim emitted a `/@fs/` path that 404'd on staging; fixed in `vite.config.js`.)

2. **Staging E2E is a hard gate.** On push to `master`: deploy staging → run the
   full suite against `staging.zenuml.com`. A red gate blocks release creation.
   The deployed-URL run is **chromium-only**: verified against live staging,
   webkit hard-fails and firefox is flaky on network-timed localStorage/render
   tests (a remote-target artifact — the full 3-browser suite is green locally
   on PRs). Cross-browser correctness stays covered by the local PR run; the
   deployed gate answers the narrower question "did this deploy actually work?"

3. **Auto-draft release.** When the staging gate is green, CI auto-creates/updates
   a **draft** GitHub Release `release-<timestamp>` with `extension.zip`
   attached. The human's only action is clicking **Publish** on a build already
   proven green on staging. `deploy-prod.yml` (existing `release: published`
   trigger) then deploys prod.

4. **Post-deploy prod smoke.** After `deploy-prod`, run a small tagged `@smoke`
   subset (load + render + core-bundle, read-only) against `app.zenuml.com`. The
   full suite is the staging gate; the fast subset is the prod smoke.

5. **Rollback = re-deploy a prior release (all surfaces).** Add a
   `workflow_dispatch` that checks out a chosen previous `release-*` ref and runs
   the prod deploy, recovering hosting **and** functions **and** rules together.
   Document `firebase hosting:rollback` as the instant hosting-only fast path.
   (This matches the existing `rollback-prod` intent.)

6. **Concurrency never cancels `master`.** So in-flight draft releases are never
   lost to a superseding run.

7. **Tighten staging trigger** to `push` on `master` + PRs only (stop deploying
   staging from arbitrary feature branches).

8. **Chrome Web Store publish stays MANUAL** (`yarn upload` + `yarn pub`). CI
   only attaches `extension.zip` to the release as an asset. (See Consequences.)

## Consequences

- The signature safety win — "deploy succeeded but the live site is broken" is
  caught by a deployed-URL smoke — is exactly the rollback scenario that
  triggered this work.
- Releasing becomes one deliberate click on a green, CI-prepared draft; no tag
  format to remember.
- Rollback is defined and covers all three prod surfaces, not just hosting.
- **Extension auto-publish is deliberately NOT adopted.** Publishing to the
  Chrome Web Store is outward-facing to real users and gated by Google's review;
  it is hard to reverse and should remain a conscious manual step. Revisit only
  if release cadence makes the manual step painful.
- Cost: each prod release now runs an extra smoke job (~minutes); the staging
  gate adds latency before a draft appears. Acceptable for a safety-first flow.

## Alternatives considered

- **Literal port of conf-app** (wrangler/Forge/manifest/multi-variant): rejected
  — no shared infrastructure with Firebase.
- **Keep local-only E2E**, trust `firebase` exit code for prod: rejected — never
  verifies the live artifact, would not have caught the triggering incident.
- **`firebase hosting:rollback` as the sole rollback**: rejected as *sole*
  mechanism — prod deploy also ships functions + rules, which it can't revert.
  Retained as the hosting-only fast path.
