---
name: babysit-pr
description: Monitor and diagnose GitHub Actions checks on ZenUML web-sequence PRs, fixing code-caused CI failures when appropriate. Use when the user says "babysit PR", "check PR status", "fix CI", "why is CI red", "watch this PR", or a PR is blocked by build, release, Firebase deploy, artifact, lint, test, or runner failures.
---

# Babysit PR

Watch a web-sequence PR, diagnose failures, optionally fix code issues, and retry within a small budget.

## Scope

- Repository: `ZenUml/web-sequence`
- Main PR workflow: `Deploy to Stage`
- Base branch: `master`
- Production workflow `Deploy to Prod` runs only when a GitHub release is published.

## Step 1. Find The PR

Use the explicit PR number if provided. Otherwise infer from the current branch:

```bash
gh pr view --json number,title,url,headRefName,state,isDraft,statusCheckRollup
```

If no PR exists, stop and tell the user to use `submit-branch`.

## Step 2. Check Status

```bash
gh pr checks <PR_NUMBER> --repo ZenUml/web-sequence
gh pr view <PR_NUMBER> --repo ZenUml/web-sequence --json statusCheckRollup,headRefName,isDraft
```

Treat required successful checks as green. If checks are pending, find the latest run and watch it:

```bash
gh run list --repo ZenUml/web-sequence --branch <branch> --limit 5 --json databaseId,name,status,conclusion,event,createdAt
gh run watch <RUN_ID> --repo ZenUml/web-sequence
```

## Step 3. Diagnose Failures

Pull failed logs:

```bash
gh run view <RUN_ID> --repo ZenUml/web-sequence --log-failed
```

Classify the failure:

- Build: Vite errors, missing imports, package resolution, `pnpm build`
- Release packaging: `pnpm release`, gulp, extension artifact, zip creation
- Firebase staging deploy: credentials, project config, deploy command, emulator/config mismatch
- Functions config/deploy: failures under `functions/`
- Test/lint: Jest, Playwright, ESLint
- Dependency/install: pnpm lockfile or Node version issues
- Runner/infra: network, cache, GitHub outage, transient Firebase error
- Dependabot/secrets skip: staging deploy intentionally skipped for Dependabot actors

## Step 4. Fix Or Rerun

Before editing:

```bash
git fetch origin
git checkout <PR_BRANCH>
git pull --ff-only origin <PR_BRANCH>
```

Fix only failures with a local code cause. Do not patch around secrets, credentials, Firebase project access, or GitHub runner outages.

Suggested local checks by category:

- Build: `yarn build`
- Release: `yarn build && yarn release`
- Jest: `yarn test`
- Playwright: `yarn test:e2e`
- Lint: `yarn lint`
- CI parity for package manager issues: `pnpm install && pnpm build`

If a failure is clearly transient infra, rerun failed jobs:

```bash
gh run rerun <RUN_ID> --repo ZenUml/web-sequence --failed
```

## Step 5. Push And Watch

After a code fix:

```bash
git add <specific-files>
git commit -m "fix: <ci failure summary>"
git push origin <PR_BRANCH>
```

Then watch the new run. Maximum retry budget: 3 total fix/rerun attempts. Re-diagnose from fresh logs after each attempt.

## Safety Rules

- Never force-push.
- Never resolve merge conflicts automatically.
- Never commit unrelated local changes.
- Never treat Firebase secret/auth failures as code fixes.
- If CI passes after rerun without code changes, report likely flakiness.

## Report

```text
PR #<number> Babysit Report
- Status: PASSED|FAILED after <n> attempts|PENDING
- Workflow/run: <url>
- Failures found: ...
- Fixes applied: ...
- Manual attention needed: ...
```
