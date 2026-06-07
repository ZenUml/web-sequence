# Production cutover — config diff (Task 12, M05)

**Status:** PREP only. This is a **reversible config diff artifact**. It has NOT been
applied to repo-root `firebase.json` / `package.json`, and NO deploy was performed.

Repo-root configs are FROZEN (NFR-1) and shared by parallel agents, so this stage
delivers the cutover as a written diff the integrate stage (or the user) applies
verbatim. The deploy itself is the USER's (see the companion runbook
`2026-06-06-web-sequence-production-cutover.md`, Task 13).

The cutover repoints Firebase Hosting from the legacy gulp-assembled `app/`
directory to the new React build output `web/dist`, **keeping all 6 same-origin
function rewrites verbatim**. Contract §10 invariants preserved: the 6 rewrites,
storage keys / one-time-prompt flags / URL-parameter contract (already preserved
by the app code — no config change needed), and `@zenuml/core` asset-URL
correctness (guarded by the production-build asset spec, run against `web/dist` in
Task 14).

---

## Build-output sanity check

`web/vite.config.ts` (line ~61): `build: { outDir: 'dist', emptyOutDir: true, assetsDir: 'assets' }`.

`outDir: 'dist'` is relative to the `web/` project root, so `pnpm -C web build`
emits to **`web/dist`** — the exact directory this diff repoints hosting at.

---

## Diff 1 — `firebase.json`

Single field change: `hosting.public` `"app"` → `"web/dist"`.

```diff
--- a/firebase.json
+++ b/firebase.json
@@ -1,6 +1,6 @@
 {
   "hosting": {
-    "public": "app",
+    "public": "web/dist",
     "ignore": [
       "firebase.json",
       "**/.*",
```

### UNCHANGED invariants (verify after applying)

`hosting.rewrites` — all **6** function rewrites stay verbatim (these are the
same-origin function paths the app calls; they must not move):

| `source`            | `function.functionId` |
| ------------------- | --------------------- |
| `/sync-diagram`     | `sync_diagram`        |
| `/create-share`     | `create_share`        |
| `/get-shared-item`  | `get_shared_item`     |
| `/authenticate`     | `authenticate`        |
| `/track`            | `track`               |
| `/info`             | `info`                |

Also UNCHANGED: `hosting.ignore`, `firestore` (`rules`/`indexes`), `emulators`
(functions 5002 / firestore 8080 / hosting 5000 / ui 4000), `functions`
(source `functions`, codebase `default`, ignore list).

Verify post-apply:

```bash
# exactly one public line, now web/dist
grep -n '"public"' firebase.json          # → "public": "web/dist"
# all 6 rewrites still present
grep -c '"functionId"' firebase.json      # → 6
```

---

## Diff 2 — `package.json` (root)

Add a `build:web` script that produces the cutover artifact, and a note that the
deploy targets now serve `web/dist`. The legacy `release` / gulp pipeline is
**RETAINED** (rollback path — do NOT delete). `deploy:staging` / `deploy:prod`
command targets are UNCHANGED (they already point at the right Firebase projects);
the only operational change is that the artifact built before deploy is `web/dist`.

```diff
--- a/package.json
+++ b/package.json
@@ -8,7 +8,9 @@
     "engine": "use yarn instead of npm please",
     "start": "if-env NODE_ENV=production && yarn serve || yarn dev",
     "build": "vite build",
+    "build:web": "pnpm -C web build",
+    "_cutover_note": "deploy:staging/deploy:prod now serve web/dist (built via build:web). The legacy gulp 'release' pipeline + 'app/' output are RETAINED for rollback — do NOT delete until the new path is confirmed live and green.",
     "release": "gulp --gulpfile gulpfile.cjs release",
     "prep:release:git-tag-push": "git tag release-`date +%Y%m%d%H%M` && git push origin release-`date +%Y%m%d%H%M`",
     "dev": "vite",
```

> The `_cutover_note` key is an inert documentation string (npm ignores unknown
> script-name keys when not invoked). If a reviewer prefers, drop it and keep the
> note in this runbook only; `build:web` is the only functional addition.

`deploy:staging` (`firebase deploy --project staging`) and `deploy:prod`
(`firebase deploy --project prod`) stay byte-for-byte unchanged.

---

## Reversibility

Both diffs revert cleanly with no data loss. Legacy `src/`, the `app/` output, and
the gulp pipeline are all retained, so rollback is a config-only operation.

1. **Config revert** — restore `firebase.json` `hosting.public` to `"app"`;
   remove the `build:web` / `_cutover_note` additions from `package.json`. If the
   diff was applied as a commit, `git revert <cutover-commit>`.
2. **Rebuild the legacy artifact** — `yarn release` (the gulp pipeline reassembles
   `app/` from legacy `src/`).
3. **Redeploy** — the USER runs `firebase deploy --only hosting --project <env>`
   (see Task 13 runbook; not run here).

For a hosting-only fast rollback that does NOT need a rebuild, the USER can use
`firebase hosting:rollback --project prod` (previous release version). Full detail
+ smoke gate live in the Task 13 runbook.

---

## Safety / scope

- NOT applied to repo-root `firebase.json` / `package.json` (FROZEN, NFR-1; shared
  by parallel agents). The integrate stage / user applies this diff.
- NO `firebase deploy` run — not even `--dry-run` (cutover safety: no cloud
  mutation by any agent).
- The asset-URL gate (`@zenuml/core` hashed asset under `web/dist`) is verified by
  the production-build asset spec in Task 14, not here.
- Cross-references: release pipeline ADR
  `docs/adr/0001-release-pipeline-imitating-conf-app.md`; manual deploy + dual
  rollback runbook `docs/superpowers/runbooks/2026-06-06-web-sequence-production-cutover.md`
  (Task 13).
