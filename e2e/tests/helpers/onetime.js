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
// trips regardless of the current APP_VERSION.
export async function suppressOneTimeModals(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('onboarded', JSON.stringify(true));
      localStorage.setItem('lastSeenVersion', JSON.stringify('99.0.0'));
    } catch {
      /* storage may be unavailable on the very first about:blank — ignored */
    }
  });
}
