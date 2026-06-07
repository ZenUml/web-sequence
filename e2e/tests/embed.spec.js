// M05 Task 14 — Embed-mode E2E (RM-2 / REQ-EMB-1), local, no auth/emulator.
//
// Embed-by-value (`?embed&code=<DSL>`) renders the diagram WITHOUT a Firestore
// read, so it needs no Firebase auth/emulator: the inline DSL is the source. This
// spec proves the embed surface:
//   - the embed header (embed-header + embed-open-link) is shown;
//   - the full-app CHROME is suppressed — the real header (header-title/header-menu),
//     the sidebar panels (sidebar-editor/sidebar-library) and the editor (dsl-editor)
//     are all ABSENT;
//   - the inline `?code=` diagram renders an SVG in the preview iframe;
//   - the "Open in ZenUML" link points at the canonical app origin.
//
// DISCRIMINATING-ID CONTRACT (ground truth — verified against the source, NOT
// invented). The chrome ids used for the ABSENCE assertions all EXIST in normal
// (non-embed) mode, so their absence in embed is a genuine revert→fail signal:
//   - AppHeader.tsx exposes `header-title` + `header-menu` (there is NO `app-header`).
//   - Sidebar.tsx renders `sidebar-editor` + `sidebar-library` unconditionally
//     (there is NO bare `sidebar` id).
//   - The editor is `dsl-editor`.
// A CONTROL test below pins these against normal mode so the discriminator is
// observable: reverting AppRoot's `if (isEmbed)` short-circuit makes the header /
// sidebar / editor reappear under `?embed`, failing the embed test.
//
// The webServer (playwright.config.js) boots `pnpm -C web dev` on :3000.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';

const CANONICAL_APP_ORIGIN = 'https://app.zenuml.com';
const EMBED_URL = '/?embed&code=A.method()&title=Demo';

const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js', 'gtm.js', 'googletagmanager', 'google-analytics',
  'analytics.js', 'clarity.js', 'clarity.ms', 'paddle.js', 'cdn.paddle.com',
  'zaraz', 'cloudflareinsights',
];
function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { if (!isThirdPartyError(err)) throw err; });
});

