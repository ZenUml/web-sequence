// Modals — uncovered/deeper coverage (E2E_GAP_TEST_PLAN §"Modals").
//
// modals.spec.js already covers OPEN + one action + Escape for Settings /
// Create-New / Help / Cheat-Sheet / Shortcuts / Pricing. This spec does NOT
// duplicate those; it covers the deeper modal behaviours the gap plan calls out:
//   MOD-1 onboarding shows once per profile (localStorage `onboarded`)
//   MOD-3 single-modal invariant (open Settings → open Help → Settings is gone)
//   MOD-4 Help links have correct hrefs + target=_blank + rel=noopener
//   MOD-5 cheat-sheet lists the documented example rows
//   MOD-6 shortcuts modal lists the Global + Editor groups
//   MOD-7 login modal opens from header "Sign in" AND from a gated action
//
// Selectors are taken from the components verbatim (AppMenu.tsx / HelpModal.tsx /
// CheatSheetModal.tsx / KeyboardShortcutsModal.tsx / OnboardingModal.tsx /
// AppHeader.tsx / CssPanel.tsx / AppRoot.tsx) — none invented.
//
// Onboarding gate (AppRoot.tsx): the first-run effect opens onboarding only when
// localStorage `onboarded` is falsy AND syncStore `lastSeenVersion` is empty. On
// web, syncStore falls back to localStorage, so a clean localStorage slate (no
// suppressOneTimeModals) is the genuine first-run condition. MOD-1 deliberately
// does NOT call suppressOneTimeModals — it needs the real first-run path. Every
// other test here DOES suppress so onboarding/pledge don't trap focus.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

// Deployed sites (staging/prod via PW_BASE_URL) load third-party analytics/CDN
// scripts that throw uncaught errors we don't own; treat those as noise. Copied
// verbatim from smoke.spec.js so this spec stays usable on the staging gate.
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

test.beforeEach(async ({ page }) => {
  // Fail on genuine uncaught app errors; ignore known third-party noise.
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
});

/** Open an item in the header app-menu by its trigger testid. */
async function openViaHeaderMenu(page, triggerTestId) {
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator(`[data-testid="${triggerTestId}"]`).click();
}

