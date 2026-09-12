# Release flow aligned with conf-app

Supersedes the earlier immutable-only proposal in this PR and conflicting details of ADR 0001.

## Reference and correction

Source of truth: ZenUml/conf-app main workflows `build-test-deploy.yml`, `staging-deploy.yml`, `release.yml`, and `.github/actions/wrangler-publish/action.yml`, inspected 2026-09-12 (main at `fd1b064eedfa0121aead4d1fcf4ae1e7deaf7656`).

The previous quiz described our proposed design, not conf-app. Its master-only staging and mandatory Actions-artifact promotion answers were incorrect for the requested reference. conf-app currently prefers a prebuilt **Release attachment**, with source rebuild on a missing/unavailable attachment. Rebuild uses the release tag and frozen lockfile, not latest dependencies.

## Flow

| Stage | web-sequence behavior matching conf-app |
| --- | --- |
| Branch iteration | Build and local Chromium checks; all branches can deploy shared staging. Same-repository PRs deploy too; forks have no deployment credentials. |
| Ready PR / master | Run deployed staging E2E. Draft PRs and ordinary feature pushes skip this expensive gate. |
| Draft | Only a successful master push with staging E2E creates a draft; pin it to the tested SHA and attach the prebuilt frontend and extension. |
| Publish | Manual Release/prerelease publication starts production. Checkout the published tag, prefer its Release attachment; if unavailable, install using that tag's frozen lockfiles and rebuild. |
| Verify | Deploy hosting, functions and rules, then run production Chromium smoke. A failed smoke is a failed deployment, not an automatic data rollback. |
| Rollback | Redeploy a selected previous release tag via the same attachment-or-rebuild path. Missing Actions artifacts are irrelevant. |

Transient Actions bundles retain three days; the copy attached to the Release is the production optimization. If it is absent or cannot download, rebuild the selected tag. A present corrupt archive fails extraction, as in conf-app. Source/build failure still stops deployment.

Functions and Firebase configuration come from the selected tag, not an arbitrary archived backend. Functions install from their frozen lockfile. Old tags can lack the current workflow scripts, so a runner checked out from protected master executes the deployment against tag source.

## Explicit platform adaptations

- One Firebase web app maps to conf-app's representative Lite deployment; there are no Full/Diagramly/AsyncAPI variants, Forge installations, D1 migrations or Atlassian login shards to port.
- Node 22 and root/web/functions lockfiles match web-sequence's runtime. `release-YYYYMMDDHHMMSS` remains its timestamp tag convention, rather than conf-app's variant suffixes.
- The existing web-sequence rollback entry point remains; conf-app has no separate rollback workflow in its current workflow inventory.
- Live staging marker checks before/after E2E detect cross-branch replacement; they do not restrict which branch can deploy staging.
- Production and rollback share a non-cancelling lock; manual Publish remains the release approval, with no extra environment reviewer approval.
- conf-app's identical-tree PR-E2E reuse and multi-variant scheduling optimizations are not ported here: web-sequence runs its staging suite again on master. This does not skip a release gate.
- Chrome extension publishing remains opt-in through `[publish-extension]`.

## Repository settings and rollout

Master requires GitHub Actions `Release validation` with an up-to-date branch and PRs (zero mandatory approving reviewers for the solo-maintainer workflow). Admin enforcement and force-push/deletion protections remain. Production environment permits master and `release-*` tags.

This change does not publish or roll back production. CI/staging must pass before merging; after merge, verify the master draft before manually publishing.
