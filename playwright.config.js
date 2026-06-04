import { defineConfig, devices } from '@playwright/test';

// PW_BASE_URL lets the same spec run against the local dev server (default),
// the deployed staging site (the post-staging-deploy gate), or production
// (the post-prod-deploy smoke). When it points at a remote URL we must NOT
// spin up the local dev server. See docs/adr/0001-release-pipeline-imitating-conf-app.md.
const baseURL = process.env.PW_BASE_URL || 'http://localhost:3000';
const isRemoteTarget = !!process.env.PW_BASE_URL;

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Only start a local dev server when testing locally. Against a deployed
  // URL (PW_BASE_URL set) the site is already live, so skip it entirely.
  webServer: isRemoteTarget
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});