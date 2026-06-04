---
name: land-pr
description: Merge a green ZenUML web-sequence PR into master and verify staging CI after merge. Use when the user says "land PR", "merge this", "merge", "land", or a PR is ready to merge. Does not publish a production GitHub release.
---

# Land PR

Merge a green PR into `master` and verify the post-merge staging workflow.

## What Merge Triggers

The `Deploy to Stage` workflow runs on push and pull_request. On `master`, it builds, packages release artifacts, configures Firebase staging, deploys staging, and uploads the Chrome extension artifact.

Production deploy is separate: publishing a GitHub release triggers `Deploy to Prod`.

## Preconditions

Resolve the PR number, then run:

```bash
gh pr view <PR_NUMBER> --repo ZenUml/web-sequence --json state,isDraft,mergeable,reviewDecision,statusCheckRollup,headRefName,baseRefName,url
```

Verify:

- PR is open and targets `master`.
- No requested changes are outstanding.
- Branch is mergeable.
- Required checks are green.

If checks are not green, use `babysit-pr` or stop and report.

## Merge

Use the repo's allowed merge strategy instead of assuming squash:

```bash
MERGE_FLAG=$(gh api repos/ZenUml/web-sequence \
  --jq 'if .allow_squash_merge and (.allow_merge_commit | not) and (.allow_rebase_merge | not) then "--squash"
        elif .allow_rebase_merge and (.allow_merge_commit | not) and (.allow_squash_merge | not) then "--rebase"
        else "--merge" end')

gh pr merge <PR_NUMBER> --repo ZenUml/web-sequence --auto --delete-branch $MERGE_FLAG
```

If the user requested a specific merge method, use it only if GitHub allows it.

## Wait For Merge

Poll until merged:

```bash
gh pr view <PR_NUMBER> --repo ZenUml/web-sequence --json state,mergeCommit
```

If auto-merge remains armed but not merged, report what is blocking it.

## Verify Master CI

After merge:

```bash
gh run list --repo ZenUml/web-sequence --branch master --limit 5 --json databaseId,name,status,conclusion,createdAt,event
gh run watch <RUN_ID> --repo ZenUml/web-sequence
```

Check the `Deploy to Stage` result. If it fails after merge, do not auto-revert. Report the run URL, failing job, and key log lines.

## Output

```text
Land Report: PR #<number>
- Merge: MERGED|BLOCKED|AUTO-MERGE ARMED
- Merge commit: <sha>
- Master staging CI: PASS|FAIL|PENDING
- Production: not deployed; publish a GitHub release to trigger Deploy to Prod
```

## Does Not

- Fix failing CI; use `babysit-pr`.
- Create a PR; use `submit-branch`.
- Publish production releases.
