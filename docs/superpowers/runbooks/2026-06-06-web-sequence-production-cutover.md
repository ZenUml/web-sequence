# Runbook — web-sequence production cutover (legacy `app/` → `web/dist`)

- **Date:** 2026-06-06
- **Milestone:** M05 (final) — production-cutover PREP
- **Audience:** the maintainer who deploys (eagle.xiao@gmail.com / MrCoder)
- **Status:** PREP only. No deploy has been performed by any agent. Every
  cloud-mutating command below is **USER-RUN** — the agent did not and will not
  run `firebase deploy` or mutate any cloud resource (workspace Safety Rules 1+2).

> **What this cutover does.** It repoints Firebase Hosting from the legacy
> gulp-assembled `app/` directory to the React 19 rewrite's `web/dist` build
> output. It is delivered as a **reversible config diff** (Task 12:
> `firebase.json hosting.public: "app" → "web/dist"`) plus this manual runbook.
> The 6 Cloud Function rewrites, Firestore rules/indexes, and the URL-parameter /
> storage-key / one-time-prompt contracts are **unchanged** — only the static
> hosting root moves.
>
> **What it does NOT do.** It does not delete legacy `src/`, the `app/`
> directory, or the gulp pipeline — those are retained for rollback path (2).
> Legacy deletion is a SEPARATE follow-up, performed only AFTER the user confirms
> the new path is live and green (see "After the cutover is confirmed live").

Cross-reference: [`docs/adr/0001-release-pipeline-imitating-conf-app.md`](../../adr/0001-release-pipeline-imitating-conf-app.md)
— the established release pipeline (staging E2E gate → auto-draft release →
publish → `deploy-prod` → `@smoke`). This runbook describes the **one-time
cutover** of the hosting root; the ADR pipeline governs ongoing releases.

> **CI MUST change WITH the hosting repoint — they are one atomic unit.** Today
> both `deploy-staging.yml` and `deploy-prod.yml` run `pnpm install && pnpm build`,
> which builds the **legacy** `app/` artifact — correct *only while*
> `firebase.json hosting.public` is still `"app"`. The moment the Task-12 commit
> flips `hosting.public` to `"web/dist"`, those workflows must ALSO build
> `web/dist` (`pnpm -C web build`), or the very next automated deploy (staging
> fires on every master push; prod on every published release) runs
> `firebase deploy` against a directory CI never created — a red deploy with no
> human action. The required workflow edit ships as **Diff 3** in the companion
> config-diff doc
> (`2026-06-06-web-sequence-cutover-config-diff.md`); apply Diffs 1, 2, AND 3 in
> the SAME commit as the hosting repoint. Do not merge the hosting flip without
> the CI change.

---

## 0. The cutover commit

The config change is the Task-12 commit:

```
chore(m05): cutover config — repoint Firebase hosting.public to web/dist (reversible; deploy is manual)
```

Confirm it is on the branch you are about to deploy from, and record its SHA —
rollback path (2) reverts exactly this commit:

```bash
# USER-RUN (read-only)
git log --oneline -- firebase.json | head -5
git show --stat HEAD          # confirm firebase.json hosting.public is "web/dist"
```

If the cutover commit is NOT yet present, apply Task 12 first — all THREE diffs
from `2026-06-06-web-sequence-cutover-config-diff.md` in ONE commit: Diff 1
(`firebase.json` `hosting.public` `"app" → "web/dist"`, leaving the 6 rewrites /
ignore / firestore / emulators / functions untouched), Diff 2 (root
`package.json` `build:web` helper), and **Diff 3 (the `deploy-staging.yml` +
`deploy-prod.yml` step that builds `web/dist`)**. Diff 3 is mandatory: without it
CI never produces the `web/dist` directory the repointed `firebase.json` serves,
so the next automated deploy fails red. Commit with the message above. Do not
hand-edit during deploy.

---

