---
name: release-app
description: Release ZenUML web-sequence to production (app.zenuml.com) by publishing a GitHub release, wait for deploy-prod CI + @smoke, then run a release-delta spot check (spot-check skill Step 5.5). Use when the user says "release", "release app", "deploy to prod", "ship to production", or invokes /release-app. Does not merge PRs — use ship-branch first if there are pending changes on a feature branch.
---

# Release App

Deploy the current `master` to **https://app.zenuml.com** by publishing a GitHub release, which triggers the `Deploy to Prod` CI workflow.

## Repo Facts

- Repository: `ZenUml/web-sequence`
- Production URL: https://app.zenuml.com
- Deploy trigger: GitHub Release published (`on: release: types: [published]`)
- Workflow file: `.github/workflows/deploy-prod.yml`
- Tag convention: `v<YYYYMMDD>-<short-slug>` (e.g. `v20260604-core-bump`)
- Package manager (CI): pnpm
- Package manager (local): Yarn

## Pre-flight

### 1. Confirm master is releasable

```bash
git fetch origin
git log --oneline v$(git tag --sort=-version:refname | head -1)..origin/master
```

Show the user the unreleased commits. If there are zero commits since the last tag, confirm with the user before proceeding — a no-op release is usually unintentional.

### 2. Check local HEAD is pushed

```bash
git log --oneline origin/master..HEAD
```

If there are unpushed local commits, push them first:

```bash
git push origin master
```

### 3. Determine the tag name

Compose a tag:
- Date portion: today's date as `YYYYMMDD`
- Slug: 2–4 word kebab-case summary of the dominant change (e.g. `core-bump`, `splitpane-fix`, `mixpanel-migration`)

Ask the user to confirm or override the tag name before creating it.

### 4. Write the release notes

Pull commit subjects since the last release tag:

```bash
git log --oneline $(git tag --sort=-version:refname | head -1)..origin/master
```

Group into sections: **Features**, **Bug fixes**, **Tests**, **Chores**. Omit sections that have no commits.

## Create the Release

```bash
gh release create <tag> \
  --title "Release - <human summary>" \
  --notes "<release notes>"
```

Publishing the release immediately triggers `Deploy to Prod`.

## Monitor CI

```bash
gh run list --workflow=deploy-prod.yml --limit 3
gh run watch <run-id>
```

Report the final run status. A successful run deploys the app and uploads `chrome-extension.zip` as a release asset.

### Step 5: Wait for deploy + CI smoke (mandatory)

After publish, monitor **both** jobs in `deploy-prod.yml`:

```bash
gh run list --workflow=deploy-prod.yml --limit 3
gh run watch <run-id>
```

The **`Post-deploy smoke (prod)`** job runs `@smoke` against `https://app.zenuml.com` (chromium). Do not skip waiting for it.

### Step 5.5: Spot check (targeted coverage for **this** release)

**Runs after Step 5 is green. Do not skip.**

General workflow: **spot-check** skill.

Release-specific: understand **what shipped** between the previous published release and this tag, then verify **those behaviors** on production (or staging if prod is blocked) — not “run every recipe blindly.”

#### 1. Establish the release delta

```bash
gh release list --repo ZenUml/web-sequence --exclude-drafts --limit 5 --json tagName
git fetch --tags
git log <prev-published-tag>..<new-tag> --oneline
```

Read commits as product intent. For non-obvious subjects, `git show <sha>` before planning.

**Mandatory triage table** (every commit in the range):

| Category | Criteria | Plan action |
|----------|----------|-------------|
| `behavioral` | User-visible app, diagram, editor, extension packaging, Firebase rules/functions affecting UX | ≥1 `[ ]` assertion |
| `instrumentation` | Analytics only | Optional Mixpanel assertion or skip with reason |
| `infra/test/docs` | CI, tests, docs, skills only | `Skipped: …` |

`Spot check: N/A` only if **every** commit is `infra/test/docs`. Output the triage table before the plan or N/A.

#### 2. Write the spot check plan (before browser)

Use the **spot-check** plan format. Target **`https://app.zenuml.com`** unless the release did not deploy.

Map delta themes to methods (examples):

| Themes in delta | Typical checks |
|-----------------|----------------|
| Diagram / `@zenuml/core` / `vite.config.js` | Edit DSL → SVG in `#demo-frame`; optional `dsl-spot-check` recipe on prod |
| Editor / modals / multi-page | Smoke paths from `smoke.spec.js` relevant to changed UI |
| Deploy / hosting only | `@smoke` on prod (likely already green in Step 5) + one manual DSL edit |
| Chrome extension | Note: extension ships as release asset; web app spot check does not replace Web Store verification |

#### 3. Execute

Follow **spot-check** execution. `@smoke` passing in CI does **not** replace delta assertions you wrote.

Record pass / fail / skipped per planned `[ ]` line.

## Report

```text
Release Report: <tag>
- Commits released: <N>
- GitHub Release: <url>
- CI deploy: <url> — PASS|FAIL
- CI @smoke (prod): PASS|FAIL
- Spot check (delta): PASS|FAIL|N/A — <summary>
- Chrome extension asset: uploaded|skipped
```

## Known CI Gotchas

These issues have been encountered and fixed — document here so they don't repeat:

| Symptom | Root cause | Fix applied |
|---------|-----------|-------------|
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | pnpm 11 default: 24h age gate on new packages | `pnpm-workspace.yaml`: `minimumReleaseAge: 0` |
| `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (overrides) | `package.json` `resolutions` field → pnpm lockfile `overrides` mismatch across pnpm versions | workflow uses `pnpm install --no-frozen-lockfile` |
| `Cannot find module 'firebase-functions'` | pnpm 10 strict module linking breaks firebase trigger parsing | `functions/` uses `npm install` not `pnpm install` |
| pnpm `latest` requires Node >= 22 | pnpm 11 dropped Node 20 | Node pinned to 22.x; pnpm pinned to v10 |

When creating the release tag, **always tag `HEAD` of `origin/master` explicitly**:

```bash
git tag v<tag> HEAD
git push origin v<tag>
gh release create v<tag> --title "..." --notes "..."
```

Using `gh release create` without pre-pushing the tag can result in the release pointing at a stale commit.

## Rules

- Never create a release tag pointing at a commit that is not on `origin/master`.
- Never force-push or delete release tags.
- Never release if required CI checks on the last merge commit are red — check with `gh run list --branch master --limit 5` first.
- If the deploy workflow fails, report the failure and the relevant log lines; do not retry automatically.
- After each retry, verify the tag points at the correct (latest) commit with `git ls-remote origin refs/tags/<tag>`.
