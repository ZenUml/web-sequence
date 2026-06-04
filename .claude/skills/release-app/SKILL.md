---
name: release-app
description: Release ZenUML web-sequence to production (app.zenuml.com) by pushing master and publishing a GitHub release. Use when the user says "release", "release app", "deploy to prod", "ship to production", or invokes /release-app. Does not merge PRs — use ship-branch first if there are pending changes on a feature branch.
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

## Post-release Smoke Test

After CI turns green:

1. Open https://app.zenuml.com in the browser.
2. Confirm the diagram canvas loads and renders a simple diagram.
3. Check the version label in the footer/header matches the release if visible.
4. Report any console errors.

Use the Playwright MCP (`user-playwright`) for this — navigate to `https://app.zenuml.com`, take a screenshot, and check the console.

## Report

```text
Release Report: <tag>
- Commits released: <N>
- GitHub Release: <url>
- CI run: <url> — PASS|FAIL|IN_PROGRESS
- Production smoke: PASS|FAIL|SKIPPED
- Chrome extension asset: uploaded|skipped
```

## Rules

- Never create a release tag pointing at a commit that is not on `origin/master`.
- Never force-push or delete release tags.
- Never release if required CI checks on the last merge commit are red — check with `gh run list --branch master --limit 5` first.
- If the deploy workflow fails, report the failure and the relevant log lines; do not retry automatically.