// ──────────────────────────────────────────────────────────────────────────────
// CONTROL — pin the discriminator: the chrome ids the embed test asserts ABSENT
// are genuinely PRESENT in normal (non-embed) mode. Normal-mode boot opens the
// one-time onboarding modal, so suppress it (embed mode skips those effects and
// therefore needs no suppression — see the embed tests below).
// ──────────────────────────────────────────────────────────────────────────────
test('CONTROL: normal (non-embed) mode renders the real header, sidebar, and editor', async ({ page }) => {
  await suppressOneTimeModals(page);
  await page.goto('/');

  await expect(page.getByTestId('header-title')).toBeVisible();
  await expect(page.getByTestId('header-menu')).toBeVisible();
  // Both sidebar panels render unconditionally in normal mode.
  await expect(page.getByTestId(/^sidebar-/)).toHaveCount(2);
  await expect(page.getByTestId('dsl-editor')).toBeVisible();
  // The embed shell is NOT present in normal mode.
  await expect(page.getByTestId('embed-header')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// Embed suppresses the full-app chrome and shows the minimal embed header.
// ──────────────────────────────────────────────────────────────────────────────
test('?embed hides the real header, sidebar, and editor; shows the embed header', async ({ page }) => {
  await page.goto(EMBED_URL);

  // The embed shell is present.
  await expect(page.getByTestId('embed-header')).toBeVisible();
  await expect(page.getByTestId('embed-open-link')).toBeVisible();

  // The inline ?title= surfaces in the embed header (discriminating: if embedTitle
  // parsing breaks, the title falls back to the 'Untitled' seed / DEFAULT_TITLE and
  // this fails — code rendering alone would NOT catch a dropped ?title).
  await expect(page.getByTestId('embed-title')).toHaveText('Demo');

  // The full-app chrome (ids that EXIST in normal mode, per the control) is gone.
  await expect(page.getByTestId('header-title')).toHaveCount(0);
  await expect(page.getByTestId('header-menu')).toHaveCount(0);
  await expect(page.getByTestId(/^sidebar-/)).toHaveCount(0);
  await expect(page.getByTestId('dsl-editor')).toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// Embed renders the inline ?code= diagram BY VALUE (no Firestore read needed).
// ──────────────────────────────────────────────────────────────────────────────
test('?embed&code= renders the inline diagram as an SVG in the preview', async ({ page }) => {
  await page.goto(EMBED_URL);

  // The inline DSL renders into the preview iframe's #mounting-point (same mount
  // scaffold the production-build spec asserts). An empty mount can be zero-size
  // before the SVG lands, so assert the SVG itself is visible.
  const svg = page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('#mounting-point svg')
    .first();
  await expect(svg).toBeVisible({ timeout: 15_000 });
});

// ──────────────────────────────────────────────────────────────────────────────
// The "Open in ZenUML" affordance points at the canonical app origin and opens
// in a new tab.
// ──────────────────────────────────────────────────────────────────────────────
test('?embed open-in-app link targets the canonical app origin in a new tab', async ({ page }) => {
  await page.goto(EMBED_URL);

  const link = page.getByTestId('embed-open-link');
  await expect(link).toHaveAttribute('href', /^https:\/\/app\.zenuml\.com\//);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);

  // The link reproduces the diagram by value: it carries the inline code AND title,
  // so the title round-trips into the open-in-app URL too (discriminating on ?title).
  const href = await link.getAttribute('href');
  expect(href.startsWith(CANONICAL_APP_ORIGIN)).toBe(true);
  expect(href).toContain('code=');
  expect(href).toContain('title=Demo');
});

// ──────────────────────────────────────────────────────────────────────────────
// Finding 1 (adversarial review, 2026-06-07): the "Open in ZenUML" link forwards
// the embed's diagram to the FULL app as `?code=<dsl>&title=<title>` WITHOUT
// `?embed`. The full-app boot MUST seed that diagram (legacy app.jsx read ?code=
// unconditionally at boot). This is the END-TO-END proof of the unit-level
// useBootItem `{kind:'code'}` branch: it follows the affordance's destination and
// asserts the diagram actually renders (not last-code, not a blank new diagram).
//
// DISCRIMINATING: reverting the `?code=` boot branch makes the full app ignore the
// param → the preview shows the default new-diagram SVG (or nothing), and the editor
// no longer contains `A.fromEmbedLink()`, failing this test.
// ──────────────────────────────────────────────────────────────────────────────
test('full app honours ?code= (Open-in-ZenUML destination seeds the diagram)', async ({ page }) => {
  await suppressOneTimeModals(page);
  // Same shape the embed open-link mints, but pointed at THIS app (no ?embed).
  await page.goto('/?code=A.fromEmbedLink()&title=From%20Embed');

  // Full-app chrome is present (this is the editable editor, not the embed shell).
  await expect(page.getByTestId('dsl-editor')).toBeVisible();
  await expect(page.getByTestId('embed-header')).toHaveCount(0);

  // The forwarded DSL renders in the preview — proves the boot seeded ?code=.
  const svg = page
    .frameLocator('[data-testid="preview-iframe"]')
    .locator('#mounting-point svg')
    .first();
  await expect(svg).toBeVisible({ timeout: 15_000 });

  // The seeded DSL is in the editor (discriminating: a blank/new or last-code boot
  // would NOT contain this string). CodeMirror renders the source as text.
  await expect(page.getByTestId('dsl-editor')).toContainText('fromEmbedLink');
});

// NOTE: the auth-gated embed combination `?embed&id=&share-token=` (embed composed
// with a shared read-only item, RM-3) needs Firebase auth/emulator to load the
// shared item, so it is DEFERRED to the staging gate — not exercised here.

// ──────────────────────────────────────────────────────────────────────────────
// Embed disables global keyboard shortcuts.
//
// HONESTY NOTE (read before strengthening this): at the E2E layer this is a
// behavioral SMOKE, not a discriminating guard. In embed mode AppRoot short-circuits
// to the embed shell BEFORE the normal return where the modal host lives, so the
// shortcuts modal is never mounted regardless of whether the keydown listener is
// gated. Reverting ONLY the `if (isEmbed) return` in the keydown effect would NOT
// fail this test (the modal still can't render in the embed shell). The revert→fail
// discriminator for the shortcut gate is the AppRoot UNIT test (Task 6). This case
// still earns its place: it proves the user-visible outcome (the shortcut does
// nothing in embed) end-to-end. Do NOT relabel it as discriminating.
// ──────────────────────────────────────────────────────────────────────────────
test('?embed: the keyboard-shortcuts shortcut opens no modal (behavioral smoke)', async ({ page }) => {
  await page.goto(EMBED_URL);
  await expect(page.getByTestId('embed-header')).toBeVisible();

  // Cmd/Ctrl+Shift+? opens the shortcuts modal in normal mode (see modals.spec.js).
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+Shift+?`);

  // No modal appears; the embed shell is unchanged.
  await expect(page.getByTestId('shortcuts-modal')).toHaveCount(0);
  await expect(page.getByTestId('embed-header')).toBeVisible();
});
