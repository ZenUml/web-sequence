# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **ZenUML Web Sequence**, a free sequence diagram online tool that converts text into UML sequence diagrams. It's built as both a web application (https://app.zenuml.com) and a Chrome extension.

## Technology Stack

- **Frontend Framework**: Preact (v10.18.1) - lightweight React alternative
- **Build Tool**: Vite (v6.3.5)
- **UI Libraries**: Tailwind CSS, Radix UI, Headless UI
- **Core Engine**: @zenuml/core (v3.32.3) - sequence diagram rendering
- **Code Editor**: CodeMirror (v5.65.16)
- **Backend**: Firebase (authentication, Firestore, cloud functions)
- **Testing**: Jest with Enzyme
- **Package Manager**: Yarn (required - see volta config)

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
# Run all unit tests
yarn test

# Run a specific test file
yarn test src/common/ensure.test.js

# Manual testing guide available at
# src/manual-test-guide.md
```

Test files follow the pattern `*.test.js` and are located either in `/src/tests/` or alongside the components they test.

## Important Development Notes

1. **Always use Yarn**, not npm - the project uses Yarn workspaces and volta for version management
2. **Preact aliases**: React imports are aliased to Preact in the build config
3. **No TypeScript**: This is a JavaScript project with JSX
4. **Firebase emulators**: Use for local development - see `/docs/firebase-emulator-testing.md`
5. **Pre-commit hooks**: Automatically run Prettier and ESLint
6. **Chrome extension**: Built to `/extension/` directory during release

## Code Style

- ESLint configuration extends `eslint-config-synacor`
- Prettier formatting on commit via lint-staged
- Follow existing patterns for component structure and service layer

## Deployment Process

- **Preview**: Created automatically for PRs
- **Staging**: Merges to master deploy to https://staging.zenuml.com
- **Production**: Create tag `release-<version>` to deploy to https://app.zenuml.com

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