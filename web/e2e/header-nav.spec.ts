// Approved header/navigation refinement (Figma Light 32:4370, Dark 32:4188; account
// board 36:8974; exports editor-header-final-{light,dark,account}.png). At 1440x960:
// - New (plus icon + "New") is the one primary toolbar button: x874, y10, 90x36,
//   12px before Fork (x976). It opens a blank diagram, guarded against data loss.
// - Present is a secondary outline button like Fork / Share / Sign in.
// - The logo is a plain mark: no app dropdown, no arrow.
// - Help sits in the code-column footer between Custom CSS and Report a bug.
// - Signed out, Pricing is a small link inside the sign-in dialog. (The signed-in
//   account-menu Pricing is covered by the root cloud project, which can sign in.)

import { test, expect, type Page } from '@playwright/test';
import { seedAndOpen, clearEditor, editorContent, getEditorText } from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await seedAndOpen(page);
});

async function setAppearance(page: Page, appearance: 'light' | 'dark'): Promise<void> {
  const html = page.locator('html');
  if ((await html.getAttribute('data-appearance')) !== appearance) {
    await page.getByTestId('header-appearance').click();
  }
  await expect(html).toHaveAttribute('data-appearance', appearance);
}

const styleOf = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => {
    const c = getComputedStyle(el);
    return { bg: c.backgroundColor, fg: c.color, border: c.borderTopColor, borderWidth: c.borderTopWidth, height: c.height };
  });

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance}: New is the one primary button at x874 (90x36), 12px before Fork`, async ({ page }) => {
    await setAppearance(page, appearance);
    const newBtn = page.getByTestId('header-new');
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toHaveText('New');
    await expect(newBtn.locator('svg')).toBeVisible();
    const box = (await newBtn.boundingBox())!;
    expect(box).toEqual({ x: 874, y: 10, width: 90, height: 36 });
    const fork = (await page.getByTestId('header-fork').boundingBox())!;
    expect(fork.x).toBe(976);
    expect(fork.x - (box.x + box.width)).toBe(12);
    // The plus and label are drawn inside the blue fill, in the on-primary colour.
    const s = await styleOf(page, 'header-new');
    expect(s.bg).toBe('rgb(33, 123, 179)');
    expect(s.fg).toBe('rgb(255, 255, 255)');
    const inner = await newBtn.evaluate((el) => {
      const icon = el.querySelector('svg')!.getBoundingClientRect();
      const label = el.querySelector('.editor-button-label')!.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      return { iconInside: icon.left >= b.left && icon.right <= label.left && icon.top >= b.top && icon.bottom <= b.bottom, labelInside: label.right <= b.right };
    });
    expect(inner).toEqual({ iconInside: true, labelInside: true });
    // Exactly one primary action in the header.
    await expect(page.locator('header .editor-button--primary')).toHaveCount(1);
  });

  test(`${appearance}: Present is a secondary outline button matching Fork`, async ({ page }) => {
    await setAppearance(page, appearance);
    const present = page.getByTestId('header-present');
    await expect(present).toHaveText('Present');
    // Colours transition over 150ms (appearance switch, hover): let them settle.
    const settle = () => page.waitForTimeout(300);
    await settle();
    const fork = await styleOf(page, 'header-fork');
    expect(await styleOf(page, 'header-present')).toEqual(fork);
    // Hover matches Fork's hover; keyboard focus shows a visible outline.
    await page.getByTestId('header-fork').hover();
    await settle();
    const forkHover = (await styleOf(page, 'header-fork')).bg;
    expect(forkHover).not.toBe(fork.bg);
    await present.hover();
    await settle();
    expect((await styleOf(page, 'header-present')).bg).toBe(forkHover);
    await page.mouse.move(700, 500);
    // Keyboard focus: Shift+Tab from the appearance toggle lands on Present.
    await page.getByTestId('header-appearance').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(present).toBeFocused();
    const outline = await present.evaluate((el) => {
      const c = getComputedStyle(el);
      return { matches: el.matches(':focus-visible'), style: c.outlineStyle, width: c.outlineWidth };
    });
    expect(outline.matches).toBe(true);
    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });

  test(`${appearance}: the logo opens no menu and shows no arrow`, async ({ page }) => {
    await setAppearance(page, appearance);
    const logo = page.getByTestId('header-logo');
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((el) => el.closest('button, a, [role="button"]'))).toBeNull();
    await expect(logo.locator('svg')).toHaveCount(1);
    await expect(page.getByTestId('header-menu')).toHaveCount(0);
    await logo.click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    const logoBox = (await logo.boundingBox())!;
    expect(logoBox).toMatchObject({ x: 24, width: 26 });
    expect((await page.getByTestId('header-toggle-editor').boundingBox())!.x).toBe(92);
  });

  test(`${appearance}: footer Help sits between Custom CSS and Report a bug and opens Help`, async ({ page }) => {
    await setAppearance(page, appearance);
    const footer = page.locator('.editor-css-panel-strip');
    const toggle = (await footer.getByTestId('css-panel-strip').boundingBox())!;
    const help = (await footer.getByTestId('footer-help').boundingBox())!;
    const bug = (await footer.getByTestId('report-bug-fab').boundingBox())!;
    expect(help.x).toBeGreaterThanOrEqual(toggle.x + toggle.width);
    expect(help.x + help.width).toBeLessThanOrEqual(bug.x);
    expect(help.y).toBe(bug.y);
    const color = await footer.getByTestId('footer-help').evaluate((el) => getComputedStyle(el).color);
    const bugColor = await footer.getByTestId('report-bug-fab').evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe(bugColor);
    await footer.getByTestId('footer-help').click();
    const dialog = page.getByTestId('help-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link').first()).toHaveAttribute('href', /^https:\/\//);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}

test('expanded Custom CSS: toggle, controls, Help and Report a bug stay on one 44px row', async ({ page }) => {
  await page.getByTestId('css-panel-strip').click();
  const header = page.locator('.editor-css-panel-header');
  await expect(header).toBeVisible();
  const g = await header.evaluate((el) => {
    const r = (s: string) => el.querySelector(s)!.getBoundingClientRect();
    return {
      height: el.getBoundingClientRect().height,
      right: el.getBoundingClientRect().right,
      toggle: r('[data-testid="css-panel-collapse"]'),
      controls: r('.editor-css-panel-controls'),
      help: r('[data-testid="footer-help"]'),
      bug: r('.editor-report-bug'),
    };
  });
  expect(g.height).toBe(44);
  expect(new Set([g.toggle.top, g.controls.top, g.help.top, g.bug.top]).size).toBe(1);
  expect(g.controls.left).toBeGreaterThanOrEqual(g.toggle.right);
  expect(g.help.left).toBeGreaterThanOrEqual(g.controls.right);
  expect(g.bug.left).toBeGreaterThanOrEqual(g.help.right);
  expect(g.bug.right).toBeLessThanOrEqual(g.right);
  await expect(page.getByTestId('report-bug-fab')).toHaveAccessibleName('Report a bug');
});

test('New on a saved diagram opens a blank one; the previous diagram is kept', async ({ page }) => {
  await clearEditor(page);
  await page.keyboard.insertText('Keep->Me: original');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.getByTestId('header-savestate')).toHaveAttribute('data-state', 'local');
  const oldId = new URL(page.url()).searchParams.get('id');

  await page.getByTestId('header-new').click();
  await expect(page.getByTestId('confirm-ok')).toHaveCount(0); // clean: no prompt
  await expect.poll(() => new URL(page.url()).searchParams.get('id')).not.toBe(oldId);
  await expect(page.getByTestId('header-title')).toHaveValue('Untitled');
  expect((await getEditorText(page)).trim()).toBe('');

  // The previous diagram is still stored: the Diagrams hub lists it.
  await page.getByTestId('header-go-home').click();
  await expect(page.getByTestId('home-view')).toContainText('Keep->Me: original');
});

// Independent acceptance regression: New from a ?code=&title= import, then reload.
// The blank diagram was never saved (nothing to save), so it lives only in the
// last-code slot. Reload must keep that blank diagram and its id, not swap in the
// default Alice/Bob sample under a different id.
test('New from an inline ?code= import stays blank, with the same id, after reload', async ({ page }) => {
  // The built app exposes no store hook. Read the in-memory item through the app's
  // own unload persistence: `beforeunload` writes the current item to the local
  // last-code slot (`code`) synchronously.
  const storeState = () => page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload'));
    const it = JSON.parse(localStorage.getItem('code') ?? 'null');
    return it && { id: it.id, title: it.title, js: it.js, css: it.css };
  });
  await page.goto('/?code=Alice-%3EBob%3A%20Inline&title=Imported');
  await expect(editorContent(page)).toContainText('Inline');
  await page.getByTestId('header-new').click();
  if (await page.getByTestId('confirm-ok').isVisible()) await page.getByTestId('confirm-ok').click();
  await expect.poll(async () => (await getEditorText(page)).trim()).toBe('');
  const url = new URL(page.url());
  expect(url.searchParams.has('code')).toBe(false);
  expect(url.searchParams.has('title')).toBe(false);
  const before = await storeState();
  expect(before).toEqual({ id: url.searchParams.get('id'), title: 'Untitled', js: '', css: '' });
  await expect(page.getByTestId('header-savestate')).toHaveAttribute('data-state', 'local-new');

  // Clear the slot the helper just wrote: the reload's own unload persistence must
  // write it, as in the real journey.
  await page.evaluate(() => localStorage.removeItem('code'));
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(editorContent(page)).toBeVisible();
  await expect(page.getByTestId('header-title')).toHaveValue('Untitled');
  await expect.poll(async () => (await getEditorText(page)).trim()).toBe('');
  expect(new URL(page.url()).searchParams.get('id')).toBe(before.id);
  expect(await storeState()).toEqual(before);
  // Truthful anonymous save state: still an unsaved local draft; nothing was saved
  // under its id to make the reload work.
  await expect(page.getByTestId('header-savestate')).toHaveAttribute('data-state', 'local-new');
  expect(await page.evaluate((id) => localStorage.getItem(id), before.id)).toBeNull();
});

test('New with unsaved edits asks first; Keep editing keeps them, Discard starts blank', async ({ page }) => {
  await clearEditor(page);
  await page.keyboard.insertText('Draft->Edit: unsaved');
  await page.getByTestId('header-new').click();
  await expect(page.getByRole('dialog')).toContainText('Discard unsaved changes?');
  await page.getByTestId('confirm-cancel').click();
  expect(await getEditorText(page)).toContain('Draft->Edit: unsaved');

  await page.getByTestId('header-new').click();
  await page.getByTestId('confirm-ok').click();
  await expect.poll(async () => (await getEditorText(page)).trim()).toBe('');
  await editorContent(page).click();
  await page.keyboard.insertText('A->B: fresh');
  await expect.poll(() => getEditorText(page)).toContain('A->B: fresh');
});

test('Present still enters and leaves the full-screen preview', async ({ page }) => {
  await page.getByTestId('header-present').click();
  const panel = page.locator('.editor-preview-panel--fullscreen');
  await expect(panel).toBeVisible();
  expect(await panel.boundingBox()).toEqual({ x: 0, y: 0, width: 1440, height: 960 });
  await page.getByTestId('preview-fullscreen').click(); // Exit
  await expect(page.locator('.editor-preview-panel--fullscreen')).toHaveCount(0);
  await expect(page.getByTestId('header-present')).toBeVisible();
});

test('signed out: Sign in stays; its dialog has a Pricing link that opens the plans', async ({ page }) => {
  await expect(page.getByTestId('header-login')).toBeVisible();
  await expect(page.getByTestId('header-pricing-link')).toHaveCount(0);
  await page.getByTestId('header-login').click();
  await expect(page.getByTestId('login-google')).toBeVisible();
  await page.getByTestId('login-pricing').click();
  await expect(page.getByTestId('pricing-modal')).toBeVisible();
  await expect(page.getByTestId('login-google')).toHaveCount(0);
});

test('removed menu entries leave the keyboard-shortcuts shortcut working', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+Shift+/');
  await expect(page.getByRole('dialog')).toContainText(/keyboard shortcuts/i);
});

test('narrow 900px: header fits on one row; New stays a named primary icon button', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const header = page.locator('header').first();
  expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const newBtn = page.getByTestId('header-new');
  await expect(newBtn).toBeVisible();
  await expect(newBtn).toHaveAccessibleName('New');
  const b = (await newBtn.boundingBox())!;
  expect(b).toMatchObject({ width: 36, height: 36 });
  const fork = (await page.getByTestId('header-fork').boundingBox())!;
  expect(fork.x - (b.x + b.width)).toBe(12);
  // Footer: toggle, Help and Report a bug neither clip nor overlap.
  const f = await page.locator('.editor-css-panel-strip').evaluate((el) => {
    const r = (s: string) => el.querySelector(s)!.getBoundingClientRect();
    const strip = el.getBoundingClientRect();
    return { strip: strip.right, toggle: r('[data-testid="css-panel-strip"]').right, helpL: r('[data-testid="footer-help"]').left, helpR: r('[data-testid="footer-help"]').right, bugL: r('.editor-report-bug').left, bugR: r('.editor-report-bug').right };
  });
  expect(f.helpL).toBeGreaterThanOrEqual(f.toggle);
  expect(f.bugL).toBeGreaterThanOrEqual(f.helpR);
  expect(f.bugR).toBeLessThanOrEqual(f.strip);
  await page.getByTestId('footer-help').click();
  await expect(page.getByTestId('help-modal')).toBeVisible();
});