## 1. Pre-deploy checklist (ALL must be green before any deploy)

Run these locally on the branch carrying the cutover commit. **None of these
mutate cloud resources** — they are safe for the agent or the user to run.

- [ ] **Unit tests (rewrite):** `pnpm -C web test` → green.
- [ ] **Typecheck (rewrite):** `pnpm -C web typecheck` → 0 errors.
- [ ] **Clean web build:** `pnpm -C web build` → `web/dist/` populated, including
      the asset-URL-shimmed `@zenuml/core` hashed asset (`web/dist/assets/zenuml-*.js`).
- [ ] **Production-build asset spec green against `web/dist`:** this is the gate
      that guards the `@zenuml/core` hashed-asset URL — it serves the **static**
      `web/dist` (not the dev server) and asserts no dev-only `/@fs/` URL is
      requested and the core asset returns 200 (the exact bug class the ADR §1b
      describes). Run:

      ```bash
      # USER-RUN or agent (no cloud mutation)
      pnpm -C web build
      pnpm exec playwright test e2e/tests/production-build.spec.js --project=chromium
      ```

      (Confirm the spec resolves `web/dist/assets`, which it does:
      `e2e/tests/production-build.spec.js` → `DIST_ASSETS = ../../web/dist/assets`.)
- [ ] **Embed + full rewrite E2E green:** `pnpm exec playwright test --project=chromium`
      (includes the M05 embed spec + M01–M04 specs).
- [ ] **The 6 function rewrites are intact in `firebase.json`** (verbatim, none
      added/removed/renamed):

      ```bash
      # USER-RUN (read-only)
      grep -A2 '"source"' firebase.json | grep functionId
      ```

      Must list exactly: `sync_diagram`, `create_share`, `get_shared_item`,
      `authenticate`, `track`, `info`.
- [ ] **`hosting.public` points at the cutover target:**

      ```bash
      # USER-RUN (read-only)
      grep '"public"' firebase.json     # → "public": "web/dist"
      ```

- [ ] **Extension package (if shipping this cycle):** `pnpm -C web build:extension`
      produces `web/extension.zip` with a version-stamped MV3 manifest. (Chrome
      Web Store publish is a separate MANUAL step — `yarn upload` + `yarn pub` —
      per ADR §8; not part of the hosting cutover.)
- [ ] **Auxiliary legacy same-origin static routes are confirmed or intentionally retired.**
      The legacy gulp pipeline served same-origin static URLs that `web/dist` (only
      `index.html` + `assets/`) does NOT serve: `/privacy-policy/privacy-policy.html`,
      `/End-User-License-Agreement/**`, `/help.html` + `/help/**`, `/manifest.json`,
      `/templates/**`, `/animation/**`, `/lib/**`, `/detached-window.js`,
      `/preview.html`, fonts. After the cutover every one of these 404s. The rewrite
      app does NOT link them same-origin (`grep -rni 'privacy-policy\|eula\|help\.html\|/manifest\.json' web/src` is clean — Help points at cross-origin `https://www.zenuml.com/help.html`, templates are bundled), so the app's own UX is unaffected. The RISK is **external** references that 404 post-cutover:
      - **Chrome Web Store listing privacy-policy URL** — if it points at
        `https://app.zenuml.com/privacy-policy/…` it will silently break. Verify the
        listing's privacy-policy URL resolves post-cutover; repoint it to the canonical
        marketing-site URL (`https://www.zenuml.com/…`) if needed.
      - **EULA + privacy-policy legal links** anywhere they are externally referenced.
      - **`/manifest.json`** if any external integration fetches it from `app.zenuml.com`.
      Decide per route: add a Firebase Hosting redirect to the canonical cross-origin
      page, OR document the route as intentionally retired. (`firebase.json` is FROZEN
      under NFR-1 for the parallel-agent rewrite, so any redirect is applied by the USER
      alongside the cutover commit, not by an agent.)

