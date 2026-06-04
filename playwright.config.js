import { defineConfig, devices } from '@playwright/test';

// PW_BASE_URL lets the same spec run against the local dev server (default),
// the deployed staging site (the post-staging-deploy gate), or production
// (the post-prod-deploy smoke). When it points at a remote URL we must NOT
// spin up the local dev server. See docs/adr/0001-release-pipeline-imitating-conf-app.md.
const isRemoteTarget = !!process.env.PW_BASE_URL;
const isProdBuild = process.env.PW_PROD_BUILD === '1';

// Prod-build mode uses a dedicated port so it never collides with a dev server
// that may already be running on 3000.
const PROD_BUILD_PORT = 3100;
const baseURL =
  process.env.PW_BASE_URL ||
  (isProdBuild ? `http://localhost:${PROD_BUILD_PORT}` : 'http://localhost:3000');

// PW_PROD_BUILD=1 serves the *built* `dist/` with a plain static server instead
// of the dev server. The dev server transparently serves Vite `/@fs/<abs>` URLs,
// which hides deploy-only bundling bugs (e.g. an asset shim that bakes a dev-only
// `/@fs/` path). A static server rooted at `dist/` 404s such paths exactly like
// Firebase Hosting does. Requires `dist/` to be built first (`pnpm build`).
function resolveWebServer() {
  if (isRemoteTarget) return undefined; // site already live
  if (isProdBuild) {
    return {
      command: `npx http-server ./dist -p ${PROD_BUILD_PORT} -s -c-1`,
      url: `http://localhost:${PROD_BUILD_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    };
  }
  return {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  };
}

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

  // Local dev server, static production-build server, or nothing (remote URL).
  webServer: resolveWebServer(),
});