import { defineConfig, devices } from '@playwright/test';

// Minimal Playwright config for the editor-language e2e harness.
//
// The vite PREVIEW server (serving web/dist) is assumed to be ALREADY running
// at http://localhost:4173 — there is deliberately NO `webServer` block, so the
// run never tries to boot/own a server. After any SOURCE change you must
// `yarn build` first so the preview serves the new code, THEN run the e2e suite.
//
// Vitest (yarn test) owns *.test.ts under src/; this config owns *.spec.ts under
// e2e/. vite.config.ts excludes e2e/** from vitest so the two never collide.
export default defineConfig({
  testDir: 'e2e',
  // Only the explicit *.spec.ts files — never pick up src/ unit tests.
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
