---
name: ship-branch
description: Take the current ZenUML web-sequence branch from local validation through PR submission, green CI, and merge to master. Use when the user says "ship", "ship it", "ship this branch", "submit and merge", or wants the full branch-to-master workflow. Stops at first failure and does not deploy production.
---

# Ship Branch

Orchestrate the complete branch-to-`master` path for web-sequence.

## Flow

```text
validate-branch
  -> submit-branch
  -> babysit-pr
  -> land-pr
```

Stop at the first failing step. Do not skip validation unless the user explicitly asks.

## Steps

### 1. Validate Locally

Use `validate-branch`. If it reports FAIL, stop and fix locally. If it reports PARTIAL, decide whether the blocker is acceptable before proceeding; mention the risk to the user.

### 2. Submit PR

Use `submit-branch`. Create the PR against `master`. If a PR already exists, reuse it.

### 3. Get CI Green

Use `babysit-pr` on the PR. Let it monitor `Deploy to Stage`, fix code-caused failures, or report infra/secrets blockers. If it exhausts retries, stop.

### 4. Merge

Confirm with the user before merging unless they explicitly said "ship it" or "ship this branch". Then use `land-pr`.

### 5. Report

On success:

```text
Ship Report: <branch>
- Validation: PASS
- PR: #<number> <url>
- CI: GREEN
- Merge: MERGED into master (<sha>)
- Staging: verified by Deploy to Stage
- Production: not deployed; publish a GitHub release when ready
```

On failure:

```text
Ship Report: <branch>
- Stopped at: <validate|submit|ci|merge|post-merge-ci>
- Status: FAIL|PARTIAL|BLOCKED
- Details: ...
- Next step: ...
```

## Rules

- Never force-push.
- Never commit unrelated local files.
- Never merge with red required checks.
- Never publish a production release as part of this skill.
- Treat Firebase credential/deploy failures as manual attention unless logs prove a code/config cause.
