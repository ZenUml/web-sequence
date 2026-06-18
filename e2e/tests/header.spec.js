// Header / title E2E (signed-out / local flows only). Covers the gap-plan §14
// rows that are runnable WITHOUT the Firebase emulator:
//   HDR-1  inline title edit commits the typed title (Enter).
//   HDR-5  the "Your diagrams" breadcrumb returns to the hub (/?view=diagrams).
//
// HONEST GAPS (verified against the code + the live app, NOT assumed):
//   HDR-2 (Escape reverts the title) — NOT IMPLEMENTED. The header title is a plain
//     CONTROLLED <input> (web/src/components/header/AppHeader.tsx → TextInput, bound
//     to onTitleChange=setTitle). onChange fires setTitle on EVERY keystroke, so the
//     store already holds the typed value before Escape; there is no draft buffer and
//     no onKeyDown/Escape handler to revert to a snapshot. Probed live: typing
//     "TempEscapeTitle" then Escape leaves the field at "TempEscapeTitle" (no revert).
//     → test.fixme: the revert behavior the case asserts does not exist in the product.
//   HDR-3 (unsaved marker appears on edit, clears on save) — needs AUTH. The savestate
//     indicator (data-testid="header-savestate") has precedence !signedIn → 'local'
//     ABOVE the dirty branch (AppHeader.tsx SaveState), so a SIGNED-OUT user always
//     reads "Local only" and NEVER shows the amber "Unsaved" marker — even though the
//     store's `dirty` flips true. Probed live: after editing the title the indicator
//     stays data-state="local". So BOTH halves (marker-on-edit AND clear-on-save) of
//     this case require a signed-in session. → test.fixme with that reason.
//   HDR-4 (fork) / HDR-6 (profile menu) — need cloud/auth → test.fixme per the plan.
//
// Conventions mirror smoke/modals/persistence/library specs: the third-party
// pageerror filter, suppressOneTimeModals in beforeEach, openEditor/gotoHome.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites (staging/prod, via PW_BASE_URL) load third-party analytics/CDN
// scripts that throw uncaught errors we don't own; treat those as noise so this
// spec stays usable against the live staging E2E gate (copied from smoke.spec.js).
const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js',
  'gtm.js',
  'googletagmanager',
  'google-analytics',
  'analytics.js',
  'clarity.js',
  'clarity.ms',
  'paddle.js',
  'cdn.paddle.com',
  'zaraz',
  'cloudflareinsights',
];

function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}

