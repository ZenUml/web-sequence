import { defineConfig, devices } from '@playwright/test';

// Playwright config for the editor-language e2e harness.
//
// DETERMINISTIC SERVER: the `webServer` block builds THIS worktree's source and
// serves it on a dedicated strict port (4399). This is deliberate — an earlier
// version assumed a preview was already running on :4173 and had NO webServer,
// which silently ran the suite against whatever happened to be on that port
// (e.g. a different git worktree's build), producing false greens/reds. Building
// + serving here guarantees the suite tests the code in THIS tree. Override the
// target with PW_BASE_URL to point at an already-running server (skips webServer).
//
// Vitest (yarn test) owns *.test.ts under src/; this config owns *.spec.ts under
// e2e/. vite.config.ts excludes e2e/** from vitest so the two never collide.
const PORT = 4399;

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
    baseURL: process.env.PW_BASE_URL ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
  },
  // Skip the managed server when PW_BASE_URL points at an already-running target.
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `yarn build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
