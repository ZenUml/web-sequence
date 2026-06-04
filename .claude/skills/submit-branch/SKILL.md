---
name: submit-branch
description: Push the current ZenUML web-sequence branch, create or reuse a GitHub PR against master, then always run babysit-pr until CI is green or blocked. Use when the user says "submit", "create PR", "open a pull request", "push and PR", or wants to publish branch work without merging. Does not merge — use land-pr after babysit passes.
---

# Submit Branch

Publish the current branch as a PR for `ZenUml/web-sequence`, then **always** babysit CI on that PR.

## Flow

```text
commit (if needed) → push → create or reuse PR → babysit-pr
```

Stop at the first failing step. Do not merge.

## Preconditions

Run:

```bash
git status --short --branch
git remote -v
```

Only proceed when modified files are clearly in scope for the branch. If the worktree mixes unrelated changes, ask which files to include. Never auto-commit unrelated files.

## Steps

### 1. Commit Scoped Changes If Needed

If there are scoped uncommitted changes, stage only those files and commit with a concise message:

```bash
git add <specific-files>
git commit -m "<type>: <summary>"
```

Do not amend or force-push unless the user explicitly asks.

### 2. Push The Branch

```bash
git branch --show-current
git push -u origin <branch>
```

If push is rejected, stop and report the reason. Do not force-push.

### 3. Reuse Or Create PR

Check for an existing PR:

```bash
gh pr view --json number,title,url,state,isDraft,headRefName
```

If no PR exists, create one against `master`:

```bash
gh pr create --base master --title "<concise title>" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- ...
EOF
)"
```

If a PR already exists, note its number and URL — do not create a duplicate.

Use Draft only if the user asks or if the branch is intentionally not ready. This repo does not have a documented draft gate that skips expensive PR E2E.

### 4. Babysit CI (mandatory)

**Always** invoke the **babysit-pr** skill on the PR from Step 3 (new or reused).

- Pass the PR number explicitly if you have it.
- Let babysit watch `Deploy to Stage`, diagnose failures, fix code-caused issues (up to its retry budget), and report final status.
- If babysit ends **FAILED** or **BLOCKED**, stop here — do not merge. Tell the user what failed and whether a fix was pushed.
- If babysit ends **PASSED** or checks are still **PENDING** with babysit still watching, report that state; do not call **land-pr** unless the user asked to ship/merge.

## PR Body Guidance

Mention:

- User-facing behavior changed
- Build/config/deploy files changed
- Validation actually run
- Known skipped checks or environment blockers

## Output

Report:

```text
Submitted: PR #<number> <url>
Branch: <branch>
Base: master
Validation included: <yes/no, summary>
Babysit: PASSED|FAILED|PENDING|BLOCKED — <summary>
Notes: <draft state, skipped checks, unrelated local files>
```

## Does Not

- Run full validation by default; use `validate-branch` before submit when the branch needs local preflight.
- Merge; use `land-pr` after babysit is green and the user wants to land.
