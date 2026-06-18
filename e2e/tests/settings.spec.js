// Settings depth E2E (signed-out / local) — covers the Settings modal beyond the
// font-size smoke in modals.spec.js. Each test changes a setting and asserts a REAL,
// OBSERVABLE consequence in the running editor (CodeMirror theme/keymap/font), the
// boot behavior, persisted state, or the absence of an extension-only control.
//
// Plan cases (e2e/E2E_GAP_TEST_PLAN.md §7):
//   SET-1  theme change applies live to CodeMirror              → assert .cm-editor bg flips
//   SET-2  keymap=Vim enables modal editing (i / Esc)           → assert .cm-fat-cursor toggles
//   SET-3  font-family change applies to .cm-content            → assert computed font-family
//   SET-5  a behavior toggle takes observable effect            → preserveLastCode off ⇒ reload shows starter
//   SET-6  a settings change persists across a reload           → reopen settings, value retained
//   SET-8  "Replace new tab" control is ABSENT on web           → assert the control does not render
//
// Deferred (honest test.fixme — see each):
//   SET-4  indent-unit change (2/4/8) → auto-indent width. The Indent-size Select EXISTS
//          but is NOT wired to the editor: AppRoot passes only theme/fontSize/fontFamily/
//          keymap to <CodeEditor> (AppRoot.tsx ~1268), and nothing sets CM6's indentUnit
//          facet from settings.indentSize anywhere in web/src. The DSL block indent is
//          fixed at CM6's default 2 spaces via delimitedIndent (zenumlLanguage.ts). So
//          changing indent size has no observable effect to assert today.
//   SET-7  signed-in cloud-persist of settings — needs Firebase auth (emulator/account).
//
// suppressOneTimeModals runs in beforeEach so Onboarding/Support-pledge don't trap focus.
// The pageerror filter mirrors smoke.spec.js so the spec is usable on the live staging gate.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites (staging/prod via PW_BASE_URL) load third-party analytics/CDN
// scripts that throw uncaught errors we don't own; treat those as noise so genuine
// app errors still fail the test. (Copied verbatim from smoke.spec.js.)
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
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Editor-as-landing: bare '/' boots the editor; openEditor lands on the CM6 surface.
  await openEditor(page);
}

