import { defineConfig, devices } from '@playwright/test';

// Runs e2e/legacy against the LEGACY Preact app under src/ with the Auth and
// Firestore emulators. The default config targets the rewrite under web/.
const PORT = 3100;

export default defineConfig({
  testDir: './e2e/legacy',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: process.env.PW_OUTPUT_DIR || 'test-results/legacy',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'node_modules/.bin/firebase emulators:start --config firebase.legacy-e2e.json --only auth,firestore --project staging-zenuml-27954',
      // Private ports, so another session's emulators on 8080 or 9099 cannot
      // satisfy this probe or block startup.
      url: 'http://127.0.0.1:9199',
      reuseExistingServer: !process.env.CI,
      timeout: 240 * 1000,
      // SIGTERM lets the CLI stop its Firestore JVM; the default leaves it running.
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10 * 1000 },
    },
    {
      command: `VITE_USE_EMULATOR=1 node_modules/.bin/vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
