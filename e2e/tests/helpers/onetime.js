// Shared E2E helper: suppress the M04 one-time-prompt modals.
//
// AppRoot opens the Onboarding modal on boot when `onboarded` is unset, and the
// Support-pledge modal when the stored `lastSeenVersion` is behind APP_VERSION
// (semver compare). Playwright gives every test a fresh browser context with an
// EMPTY localStorage, so without this both modals open on the first load and their
// Radix Dialog overlays trap focus + intercept clicks — breaking specs that drive
// the header/editor (library, persistence, dsl-spot-check, smoke).
//
// addInitScript runs BEFORE any page script on every navigation in the context, so
// the flags are present the first time AppRoot's boot effects read them — there's no
// "set then reload" race. Set `lastSeenVersion` far ahead so the semver gate never
// trips regardless of the current APP_VERSION. NOTE: APP_VERSION uses a date-based
// YYYY.M.D scheme (e.g. 2026.6.7), and semverCompare compares integer tuples, so the
// old `99.0.0` sentinel is actually BEHIND a 2026.* version (99 < 2026) and would
// open the pledge modal. Use a year far beyond any plausible release date.
export async function suppressOneTimeModals(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('onboarded', JSON.stringify(true));
      localStorage.setItem('lastSeenVersion', JSON.stringify('9999.12.31'));
    } catch {
      /* storage may be unavailable on the very first about:blank — ignored */
    }
  });
}
