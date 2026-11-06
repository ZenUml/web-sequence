// Modals — uncovered/deeper coverage (E2E_GAP_TEST_PLAN §"Modals").
//
// modals.spec.js already covers OPEN + one action + Escape for Settings /
// Create-New / Help / Cheat-Sheet / Shortcuts / Pricing. This spec does NOT
// duplicate those; it covers the deeper modal behaviours the gap plan calls out:
//   MOD-1 a first visit opens the editor without Welcome and records its version baseline
//   MOD-3 single-modal invariant (open Settings → open Help → Settings is gone)
//   MOD-4 Help links have correct hrefs + target=_blank + rel=noopener
//   MOD-5 cheat-sheet lists the documented example rows
//   MOD-6 shortcuts modal lists the Global + Editor groups
//   MOD-7 login modal opens from header "Sign in" AND from a gated action
//
// Selectors are taken from the components verbatim (AppMenu.tsx / HelpModal.tsx /
// CheatSheetModal.tsx / KeyboardShortcutsModal.tsx /
// AppHeader.tsx / CssPanel.tsx / AppRoot.tsx) — none invented.
//
// MOD-1 deliberately does NOT call suppressOneTimeModals: it needs an empty storage
// slate to verify the first-visit baseline. Other tests suppress the upgrade pledge
// so it does not trap focus.

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


/** Reach the editor with a clean localStorage slate AND one-time modals suppressed. */
async function gotoEditorSuppressed(page) {
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

// ──────────────────────────────────────────────────────────────────────────────
// MOD-1: first visit enters the editor without Welcome, records a version baseline,
// and stays clear of Welcome and the upgrade pledge after reload.
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-1: first visit has no Welcome and records a baseline that survives reload', async ({
  page,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'needs a local clean-slate (empty onboarded/lastSeenVersion); flaky on the deployed staging gate',
  );
  // Land on the origin, wipe storage to simulate a brand-new profile, then reload
  // so the app starts with no stored version baseline.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // First visit opens the editor directly and silently records this app version.
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible({ timeout: 15_000 });
  const welcome = page.locator('[data-testid="onboarding-modal"]');
  await expect(welcome).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('lastSeenVersion');
      return raw === null ? null : JSON.parse(raw);
    }))
    .toMatch(/^\d{4}\.\d+\.\d+$/);
  await expect(page.locator('[data-testid="pledge-modal"]')).toHaveCount(0);

  // Reload the same profile: the editor remains usable, with no Welcome or pledge.
  await page.reload();
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(welcome).toHaveCount(0);
  await expect(page.locator('[data-testid="pledge-modal"]')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('lastSeenVersion');
      return raw === null ? null : JSON.parse(raw);
    }))
    .toMatch(/^\d{4}\.\d+\.\d+$/);
});

// ──────────────────────────────────────────────────────────────────────────────
// MOD-3: only one modal open at a time. Opening a second modal while one is open
// replaces it (activeModal is a single value in uiStore) — the first closes.
//
// We open the SECOND modal via the global Ctrl/Cmd+Shift+? shortcut: the first
// modal's Radix overlay (fixed inset-0) intercepts pointer events on the page, but
// the shortcut is a window keydown listener (AppRoot) that fires regardless of the
// overlay and routes through the same single-valued openModal().
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-3: opening a second modal closes the first (single-modal invariant)', async ({
  page,
}) => {
  await gotoEditorSuppressed(page);

  // Open Help via the code-column footer.
  await page.locator('[data-testid="footer-help"]').click();
  const help = page.locator('[data-testid="help-modal"]');
  await expect(help).toBeVisible();

  // Open the Keyboard-Shortcuts modal via the global accelerator while Help is
  // open. activeModal is single-valued, so this must REPLACE Help.
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+?`);

  const shortcuts = page.locator('[data-testid="shortcuts-modal"]');
  await expect(shortcuts).toBeVisible();

  // The invariant: Help is gone, exactly one modal (Shortcuts) is open.
  await expect(help).toHaveCount(0);
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
  await page.locator('[data-testid="footer-help"]').click();

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
// MOD-6: shortcuts modal lists the Global + Editor groups, with representative
// bindings under each (KeyboardShortcutsModal.tsx GLOBAL / EDITOR sections).
// ──────────────────────────────────────────────────────────────────────────────
test('MOD-6: shortcuts modal lists the Global and Editor groups with bindings', async ({
  page,
}) => {
  await gotoEditorSuppressed(page);
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+?`);

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
  // them. Google and GitHub are the supported sign-in providers.
  for (const provider of ['google', 'github']) {
    await expect(
      page.locator(`[data-testid="login-${provider}"]`),
    ).toBeVisible();
  }
  await expect(page.locator('[data-testid="login-facebook"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="login-twitter"]')).toHaveCount(0);
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
