# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Web Sequence is a free sequence diagram online tool that converts Chrome tabs into sequence diagram generators. It's built with Preact and uses ZenUML syntax for creating diagrams. The application runs as both a web app and Chrome extension.

## Common Development Commands

### Development Setup
```bash
pnpm install    # Install dependencies
pnpm dev        # Start development server (Vite)
pnpm start      # Start production server or dev based on NODE_ENV
```

### Building and Release
```bash
pnpm build      # Build for production using Vite (runs: vite build)
pnpm release    # Copy built resources to app/ and extension/ directories (runs: gulp)
pnpm lint       # Run ESLint on src/ (Note: eslint-config-synacor may need fixing)
pnpm test       # Run Jest tests
```

### Deployment
```bash
pnpm deploy:staging  # Deploy to Firebase staging environment
pnpm deploy:prod     # Deploy to Firebase production environment
```

### Extension Publishing
```bash
pnpm upload     # Upload extension to Chrome Web Store
pnpm pub        # Publish extension to Chrome Web Store
```

## Architecture

### Tech Stack
- **Frontend**: Preact 10.18.1 with JSX
- **Build Tool**: Vite 6.3.5 with legacy support
- **Styling**: Tailwind CSS 3.4.3
- **Database**: Firebase Firestore for cloud storage, IndexedDB for local storage
- **Code Editor**: CodeMirror 5.65.16 with multiple language modes
- **Diagram Engine**: @zenuml/core 3.32.3

### Key Components Structure
- **App Component** (`src/components/app.jsx`): Main application container managing global state, user authentication, and modal orchestration
- **ContentWrap** (`src/components/ContentWrap.jsx`): Handles the main editor and preview layout
- **MainHeader** (`src/components/MainHeader.jsx`): Top navigation and toolbar
- **PageTabs** (`src/components/PageTabs.jsx`): Multi-page diagram management
- **SavedItemPane** (`src/components/SavedItemPane.jsx`): Saved diagrams browser

### Pages System
The application supports multi-page diagrams:
- Items can have multiple pages with individual JS/CSS content
- Pages are managed through the `pages` array in currentItem
- Legacy single-page items are migrated to pages format automatically
- Page operations: add, switch, delete, update

### Storage Architecture
- **Local Storage**: Browser localStorage for preferences and temporary data
- **Cloud Storage**: Firebase Firestore for user accounts and synced diagrams
- **Item Service** (`src/itemService.js`): Abstracts storage operations
- **Sync Service** (`src/services/syncService.js`): Handles diagram synchronization

### User Management
- Firebase Authentication for user accounts
- Three tiers: Free (3 diagrams), Basic (20 diagrams), Plus/Advanced (unlimited)
- Subscription management via Paddle payment processor
- Auto-save functionality for logged-in users

### Code Processing
- **Modes**: Support for HTML, CSS, JS with preprocessors (Sass, Less, TypeScript, etc.)
- **Computes** (`src/computes.js`): Handles code transformation and preprocessing
- **External Libraries**: Support for CDN-hosted libraries
- **Templates**: Predefined starter templates for common frameworks

## Development Notes

### Environment Detection
- `window.IS_EXTENSION`: Detects Chrome extension environment
- `window.zenumlDesktop`: Detects desktop application environment
- `this.isEmbed`: Detects embedded iframe usage

### Testing
- Jest with Preact preset for unit tests
- Browser mocks in `src/tests/__mocks__/`
- Test files: `*.test.js` in relevant directories

### Code Style
- ESLint with Synacor config
- Prettier for code formatting
- Pre-commit hooks for linting and formatting

### External Integrations
- Firebase for backend services
- Mixpanel for analytics
- CodePen export functionality
- Screenshot capture for diagrams

## File Structure Highlights

- `src/components/`: All React/Preact components
- `src/services/`: Business logic and API integrations
- `src/common/`: Shared utilities and helpers
- `templates/`: Predefined diagram templates
- `extension/`: Chrome extension specific files
- `functions/`: Firebase Cloud Functions
- `static/`: Static assets and libraries