/** Reach the editor with a clean localStorage slate AND one-time modals suppressed. */
async function gotoEditorSuppressed(page) {
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

// ──────────────────────────────────────────────────────────────────────────────
// MOD-1: Onboarding modal shows once per profile (localStorage `onboarded`).
// fresh slate → onboarding shown; dismiss stamps `onboarded` (+ lastSeenVersion);
// a reload of the SAME profile → onboarding gone.
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-1: onboarding modal shows on first run and is gone after dismiss + reload', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'needs a local clean-slate (empty onboarded/lastSeenVersion); flaky on the deployed staging gate',
  );
  // First-run path — do NOT suppress the one-time modals; we WANT onboarding.
  // Land on the origin, wipe storage to simulate a brand-new profile, then reload
  // so AppRoot's boot effect re-evaluates the (now empty) onboarding gate.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Bare '/' boots the editor; the onboarding effect opens its modal on the empty
  // `onboarded` + empty `lastSeenVersion` slate.
  const onboarding = page.locator('[data-testid="onboarding-modal"]');
  await expect(onboarding).toBeVisible({ timeout: 15_000 });

  // Sanity: the dismiss flag is not yet set before we dismiss.
  expect(
    await page.evaluate(() => localStorage.getItem('onboarded')),
  ).toBeNull();

  // Dismiss via "Get started" → AppRoot's onDismiss writes localStorage.onboarded
  // = true and closes the modal.
  await page.locator('[data-testid="onboarding-get-started"]').click();
  await expect(onboarding).toBeHidden();

  // The dismissal persisted the `onboarded` flag for this profile.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('onboarded')))
    .toBe('true');

  // Reload the SAME profile (no storage clear): onboarding must NOT reappear.
  await page.reload();
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible({
    timeout: 15_000,
  });
  // Give the boot effects a beat, then assert onboarding stayed closed.
  await expect(page.locator('[data-testid="onboarding-modal"]')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-3: only one modal open at a time. Opening a second modal while one is open
// replaces it (activeModal is a single value in uiStore) — the first closes.
//
// We open the SECOND modal via the global Ctrl/Cmd+Shift+? shortcut rather than
// the header menu: the first modal's Radix overlay (fixed inset-0) intercepts
// pointer events on the header trigger, but the shortcut is a window keydown
// listener (AppRoot) that fires regardless of the overlay — and routes through the
// same openModal('shortcuts') the menu would, so it exercises the same invariant.
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-3: opening a second modal closes the first (single-modal invariant)', async ({
  page,
}) => {
  await gotoEditorSuppressed(page);

  // Open Settings via the header menu.
  await openViaHeaderMenu(page, 'header-settings');
  const settings = page.locator('[data-testid="settings-modal"]');
  await expect(settings).toBeVisible();

  // Open the Keyboard-Shortcuts modal via the global accelerator while Settings is
  // open. activeModal is single-valued, so this must REPLACE Settings.
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+?`);

  const shortcuts = page.locator('[data-testid="shortcuts-modal"]');
  await expect(shortcuts).toBeVisible();

  // The invariant: Settings is gone, exactly one modal (Shortcuts) is open.
  await expect(settings).toHaveCount(0);
  await expect(shortcuts).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-4: Help modal links (Docs / Contact / GitHub) have the correct hrefs and
// open safely in a new tab (target=_blank + rel includes noopener).
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-4: Help modal links carry correct hrefs + target=_blank + rel=noopener', async ({
  page,
}) => {
  await gotoEditorSuppressed(page);
  await openViaHeaderMenu(page, 'header-help');

  const modal = page.locator('[data-testid="help-modal"]');
  await expect(modal).toBeVisible();

  // Exact URLs sourced from HelpModal.tsx (DOCS_URL / CONTACT_URL / GITHUB_URL).
  const links = [
    { name: 'Documentation & help', href: 'https://www.zenuml.com/help.html' },
    { name: 'Contact us', href: 'https://zenuml.com/docs/about/contact-us' },
    { name: 'GitHub', href: 'https://github.com/ZenUml/web-sequence' },
  ];

  for (const { name, href } of links) {
    const link = modal.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    // rel is "noreferrer noopener" — assert it contains noopener (the security bit).
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-5: cheat-sheet lists the documented example rows. Assert the feature labels
// AND their example DSL (the rows are SOURCED in CheatSheetModal.tsx, not invented).
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-5: cheat-sheet lists the documented DSL example rows', async ({
  page,
}) => {
  await gotoEditorSuppressed(page);
  await openViaHeaderMenu(page, 'header-cheatsheet');

  const modal = page.locator('[data-testid="cheatsheet-modal"]');
  await expect(modal).toBeVisible();

  // Feature labels every documented row carries (CheatSheetModal.tsx ROWS).
  for (const feature of [
    'Participant',
    'Message',
    'Async message',
    'Nested message',
    'Self-message',
    'Return',
    'Instance creation',
    'Alt (conditional)',
    'Loop',
    'Comment',
  ]) {
    await expect(modal.getByText(feature, { exact: true })).toBeVisible();
  }

  // And the example DSL for a few rows, proving the EXAMPLE column rendered too.
  await expect(modal).toContainText('Alice->Bob: How are you?'); // async message
  await expect(modal).toContainText('a = new A()'); // instance creation
  await expect(modal).toContainText('while (condition)'); // loop
  await expect(modal).toContainText('// This is a comment'); // comment

  // Count the rendered rows — one <tr> per documented feature (10).
  await expect(modal.locator('tbody tr')).toHaveCount(10);
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-6: shortcuts modal lists the Global + Editor groups, with representative
// bindings under each (KeyboardShortcutsModal.tsx GLOBAL / EDITOR sections).
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-6: shortcuts modal lists the Global and Editor groups with bindings', async ({
  page,
}) => {
  await gotoEditorSuppressed(page);
  await openViaHeaderMenu(page, 'header-shortcuts');

  const modal = page.locator('[data-testid="shortcuts-modal"]');
  await expect(modal).toBeVisible();

  // Both group headers render.
  await expect(modal.getByRole('heading', { name: 'Global' })).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Editor' })).toBeVisible();

  // Representative GLOBAL bindings.
  await expect(modal.getByText('Save', { exact: true })).toBeVisible();
  await expect(modal.getByText('Clear console', { exact: true })).toBeVisible();
  await expect(
    modal.getByText('Keyboard-shortcuts help', { exact: true }),
  ).toBeVisible();
  await expect(modal).toContainText('Ctrl/Cmd+S'); // Save binding text

  // Representative EDITOR bindings.
  await expect(modal.getByText('Find', { exact: true })).toBeVisible();
  await expect(
    modal.getByText('Toggle comment', { exact: true }),
  ).toBeVisible();
  await expect(modal).toContainText('Ctrl/Cmd+/'); // toggle-comment binding text
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-7a: login modal opens from the header "Sign in" button (signed-out editor).
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-7: login modal opens from the header "Sign in" affordance', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'needs a signed-out slate (header "Sign in" only renders when logged out); flaky on the deployed staging gate',
  );
  await gotoEditorSuppressed(page);

  // Signed-out → the header shows the "Sign in" button (header-login).
  const signIn = page.locator('[data-testid="header-login"]');
  await expect(signIn).toBeVisible();
  await signIn.click();

  // LoginModal opens. It has no inner wrapper testid; its provider buttons do
  // (login-<provider>), and they only exist inside the open modal — anchor on
  // them. All four providers (google/github/facebook/twitter) render.
  for (const provider of ['google', 'github', 'facebook', 'twitter']) {
    await expect(
      page.locator(`[data-testid="login-${provider}"]`),
    ).toBeVisible();
  }
  // The modal carries its accessible title.
  await expect(
    page.getByRole('dialog').getByText('Sign in to ZenUML'),
  ).toBeVisible();
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-7b: login modal opens from a GATED action. Custom (non-plain) CSS is
// Plus-only; for a signed-out user, switching the CSS mode to SCSS routes through
// cssGated() which opens the sign-in modal (AppRoot.handleSetCssMode → cssGated →
// setLoginModalOpen(true)).
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-7: a gated custom-CSS action opens the login modal (signed-out)', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'needs a signed-out slate (the CSS gate only opens login when logged out); flaky on the deployed staging gate',
  );
  await gotoEditorSuppressed(page);

  // The CSS panel is collapsed by default (empty CSS) — expand it to reach the
  // pre-processor mode Select (CssPanel: css-panel-strip → css-panel-expanded).
  await page.locator('[data-testid="css-panel-strip"]').click();
  const modeSelect = page.locator('[data-testid="css-mode-select"]');
  await expect(modeSelect).toBeVisible();

  // No login modal yet.
  await expect(page.locator('[data-testid="login-google"]')).toHaveCount(0);

  // Pick SCSS (a non-plain mode) → cssGated() opens sign-in for the anonymous user.
  await modeSelect.click();
  await page.getByRole('option', { name: 'SCSS', exact: true }).click();

  // The login modal opened — its provider buttons (only present when open) appear.
  await expect(page.locator('[data-testid="login-google"]')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('Sign in to ZenUML'),
  ).toBeVisible();

  // Gate held: because the mode change was withheld (cssGated returned true), the
  // mode select did NOT switch to SCSS — it still reads the plain CSS mode.
  await expect(modeSelect).toContainText('CSS');
  await expect(modeSelect).not.toContainText('SCSS');
});
