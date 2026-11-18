# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **ZenUML Web Sequence**, a free sequence diagram online tool that converts text into UML sequence diagrams. It's built as both a web application (https://app.zenuml.com) and a Chrome extension.

## Technology Stack

- **Frontend Framework**: Preact (v10.18.1) - lightweight React alternative
- **Build Tool**: Vite (v6.3.5)
- **UI Libraries**: Tailwind CSS, Radix UI, Headless UI
- **Core Engine**: @zenuml/core (v4.13.1) - sequence diagram rendering (bundles its own React; renders in its bundled IBM Plex Sans)
- **Code Editor**: CodeMirror (v5.65.16)
- **Backend**: Firebase (authentication, Firestore, cloud functions)
- **Testing**: Jest + Enzyme (unit); Playwright (E2E)
- **Package Manager**: Yarn (unit tests, dev, build — see volta config); pnpm (Playwright E2E — `playwright.config.js` uses `pnpm dev`)

## Architecture

The application follows a component-based architecture with:
- **Split-pane interface**: Code editor on left, live preview on right
- **Modal-based UI**: Settings, help, pricing, etc.
- **Service layer pattern**: Business logic separated in `/src/services/`
- **Multi-page support**: Users can create multiple diagram pages
- **Chrome extension support**: Packaged separately in `/extension/`

Key directories:
- `/src/components/` - Preact components
- `/src/services/` - Business logic and Firebase integration
- `/src/zenuml/` - ZenUML specific components
- `/functions/` - Firebase cloud functions
- `/e2e/tests/` - Playwright E2E test specs

## Common Development Commands

```bash
# Install dependencies (use yarn, not npm)
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Package for release (creates extension.zip)
yarn release

# Run tests
yarn test

# Run linting
yarn lint

# Deploy to staging
yarn deploy:staging

# Deploy to production
yarn deploy:prod
```

## Testing

```bash
# Run all unit tests (Jest + Enzyme)
yarn test

# Run a specific unit test file
yarn test src/common/ensure.test.js

# Run Playwright E2E tests against the local dev server
yarn test:e2e

# Run E2E in headed mode (useful for debugging)
yarn test:e2e:headed

# Run E2E against staging or production
PW_BASE_URL=https://staging.zenuml.com yarn test:e2e

# Run E2E against the production build (requires `yarn build` first)
PW_PROD_BUILD=1 yarn test:e2e

# Manual testing guide available at
# src/manual-test-guide.md
```

Unit test files follow the pattern `*.test.js` and are located either in `/src/tests/` or alongside the components they test. E2E tests live in `/e2e/tests/`.

### Test locally, cheapest layer first

Validate the same candidate in this order, and start the next layer only after the one before it passes:

| Layer | Cost | Typical check |
|---|---|---|
| 1. Unit / component | seconds | `yarn test`, Storybook story |
| 2. Local app | minutes | `yarn dev` or a local production build, driven by Playwright (`yarn test:e2e`, `PW_PROD_BUILD=1`), with screenshots |
| 3. CI-deployed staging | one deploy, shared site | staging E2E on the branch's CI deployment |
| 4. Production release or store build (e.g. a TestFlight upload) | slowest, partly irreversible | only for what layers 1-3 cannot show |

- Do not upload, deploy or release to find out something a lower layer can show. A build, deploy or store upload that only reveals a visual or behavior bug you could have seen locally is wasted cost.
- Packaged artifacts (installer, signed app, extension zip): inspect the built artifact itself before delivery. Check its icons, version and a real launch with an isolated data directory and port, never the user's live data.
- At each layer record the tested commit or build and where the visible UI is served from. Keep real UI evidence (screenshots or snapshots). A blocked or skipped UI assertion is not a pass, and unit tests do not replace UI evidence.
- If a layer fails, fix the issue and repeat the affected layer; final acceptance uses the final candidate.
- Pure documentation changes and changes with no UI impact skip the UI layers; say so and give the reason.

This follows the Conf App ordering (Storybook, then Forge Tunnel, then CI-deployed staging) in `zenuml/conf-app/CLAUDE.md`, section "Confluence UI changes require ordered visual validation".

### CI after every push

After every push or merge, watch CI yourself with `gh run view <RUN_ID> --json status,conclusion` (or the `babysit-pr` skill), and do not hand the check to the desktop app's Auto-fix. The desktop app's built-in "never poll CI" instruction is a default; the owner has waived it for this repo. `gh run watch` exit codes are unreliable, so always re-read `status` and `conclusion` after it ends. A `push` and `pull_request` pair of runs on one SHA is normal: one is cancelled as a duplicate.

## Important Development Notes

1. **Package managers**: Use **Yarn** for most tasks (install, dev, test, build, lint). Use **pnpm** when running Playwright E2E — `playwright.config.js` boots the dev server via `pnpm dev`. Do not use npm.
2. **Preact aliases**: React imports are aliased to Preact in the build config
3. **No TypeScript**: This is a JavaScript project with JSX
4. **Firebase emulators**: Use for local development - see `/docs/firebase-emulator-testing.md`
5. **Pre-commit hooks**: Automatically run Prettier and ESLint
6. **Chrome extension**: Built to `/extension/` directory during release
7. **Storybook**: Available for component development — `yarn storybook` (port 6006), `yarn build-storybook` for a static build

## Code Style

- ESLint configuration extends `eslint-config-synacor`
- Prettier formatting on commit via lint-staged
- Follow existing patterns for component structure and service layer

## Deployment Process

See [docs/adr/0002-verified-release-promotion.md](docs/adr/0002-verified-release-promotion.md) for the conf-app-aligned flow and platform adaptations.

- **Branches/PRs**: Build, frozen installs and local Chromium E2E. Every branch can deploy shared staging; same-repository PRs deploy too. Fork PRs never receive staging credentials.
- **Staging E2E**: Runs on master and ready-for-review PRs, not draft PRs or ordinary feature-branch pushes. Live identity checks detect shared-site replacement.
- **Production**: Only successful master staging E2E creates a timestamp-tagged draft pinned to the tested SHA. Manually publishing the release or prerelease triggers deployment. Checkout that tag; prefer its Release attachment, or rebuild with that tag's frozen lockfiles if missing. Never install latest dependencies.
- **Rollback**: Dispatch **Rollback Production** on master with a previous release tag. The same release-attachment/source-rebuild path redeploys hosting, functions and rules, then runs production smoke. Transient Actions artifact expiry does not prevent rebuilding.
- **Chrome extension**: Attached as `extension.zip`. Web Store publishing remains opt-in with `[publish-extension]` in the release body.
- **Adaptations**: Firebase replaces Cloudflare/Forge; Node 22 and separate root/web/functions lockfiles remain. Production and rollback share a non-cancelling lock. The protected master runner supports tags predating these workflow changes.


## Key Features to Understand

1. **Diagram Syntax**: Uses @zenuml/core for parsing and rendering
2. **Multi-page System**: Users can create/delete multiple diagram pages
3. **Cloud Sync**: Firebase integration for saving diagrams
4. **Offline Support**: Works without internet connection
5. **Export Options**: PNG, SVG, and other formats
6. **Subscription System**: Paddle integration for premium features
7. **Theme Support**: Multiple editor themes and diagram styles

## Cursor Rules Integration

This project has Cursor rules configured at `.cursor/rules/interactive-feedback-mcp.mdc` that enable interactive feedback through MCP when working with the codebase.
