// Playwright globalSetup for the `cloud` project — runs ONCE before the
// emulator-backed specs. It wipes the Auth + Firestore emulators so each run
// starts from a clean slate (prior runs' seeded items/users/subscriptions don't
// leak into a fresh run). The emulators are booted by the cloud webServer
// (firebase emulators:exec wrapping the dev server — see playwright.config.js), so
// by the time globalSetup runs they're already listening; we just clear them.
//
// This setup is ONLY registered on the cloud project's config path, never the
// default chromium suite, so the signed-out staging gate is untouched.
import { clearFirestore, clearAuth } from './firestoreEmu.mjs';

export default async function globalSetup() {
  // Best-effort: if the emulators aren't up yet (rare race) we retry briefly so the
  // first spec doesn't see stale data. A hard failure here would abort the run, which
  // is the right signal that the emulator webServer never came up.
  let lastErr;
  for (let i = 0; i < 20; i++) {
    try {
      await clearFirestore();
      await clearAuth();
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`cloud globalSetup: emulators not reachable to clear — ${lastErr}`);
}
