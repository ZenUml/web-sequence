---
name: submit-branch
description: Push the current ZenUML web-sequence branch and create or reuse a GitHub PR against master. Use when the user says "submit", "create PR", "open a pull request", "push and PR", or wants to publish branch work without merging. Does not fix CI or merge.
---

# Submit Branch

Publish the current branch as a PR for `ZenUml/web-sequence`.

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

If one exists, report it and stop.

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

Use Draft only if the user asks or if the branch is intentionally not ready. This repo does not have a documented draft gate that skips expensive PR E2E.

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
Notes: <draft state, skipped checks, unrelated local files>
```

## Does Not

- Run full validation by default; use `validate-branch`.
- Monitor or fix CI; use `babysit-pr`.
- Merge; use `land-pr`.