/** Open the Settings modal via the header overflow menu. */
async function openSettings(page) {
  await page.locator('[data-testid="header-menu"]').click();
  await page.locator('[data-testid="header-settings"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
}

/** Pick `optionLabel` from an open Radix Select trigger identified by its testid. */
async function chooseSetting(page, triggerTestId, optionLabel) {
  await page.locator(`[data-testid="${triggerTestId}"]`).click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

const dslEditor = (page) =>
  page.locator('[data-testid="dsl-editor"] .cm-editor');
const dslContent = (page) =>
  page.locator('[data-testid="dsl-editor"] .cm-content');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SET-1: Editor theme change applies LIVE to CodeMirror.
//
// The theme is swapped via a CM6 compartment reconfigure (CodeEditor.tsx
// themeCompartment), so the change must show WITHOUT a reload. Ink (the default)
// renders on the ink-950 well (#0B0E13 → rgb(11,14,19)); GitHub Light renders on a
// white surface. Assert the live computed background-color of .cm-editor flips.
// ──────────────────────────────────────────────────────────────────────────────
test('SET-1: changing the editor theme applies live to CodeMirror', async ({
  page,
}) => {
  await gotoFresh(page);
  const editor = dslEditor(page);
  await expect(editor).toBeVisible();

  const before = await editor.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  // Default ink theme: deep ink well (#0B0E13).
  expect(before).toBe('rgb(11, 14, 19)');

  await openSettings(page);
  await chooseSetting(page, 'setting-editorTheme', 'GitHub Light');
  await page.keyboard.press('Escape'); // close modal; theme already applied live
  await expect(page.locator('[data-testid="settings-modal"]')).toBeHidden();

  // The light theme repaints the editor surface white — a LIVE compartment swap,
  // no reload. Poll until the computed background actually changes.
  await expect
    .poll(async () =>
      editor.evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .not.toBe(before);
  const after = await editor.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  // GitHub Light paints a white editor surface.
  expect(after).toBe('rgb(255, 255, 255)');
});

// ──────────────────────────────────────────────────────────────────────────────
// SET-2: keymap = Vim enables Vim modal editing.
//
// CodeEditor swaps in @replit/codemirror-vim via the keymap compartment when
// keymap === 'vim'. Vim mode renders a BLOCK cursor in normal mode (the
// .cm-fat-cursor element) and a THIN caret in insert mode. So:
//   normal  → .cm-fat-cursor present
//   press i → insert mode → .cm-fat-cursor gone
//   press Esc → normal mode → .cm-fat-cursor back
// That round-trip is the observable proof that vim bindings are live (sublime
// keymap never renders a fat cursor at all).
// ──────────────────────────────────────────────────────────────────────────────
test('SET-2: keymap=Vim enables Vim bindings (i enters insert, Esc leaves)', async ({
  page,
}) => {
  await gotoFresh(page);

  // Sanity: the default (sublime) keymap has NO vim block cursor.
  await expect(dslEditor(page).locator('.cm-fat-cursor')).toHaveCount(0);

  await openSettings(page);
  await chooseSetting(page, 'setting-keymap', 'vim');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="settings-modal"]')).toBeHidden();

  // Focus the editor so vim's cursor layer renders.
  await dslContent(page).click();
  const fatCursor = dslEditor(page).locator('.cm-fat-cursor');

  // Normal mode after focus → block (fat) cursor present.
  await expect(fatCursor).toHaveCount(1);

  // 'i' enters INSERT mode → the block cursor becomes a thin caret (fat cursor gone).
  await page.keyboard.press('i');
  await expect(fatCursor).toHaveCount(0);

  // Esc returns to NORMAL mode → the block cursor comes back.
  await page.keyboard.press('Escape');
  await expect(fatCursor).toHaveCount(1);
});

// ──────────────────────────────────────────────────────────────────────────────
// SET-3: Font-family change applies to .cm-content (SET-3 "if cheap").
//
// CodeEditor applies the chosen family to .cm-content via the font compartment
// (fontTheme → '.cm-content': { fontFamily: fontStack(family) }). Changing the
// Font-family Select to Inconsolata must show up in the LIVE computed font-family
// of .cm-content (no reload). The default family is FiraCode ("Fira Code").
// ──────────────────────────────────────────────────────────────────────────────
test('SET-3: font-family change applies live to .cm-content', async ({
  page,
}) => {
  await gotoFresh(page);
  const content = dslContent(page);
  await expect(content).toBeVisible();

  const before = await content.evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  // Default FiraCode resolves to a stack beginning with "Fira Code".
  expect(before.toLowerCase()).toContain('fira code');

  await openSettings(page);
  await chooseSetting(page, 'setting-editorFont', 'Inconsolata');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="settings-modal"]')).toBeHidden();

  // Live compartment swap → .cm-content now reports the Inconsolata stack.
  await expect
    .poll(async () =>
      content.evaluate((el) => getComputedStyle(el).fontFamily.toLowerCase()),
    )
    .toContain('inconsolata');
  // And the previous family is no longer the leading face.
  const after = await content.evaluate((el) =>
    getComputedStyle(el).fontFamily.toLowerCase(),
  );
  expect(after).not.toBe(before.toLowerCase());
});

// ──────────────────────────────────────────────────────────────────────────────
// SET-4: indent-unit change → auto-indent width. DEFERRED.
//
// The Indent-size Select renders but is NOT wired to the editor: AppRoot threads
// only theme/fontSize/fontFamily/keymap into <CodeEditor> (AppRoot.tsx ~1268), and
// NOTHING in web/src sets CM6's `indentUnit` facet from settings.indentSize. The DSL
// block body indents a FIXED 2 spaces via delimitedIndent (zenumlLanguage.ts). So
// selecting indent=4 produces no observable change in the editor — there is no honest
// assertion to make today. Marked fixme rather than faked.
// ──────────────────────────────────────────────────────────────────────────────
test.fixme(
  'SET-4: indent-unit change (4) changes auto-indent width in a block',
  async ({ page }) => {
    // Wiring gap: settings.indentSize is not connected to the CM6 indentUnit facet,
    // so the editor always indents blocks by 2 spaces regardless of this setting.
    // Implement once AppRoot passes indentSize/indentWith into <CodeEditor> and the
    // editor sets indentUnit from it; then: set indent=4, type `A.run() {`, Enter,
    // assert the new line is indented 4 spaces.
    await gotoFresh(page);
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// SET-5: a behavior toggle takes observable effect.
//
// Of the plan's candidates (line-wrap / autocomplete / auto-save), the cleanest
// signed-out, FAST, genuinely-wired toggle is `preserveLastCode` — read by the boot
// resolver (useBootItem.ts branch 3). The default (ON) restores your last edit on a
// reload of '/'; turning it OFF makes boot take the 'new' branch → the default
// STARTER diagram, NOT your last edit. We prove the toggle's effect by the
// observable divergence at reload:
//   toggle OFF → type a unique token → trigger the last-code write → reload '/'
//   ⇒ editor shows the starter ("Alice -> Bob: Hello"), NOT the unique token.
// (persistence.spec.js test 1 proves the inverse: with it ON, the edit IS restored.)
// ──────────────────────────────────────────────────────────────────────────────
test('SET-5: behavior toggle (preserve-last-code off) changes reload behavior', async ({
  page,
}) => {
  await gotoFresh(page);

  // Turn preserve-last-code OFF.
  await openSettings(page);
  const toggle = page.locator('[data-testid="setting-preserveLastCode"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'true'); // default ON
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="settings-modal"]')).toBeHidden();

  // Type a distinctive DSL so a stale restore (if it wrongly happened) would be obvious.
  const UNIQUE = 'PreserveOffProbe';
  const content = dslContent(page);
  await content.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await content.pressSequentially(`${UNIQUE}\nUser\nUser->${UNIQUE}: edit`);
  await expect(content).toContainText(UNIQUE);

  // AppRoot writes the last-code slot on visibilitychange (document.hidden → true).
  // Fire it so that IF the slot were read on boot, our token would come back — proving
  // the assertion below tests the SETTING, not merely an unwritten slot.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Reload bare '/': preserveLastCode is OFF → boot resolves 'new' → starter DSL.
  await page.reload();
  await expect(content).toBeVisible({ timeout: 15_000 });

  // The starter is restored; our unique token is NOT — the toggle changed boot behavior.
  await expect(content).toContainText('Alice -> Bob: Hello', {
    timeout: 15_000,
  });
  await expect(content).not.toContainText(UNIQUE);
});

// ──────────────────────────────────────────────────────────────────────────────
// SET-6: a settings change persists across a page reload.
//
// settingsStore persists to the local syncStore; the editorTheme must survive a full
// reload. Change the theme to Dracula, reload, reopen Settings → the Theme trigger
// still reads "Dracula" (the persisted value rehydrated, not the Ink default). We also
// assert the LIVE editor surface reflects the persisted theme after reload (the
// Dracula well is not the Ink well), so this guards both the stored value AND its
// re-application — not just the control label.
// ──────────────────────────────────────────────────────────────────────────────
test('SET-6: a settings change persists across a page reload', async ({
  page,
}) => {
  await gotoFresh(page);

  await openSettings(page);
  await chooseSetting(page, 'setting-editorTheme', 'Dracula');
  const trigger = page.locator('[data-testid="setting-editorTheme"]');
  await expect(trigger).toContainText('Dracula');
  await page.keyboard.press('Escape');

  // Capture the live Dracula editor background BEFORE reload (it is neither the Ink
  // #0B0E13 well nor white) so we can confirm it is re-applied after reload too.
  const editor = dslEditor(page);
  await expect
    .poll(async () =>
      editor.evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .not.toBe('rgb(11, 14, 19)');
  const draculaBg = await editor.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(draculaBg).not.toBe('rgb(11, 14, 19)'); // not the Ink default

  // Full reload — the settingsStore must rehydrate editorTheme from the local store.
  await page.reload();
  await expect(dslContent(page)).toBeVisible({ timeout: 15_000 });

  // The persisted theme is re-applied to the live editor surface (not the Ink default).
  await expect
    .poll(async () =>
      editor.evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe(draculaBg);

  // And the Settings control reflects the retained value.
  await openSettings(page);
  await expect(
    page.locator('[data-testid="setting-editorTheme"]'),
  ).toContainText('Dracula');
});

// ──────────────────────────────────────────────────────────────────────────────
// SET-7: signed-in cloud-persist of settings. DEFERRED (needs Firebase auth).
// ──────────────────────────────────────────────────────────────────────────────
test.fixme(
  'SET-7: settings persist to the cloud and survive a fresh signed-in session',
  async () => {
    // Requires a signed-in Firebase session (auth emulator or seeded account) to
    // exercise the cloud settings round-trip — unavailable in the signed-out
    // staging gate. Implement under the planned *.cloud.spec.js emulator project.
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// SET-8: the "Replace new tab" control is ABSENT on web (extension-only).
//
// SettingsModal gates the whole Extension section (and its setting-replaceNewTab
// switch) behind `isExtension`. On the web app that flag is false, so the control
// must NOT render. Assert its absence while the modal is open AND verify the modal
// IS open (so a zero count means "absent", not "modal failed to render").
// ──────────────────────────────────────────────────────────────────────────────
test('SET-8: the "Replace new tab" control is absent on web (extension-only)', async ({
  page,
}) => {
  await gotoFresh(page);
  await openSettings(page);

  // The modal is open and populated (a sibling control renders) …
  await expect(
    page.locator('[data-testid="setting-editorTheme"]'),
  ).toBeVisible();
  // … but the extension-only "Replace new tab page" toggle is NOT present on web.
  await expect(
    page.locator('[data-testid="setting-replaceNewTab"]'),
  ).toHaveCount(0);
  // The whole Extension section heading is likewise absent.
  await expect(page.getByText('Replace new tab page')).toHaveCount(0);
});
