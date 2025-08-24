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
   
   # Run specific test file
   npx playwright test feature-survey.spec.js
   
   # Run with UI mode
   npx playwright test --ui
   ```

## Test Structure

### Feature Survey Tests (`feature-survey.spec.js`)

Tests the complete feature priority survey functionality:

- **Survey Appearance**: Verifies survey shows on first visit
- **Feature Selection**: Tests most/least important selection logic
- **Submission**: Validates survey submission and localStorage persistence
- **Prevention**: Ensures survey doesn't reappear after submission
- **Mixpanel Tracking**: Verifies analytics events are fired
- **Dismissal**: Tests survey dismissal behavior
- **Edge Cases**: 30-day expiry, partial selections, conflict resolution

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