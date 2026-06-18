import { defineConfig, devices } from '@playwright/test';

// PW_BASE_URL lets the same specs run against a deployed site (staging/prod) by
// pointing the baseURL elsewhere and skipping the local servers. When unset we
// boot the NEW app under web/ locally:
//   - dev server on :3000 (smoke + dsl-spot-check)
//   - vite preview of web/dist on :4173 (production-build asset spec)
// See docs/adr/0001-release-pipeline-imitating-conf-app.md.
const isRemoteTarget = !!process.env.PW_BASE_URL;

// The emulator-backed `cloud` project boots a DIFFERENT web server (the dev server
// wrapped in `firebase emulators:exec` with VITE_USE_EMULATOR=1) and runs ONLY the
// cloud spec(s). Selected by PW_CLOUD=1 (set by the `test:e2e:cloud` script). It is a
// SEPARATE run from the default chromium suite so the signed-out staging gate — which
// runs anonymously against the plain dev server — is never affected by the emulator.
const isCloud = process.env.PW_CLOUD === '1';

// The production-build spec navigates here explicitly (web/dist served statically
// by `vite preview`), independent of baseURL — that is the point: it exercises
// the BUILT bundle, where a dev-only /@fs/ asset URL would 404.
export const PREVIEW_PORT = 4173;

const baseURL = process.env.PW_BASE_URL || 'http://localhost:3000';

// firebase-tools v13 (functions/node_modules/.bin/firebase). The GLOBAL firebase
// v9.16.5 is a pkg'd binary whose bundled Node is too old to parse firebase-admin@11's
// optional chaining, so its functions emulator crashes on load. v13 runs the functions
// emulator under the host Node (20), which loads functions/index.js cleanly — this is
// what unlocks the create_share / get_shared_item / sync_diagram cloud-function tests.
const FIREBASE_V13 = './functions/node_modules/.bin/firebase';

// Boot the emulator suite (auth+firestore+functions) as its OWN long-lived process.
// We deliberately do NOT use `emulators:exec "<dev>"`: exec aborts the whole command
// if a sub-emulator doesn't bind within its internal 60s wait, and the Java Firestore
// emulator's cold boot on some machines exceeds that — failing the run before the dev
// server ever starts. `emulators:start` has no such cap; Playwright's own per-webServer
// `timeout` (below) governs how long we wait for the emulators' health URL instead.
const CLOUD_EMULATORS_COMMAND =
  `${FIREBASE_V13} emulators:start --only auth,firestore,functions --project staging-zenuml-27954`;
// Health URL: the functions emulator initializes LAST (after auth+firestore), and `info`
// is a trivial onRequest that 200s once functions are loaded — so a 2xx here proves the
// WHOLE suite (including create_share/get_shared_item) is live, not just Firestore's port.
const CLOUD_EMULATORS_HEALTH_URL =
  'http://127.0.0.1:5002/staging-zenuml-27954/us-central1/info';
// The dev server, wired to the emulators via VITE_USE_EMULATOR (firebase.ts §emulator).
const CLOUD_DEV_COMMAND = 'VITE_USE_EMULATOR=1 pnpm -C web dev';

// Two local servers run together via the webServer array: the dev server (the
// app under test for smoke/dsl-spot-check) and a static preview of web/dist (the
// production-build asset proof). Against a remote target we start neither.
function resolveWebServers() {
  if (isRemoteTarget) return undefined; // site already live
  if (isCloud) {
    // Two servers for the cloud run: the emulator suite, then the emulator-wired dev
    // server. The static web/dist preview is irrelevant to the cloud specs.
    return [
      {
        command: CLOUD_EMULATORS_COMMAND,
        url: CLOUD_EMULATORS_HEALTH_URL,
        reuseExistingServer: !process.env.CI,
        // Generous: a cold Java Firestore boot (+ a first-run jar download) can take
        // well over a minute; Playwright governs the wait here, not exec's 60s cap.
        timeout: 240 * 1000,
      },
      {
        command: CLOUD_DEV_COMMAND,
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
    ];
  }
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
  // The cloud specs seed/probe a SHARED Firestore emulator and sign deterministic
  // uids in/out; running them in parallel would race the global auth/firestore state.
  // Pin the cloud run to a single worker (the default suite stays fully parallel).
  ...(isCloud ? { workers: 1 } : {}),
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Wipe the Auth + Firestore emulators once before the cloud run so each run starts
  // clean. Only registered for the cloud config path — the default suite has no setup.
  ...(isCloud ? { globalSetup: './e2e/cloud/globalSetup.mjs' } : {}),

  projects: isCloud
    ? [
        {
          name: 'cloud',
          // Emulator-backed cases: the live cloud.spec.js + the residual fixme file.
          testMatch: /cloud(\.fixme)?\.spec\.js/,
          // Cold page setup is heavier here than the default 30s: a fresh context's
          // first '/' load compiles the @zenuml/core asset shim + the full app, and
          // emulator round-trips (sign-in custom token, Firestore reads) add latency.
          // 60s keeps a slow-but-correct first newPage/boot from flaking the case.
          timeout: 60 * 1000,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          // The default signed-out suite must NEVER pick up the emulator-backed cloud
          // specs (they require VITE_USE_EMULATOR + the emulator services, absent here).
          testIgnore: /cloud(\.fixme)?\.spec\.js/,
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  // Local dev + preview servers (or the emulator-wrapped dev server for cloud, or
  // nothing for a remote target).
  webServer: resolveWebServers(),
});