If any box is red, **stop**. Do not deploy.

---

## 2. Deploy — USER-RUN, staging first

> Hosting-only (`--only hosting`) is correct for this cutover: the cutover moves
> the static root only. Functions and Firestore rules are unchanged, so they need
> no redeploy. (A full `firebase deploy --project prod` would also work and is
> what `yarn deploy:prod` runs, but `--only hosting` keeps the cutover's blast
> radius minimal and its rollback fast.)

### 2a. Staging

```bash
# USER-RUN — mutates the STAGING Firebase project
firebase deploy --only hosting --project staging
```

Then verify the deployed staging site **by hand and/or with the E2E gate**:

```bash
# USER-RUN (read-only against staging; the suite is client-side / localStorage-safe per ADR §1)
PW_BASE_URL=https://staging.zenuml.com pnpm exec playwright test --project=chromium
```

Manual check at https://staging.zenuml.com:

- [ ] Editor + preview load; a diagram renders (the `@zenuml/core` bundle loads
      from `web/dist/assets/...`, not a 404).
- [ ] Sign-in works (the `/authenticate` rewrite still resolves).
- [ ] Save / sync works (the `/sync-diagram` rewrite still resolves).
- [ ] Share works and the minted link points at the canonical origin
      (`https://app.zenuml.com`), via `/create-share` + `/get-shared-item`.
- [ ] `?embed&code=…` renders by value (no main header/sidebar, embed header +
      open-in-app link present).

**Do not proceed to prod until staging is confirmed green.**

### 2b. Production

```bash
# USER-RUN — mutates the PRODUCTION Firebase project (app.zenuml.com)
firebase deploy --only hosting --project prod
```

---

## 3. Post-deploy `@smoke` check (USER-RUN, prod)

Run the existing tagged `@smoke` subset against the live production site (the
same fast read-only subset the ADR §4 / `deploy-prod` pipeline runs):

```bash
# USER-RUN (read-only against prod)
PW_BASE_URL=https://app.zenuml.com pnpm exec playwright test --grep @smoke --project=chromium
```

`@smoke` (in `e2e/tests/smoke.spec.js`) asserts: the app loads with editor +
preview iframe, and the preview iframe carries the `@zenuml/core` mounting point.
A green `@smoke` against `app.zenuml.com` is the signal that "deploy succeeded"
also means "the live site renders from `web/dist`."

- [ ] `@smoke` green against `app.zenuml.com`.
- [ ] Manual eyeball at https://app.zenuml.com: diagram renders, sign-in, save,
      share, embed (the same checks as staging in §2a).

If `@smoke` is red or the eyeball fails → **roll back immediately** (§4).

---

## 4. Rollback — TWO paths

### Path (1) — hosting-only fast rollback (seconds; preferred for "the deploy is broken")

Firebase Hosting retains prior releases. Roll the production hosting back to the
previous (legacy `app/`) release without touching functions or rules:

```bash
# USER-RUN — reverts PROD hosting to the previous release
firebase hosting:rollback --project prod
```

This is the instant path documented in ADR §5 as the hosting-only fast path. Use
it the moment a post-deploy check fails. It restores the previously-served
artifact (the legacy `app/` build) immediately. Functions/Firestore were never
touched by this cutover, so hosting-only rollback fully reverts it.

### Path (2) — full revert of the Task-12 config diff (durable; for "back this change out of the codebase")

When you want the repository itself back on the legacy hosting root (not just a
one-off hosting rollback):