/** Navigate to the EDITOR with a clean localStorage slate (see persistence.spec.js). */
async function gotoFresh(page) {
  // M04: seed only the one-time-modal flags (onboarded / lastSeenVersion) so the
  // Onboarding/Support-pledge dialogs don't trap focus and intercept the header
  // clicks these tests drive. localStorage.clear() below wipes user data; the init
  // script re-seeds those two flags on the subsequent goto.
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Editor-as-landing: bare '/' boots the editor (cleared storage → seeds a fresh
  // sample diagram), so openEditor lands straight on the CM6 surface here.
  await openEditor(page);
}

/** The header title <input>. */
function titleInput(page) {
  return page.locator('[data-testid="header-title"]');
}

/** Replace the header title with `value` (select-all → Delete → type). */
async function setTitle(page, value) {
  const title = titleInput(page);
  await expect(title).toBeVisible();
  await title.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await title.pressSequentially(value);
}

test.beforeEach(async ({ page }) => {
  // Fail the test on genuine uncaught app errors, except known third-party noise.
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// HDR-1: inline title edit — focus the title, type, Enter commits the new title.
//
// The commit is asserted TWO ways so this isn't a bare echo-back of the input:
//   1. after Enter the field holds the typed value (the input committed it), and
//   2. saving the diagram and opening the hub shows a card carrying the new title —
//      proving Enter committed the value into the actual item, not just the field.
// ──────────────────────────────────────────────────────────────────────────────
test('HDR-1: typing a title and pressing Enter commits the new title', async ({
  page,
}) => {
  await gotoFresh(page);

  const title = titleInput(page);
  await expect(title).toBeVisible();
  // The starter item titles to "Untitled"; assert we start from a different value so
  // the change below is a real edit, not a coincidence.
  await expect(title).toHaveValue('Untitled');

  const NEW_TITLE = 'HeaderCommitDiagram';
  await setTitle(page, NEW_TITLE);
  // Enter commits the edit. (The field is a controlled input bound to setTitle, so the
  // value persists across the Enter — Enter must NOT clear or revert it.)
  await page.keyboard.press('Enter');
  await expect(title).toHaveValue(NEW_TITLE);

  // Save the diagram (signed-out, local). Save lives in the header overflow menu; the
  // FIRST signed-out save opens the one-time "Saved on this device" notice — dismiss it.
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-save"]').click();
  const noticeCancel = page.locator('[data-testid="confirm-cancel"]');
  await expect(noticeCancel).toBeVisible();
  await noticeCancel.click();
  await expect(noticeCancel).toBeHidden();

  // The committed title rode into the saved item: the hub card carries it. A FULL
  // navigation to the hub freshly mounts useItems, so this reads the persisted index.
  await gotoHome(page);
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(NEW_TITLE, { exact: true })).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// HDR-5: the "← Your diagrams" breadcrumb returns to the hub (/?view=diagrams).
//
// onGoHome is always wired in editor mode (AppRoot passes onGoHome={goHome}), so the
// breadcrumb renders for any editor view. Clicking it navigates to ?view=diagrams and
// renders the HomeView hub — asserted via BOTH the URL and the home-view surface.
// ──────────────────────────────────────────────────────────────────────────────
test('HDR-5: the "Your diagrams" breadcrumb returns to the hub', async ({
  page,
}) => {
  await gotoFresh(page);

  // The breadcrumb (back arrow + "Your diagrams") is present in the editor header.
  const breadcrumb = page.locator('[data-testid="hub-breadcrumb"]');
  await expect(breadcrumb).toBeVisible();
  const goHome = page.locator('[data-testid="header-go-home"]');
  await expect(goHome).toBeVisible();
  await expect(goHome).toHaveAttribute('aria-label', 'Back to your diagrams');

  // Click it → lands on the hub at ?view=diagrams.
  await goHome.click();

  await expect(page.locator('[data-testid="home-view"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/\?view=diagrams/);
  // And the editor surface is no longer mounted (we left the editor for the hub).
  await expect(page.locator('[data-testid="dsl-editor"]')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// HDR-2: title edit Escape cancels / reverts.
//
// NOT IMPLEMENTED (verified): the header title is a controlled <input> bound to
// setTitle on every keystroke (AppHeader.tsx → TextInput; editorStore.setTitle). There
// is no draft snapshot and no Escape/onKeyDown handler, so Escape cannot revert — a
// live probe typing "TempEscapeTitle" then Escape leaves the field unchanged. Asserting
// a revert would be asserting behavior the product does not have. Marked fixme until a
// revert-on-Escape affordance is added (a draft buffer committed on Enter/blur and
// discarded on Escape).
test.fixme(
  'HDR-2: pressing Escape reverts an in-progress title edit',
  async () => {
    // Intentionally empty: the revert behavior does not exist yet (see comment above).
    // Implement once the title field gains a draft buffer + Escape→revert handler.
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// HDR-3: an unsaved marker appears on edit and clears after Save.
//
// Needs AUTH (verified): the savestate indicator's precedence is
// !signedIn → 'local' ABOVE the dirty branch (AppHeader.tsx SaveState), so a
// SIGNED-OUT session always renders "Local only" and never the amber "Unsaved"
// marker — even though editorStore.dirty flips true on edit (live-probed:
// data-state stays "local" after a title edit). Both halves of this case
// (marker-on-edit AND clear-on-save) therefore require a signed-in session
// (Firebase Auth emulator / seeded account), which the signed-out staging gate
// lacks. Once auth is available: edit → assert data-state="dirty" ("Unsaved") →
// save → assert data-state="saved".
test.fixme(
  'HDR-3: unsaved marker appears on edit and clears after save (signed-in)',
  async () => {
    // Intentionally empty: the dirty/Unsaved indicator is auth-gated (see comment).
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// HDR-4: Fork button duplicates the current item into an owned copy.
// Needs cloud/auth (the gap plan marks HDR-4 as CLOUD) → deferred.
test.fixme(
  'HDR-4: Fork duplicates the current item into an owned copy',
  async () => {
    // Intentionally empty: fork-to-owned-copy needs a signed-in cloud session.
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// HDR-6: signed-out header shows "Sign in"; signed-in shows the profile menu.
// The signed-in half needs AUTH (the gap plan marks HDR-6 as AUTH) → deferred.
test.fixme('HDR-6: signed-in header shows the profile menu', async () => {
  // Intentionally empty: the signed-in profile menu needs a signed-in session.
});
