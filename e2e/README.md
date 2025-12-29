# E2E Tests

This directory contains end-to-end tests using Playwright.

## Setup

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Run tests:
   ```bash
   # Run all e2e tests
   pnpm test:e2e
   
   # Run tests in headed mode (see browser)
   pnpm test:e2e:headed
   
   # Run with UI mode
   npx playwright test --ui
   ```

## Configuration

- **Base URL**: `http://localhost:3001` (development server)
- **Browsers**: Chrome, Firefox, Safari
- **Retries**: 2 in CI, 0 locally
- **Screenshots**: Only on failure
- **Videos**: Retained on failure
- **Traces**: On first retry

## Development Server

Tests automatically start the development server (`pnpm dev`) if it's not already running. The server starts on port 3001 and tests wait for it to be ready.

## CI Integration

Tests are configured for CI environments with:
- Reduced parallelism (workers: 1)
- Automatic retries (2x)
- Strict mode (forbidOnly: true)