```bash
# USER-RUN
# 1. Revert the cutover commit (restores firebase.json hosting.public: "web/dist" → "app")
git revert <cutover-commit-sha>      # the SHA recorded in §0
grep '"public"' firebase.json        # confirm → "public": "app"

# 2. Rebuild the legacy app/ artifact — MIRROR THE CI ASSEMBLY, NOT `yarn release`.
#    `yarn release` (= gulp release) is BROKEN for this purpose on two counts:
#      (a) the project's own CI declares gulp release "incompatible with Node 20+"
#          (deploy-prod.yml:33 / deploy-staging.yml:48) — it errors on modern Node;
#      (b) even on a compatible Node, gulp `copyFiles` only COPIES a pre-existing
#          dist/ (gulpfile.cjs:78 `gulp.src('dist/**/*')`) — it never runs the vite
#          build. Post-cutover the root dist/ is stale or absent (.gitignore'd), so
#          `yarn release` would assemble app/ from empty/stale output.
#    Instead replicate deploy-prod.yml's inline assembly (build FIRST, then copy):
pnpm install --no-frozen-lockfile && pnpm build   # legacy vite build → dist/
rm -rf app && mkdir -p app
rsync -a --exclude='manifest.json' static/. app/static/
for d in help privacy-policy End-User-License-Agreement; do
  [ -d "$d" ] && cp -R "$d/." "app/$d/" || true
done
cp -R dist/. app/
cp help.html app/ 2>/dev/null || true
cp ZenUML_Sequence_Diagram_addon_help.html app/ 2>/dev/null || true
cp src/detached-window.js app/ 2>/dev/null || true
cp src/icon-*.png app/ 2>/dev/null || true
cp static/manifest.json app/
grep -q '"public": "app"' firebase.json && echo "OK: hosting root is app/"

# 3. Redeploy hosting from the restored legacy root
firebase deploy --only hosting --project prod
```

This works only because legacy `src/`, `app/`, and the gulp pipeline are
**retained** through the cutover (they were not deleted). Path (2) is the
authoritative rollback when path (1)'s retained release has aged out or you need
the codebase config to match what is deployed.

> Optionally pair either path with the ADR §5 **Rollback Production**
> `workflow_dispatch` (re-deploys a prior `release-*` ref across all surfaces) if
> functions or rules also need restoring — not required for this hosting-only
> cutover, but the documented all-surface recovery.

---

## 5. After the cutover is confirmed live (SEPARATE follow-up — not part of cutover)

Only once the user confirms `app.zenuml.com` is serving `web/dist`, is green on
`@smoke`, and has been stable in production (give it a soak period — at least a
full day of real traffic), the legacy surfaces may be retired in a **separate**
change:

- Delete legacy `src/` (the Preact app).
- Remove the `app/` build directory + the `gulpfile.cjs` `release` pipeline and
  its `release` / `http-server-app` scripts.
- Retire the now-unused root build/deploy plumbing that only fed `app/`.

**Do NOT do any of this as part of the cutover.** Retaining legacy guarantees
rollback path (2) stays viable. Legacy deletion is its own PR with its own review.

---

## Summary

| Step | Command | Who | Mutates cloud? |
|------|---------|-----|----------------|
| Pre-deploy gates | `pnpm -C web test` / `typecheck` / `build`; `playwright test … production-build.spec.js`; rewrite grep | agent or user | no |
| Deploy staging | `firebase deploy --only hosting --project staging` | **USER** | yes (staging) |
| Verify staging | `PW_BASE_URL=https://staging.zenuml.com playwright test` + eyeball | user | no |
| Deploy prod | `firebase deploy --only hosting --project prod` | **USER** | yes (prod) |
| Smoke prod | `PW_BASE_URL=https://app.zenuml.com playwright test --grep @smoke` | user | no |
| Rollback (fast) | `firebase hosting:rollback --project prod` | **USER** | yes (prod) |
| Rollback (durable) | `git revert <sha>` → rebuild legacy `app/` via the CI inline assembly (`pnpm build` then rsync/cp — NOT `yarn release`; see §4 Path (2)) → `firebase deploy --only hosting --project prod` | **USER** | yes (prod) |
| Legacy deletion | separate follow-up PR, AFTER confirmed live | user | no |
