import { defineConfig, devices } from '@playwright/test';

// PW_BASE_URL lets the same specs run against a deployed site (staging/prod) by
// pointing the baseURL elsewhere and skipping the local servers. When unset we
// boot the NEW app under web/ locally:
//   - dev server on :3000 (smoke + dsl-spot-check)
//   - vite preview of web/dist on :4173 (production-build asset spec)
// See docs/adr/0001-release-pipeline-imitating-conf-app.md.
const isRemoteTarget = !!process.env.PW_BASE_URL;

// The production-build spec navigates here explicitly (web/dist served statically
// by `vite preview`), independent of baseURL — that is the point: it exercises
// the BUILT bundle, where a dev-only /@fs/ asset URL would 404.
export const PREVIEW_PORT = 4173;

const baseURL = process.env.PW_BASE_URL || 'http://localhost:3000';

// Two local servers run together via the webServer array: the dev server (the
// app under test for smoke/dsl-spot-check) and a static preview of web/dist (the
// production-build asset proof). Against a remote target we start neither.
function resolveWebServers() {
  if (isRemoteTarget) return undefined; // site already live
  return [
    {
      command: 'pnpm -C web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      // `vite preview` serves web/dist (the built output). Requires a prior
      // `pnpm -C web build`; the production-build spec also asserts the built
      // zenuml-*.js exists on disk so a stale/missing dist fails loudly.
      command: `pnpm -C web preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ];
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
  ],

  // Local dev + preview servers (or nothing, for a remote target).
  webServer: resolveWebServers(),
});
