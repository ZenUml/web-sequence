# Verified release promotion

Supersedes the deployment and rollback details of ADR 0001.

## Gates

PRs run `Release validation`: locked root/web installs, both builds, release-policy tests, and the Chromium E2E suite including the built-output tests. Master requires this check with an up-to-date branch. Only master deploys shared staging; its workflow lock covers deployment, E2E and draft creation. Feature branches no longer overwrite staging.

Before deployment, CI writes `web/dist/release.json` with the commit, run ID and attempt, then archives the built site, functions source and lockfile, Firebase config/rules/indexes, and extension. The immutable Actions artifact includes a SHA-256 manifest. Staging restores and deploys this archive, then verifies the live marker before and after its E2E suite.

Draft release tags are `release-<run-id>-<attempt>`. Publishing a draft remains the production approval. Production rejects a tag unless it resolves to the exact commit of a successful master push to `deploy-staging.yml`, including a successful staging E2E job. The commit must be an ancestor of master. Arbitrary published releases cannot bypass this check.

Production downloads that run's immutable artifact, checks its manifest and digest, and deploys it without rebuilding the frontend. Functions dependencies use their frozen lockfile; Firebase may still build the functions in its managed environment. Functions configuration remains environment-specific. Policy and smoke tests are taken from protected master. A shared production concurrency lock covers both deployment and rollback through their post-deploy checks.

## Rollback

Dispatch `Rollback Production` on master with a previously gated release tag. It runs the same provenance check and deploys the same archived `web/dist`, functions, rules and indexes, followed by identity and smoke checks. No legacy gulp rebuild is used.

Artifacts are retained for 90 days, subject to repository retention limits and manual deletion. Expired or missing artifacts and pre-migration timestamp tags are rejected. There is intentionally no automatic rebuild fallback. Before the first production cutover, validate a new release on staging and retain a known-good hosting version; legacy releases are not certified for this rollback path. Hosting-only recovery can still use Firebase's version history through an operator.

Smoke failures mark deployment failed but do not automatically roll back data/schema changes. An operator chooses the prior verified release. A production deployment is not a Firestore data backup or migration rollback.

## Repository settings

Require `Release validation` on master, enforce it for admins, and require pull requests (zero mandatory reviewer approvals for the solo-maintainer workflow). Force-push/deletion protections remain enabled. The production Environment permits only master and `release-*` tags; the verified release and manual Publish action are the approval boundary, with no redundant reviewer gate.

No production release is published as part of introducing these gates. Run the rollout PR in CI, merge it, verify the new master staging gate, and only then publish its draft. The previous production site remains unchanged until Publish.
