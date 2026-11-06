import { test, expect, type Page, type Locator } from '@playwright/test';
import { editorContent, clearEditor } from './helpers/editor';

// Same onboarding flags as helpers/editor.ts seedAndOpen, but waits for the
// editor instead of `networkidle` (the dev server keeps sockets open).
async function seedAndOpen(page: Page) {
  await page.addInitScript(() => {
    for (const [k, v] of Object.entries({
      lastSeenVersion: '"9999.0.0"',
      pledgeModalSeen: 'true',
      loginAndsaveMessageSeen: 'true',
    })) localStorage.setItem(k, v);
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await editorContent(page).waitFor({ timeout: 30000 });
}

// Inline Code appearance bar (theme + font size) — real-browser checks.
// Local fixtures only: every cloud-function / analytics request is stubbed, the
// user stays signed out, and documents live in this browser profile only.
//
// Screenshots go to $APPEARANCE_SHOTS (default test-results/code-appearance).
const SHOTS = process.env.APPEARANCE_SHOTS ?? 'test-results/code-appearance';

async function stubNetwork(page: Page) {
  await page.route(/\/(track|create-share|get-shared-item|sync-diagram|authenticate|info)(\?|$)/, (r) =>
    r.fulfill({ status: 204, body: '' }),
  );
  await page.route(/mixpanel|google-analytics|googletagmanager|sentry/, (r) => r.abort());
}

const bar = (page: Page) => page.getByTestId('code-appearance-bar');
const dslCm = (page: Page) => page.getByTestId('dsl-editor').locator('.cm-editor');
const cssCm = (page: Page) => page.getByTestId('css-editor').locator('.cm-editor');
const previewPanel = (page: Page) => page.locator('.editor-preview-panel').first();

async function cssOf(loc: Locator, prop: string) {
  return loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}

async function rect(loc: Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error('no bounding box');
  return b;
}

// Move the pointer just above the bar's (possibly hidden) slot at the bottom of
// the left workspace — the reveal band.
async function hoverNearBottom(page: Page) {
  const b = await rect(bar(page));
  await page.mouse.move(b.x + b.width / 2, b.y - 10);
  await expect(bar(page)).toHaveAttribute('data-state', 'visible');
  await page.waitForTimeout(200); // let the 120ms reveal transition settle
}

// Left edge of the first DSL line's text, and the right edge of the line-number lane.
async function codeEdges(page: Page) {
  return page.getByTestId('dsl-editor').evaluate((root) => {
    const line = root.querySelector('.cm-line') as HTMLElement;
    const lr = line.getBoundingClientRect();
    return {
      textLeft: lr.left + parseFloat(getComputedStyle(line).paddingLeft),
      gutterRight: (root.querySelector('.cm-gutters') as HTMLElement).getBoundingClientRect().right,
    };
  });
}

async function moveAway(page: Page) {
  const area = await rect(page.locator('.editor-source-stack'));
  await page.mouse.move(area.x + area.width / 2, area.y + 40);
}

async function chooseTheme(page: Page, id: string) {
  await hoverNearBottom(page);
  await page.getByTestId('code-theme-select').click();
  await page.getByTestId(`code-theme-option-${id}`).click();
}

async function setAppearance(page: Page, appearance: 'light' | 'dark') {
  const html = page.locator('html');
  if ((await html.getAttribute('data-appearance')) === appearance) return;
  if (appearance === 'light' && (await html.getAttribute('data-appearance')) === null) return;
  await page.getByTestId('header-appearance').click();
  if (appearance === 'dark') await expect(html).toHaveAttribute('data-appearance', 'dark');
  else await expect(html).not.toHaveAttribute('data-appearance', 'dark');
}

async function expandCss(page: Page) {
  const strip = page.getByTestId('css-panel-strip');
  if (await strip.isVisible().catch(() => false)) await strip.click();
  await expect(page.getByTestId('css-panel-expanded')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await stubNetwork(page);
});

test.describe('desktop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('hover reveal, overlay placement, no preview resize, hide after leave', async ({ page }) => {
    await seedAndOpen(page);
    await moveAway(page);
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden');
    expect(await cssOf(bar(page), 'opacity')).toBe('0');
    expect(await cssOf(bar(page), 'pointer-events')).toBe('none');

    const previewBefore = await rect(previewPanel(page));
    const dslBefore = await rect(dslCm(page));

    await hoverNearBottom(page);
    await page.screenshot({ path: `${SHOTS}/desktop-light-revealed.png` });
    await bar(page).screenshot({ path: `${SHOTS}/desktop-light-bar.png` });

    // Overlay: the code area and preview keep their size.
    expect(await rect(previewPanel(page))).toEqual(previewBefore);
    expect(await rect(dslCm(page))).toEqual(dslBefore);

    // Anchored at the bottom of the left workspace, 12px above the Custom CSS row,
    // from the code text's left edge (never over the line-number lane) to the
    // code column's right edge.
    const b = await rect(bar(page));
    const strip = await rect(page.locator('.editor-css-panel-strip'));
    expect(strip.y - (b.y + b.height)).toBe(12);
    expect(b.height).toBe(36);
    const edges = await codeEdges(page);
    expect(b.x).toBeGreaterThan(edges.gutterRight);
    expect(Math.abs(b.x - edges.textLeft)).toBeLessThanOrEqual(1);
    const stack = await rect(page.locator('.editor-source-stack'));
    expect(Math.abs(b.x + b.width - (stack.x + stack.width))).toBeLessThanOrEqual(0.5);

    // Custom CSS and Report a bug remain visible.
    await expect(page.getByTestId('css-panel-strip')).toBeVisible();
    await expect(page.getByRole('button', { name: /report a bug/i })).toBeVisible();

    // Pointer over the bar keeps it; leaving hides it after a short delay.
    await bar(page).hover();
    await page.waitForTimeout(800);
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    await moveAway(page);
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden', { timeout: 2000 });
  });

  test('theme dropdown stays open, explicit theme vs Follow app across appearance', async ({ page }) => {
    await seedAndOpen(page);
    await setAppearance(page, 'light');
    // Start from Follow app (ink) regardless of leftovers.
    await chooseTheme(page, 'ink');
    await moveAway(page);
    // Focus returned to the trigger by a pointer selection does not pin the bar.
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden', { timeout: 2000 });
    const inkLight = await cssOf(dslCm(page), 'background-color');

    // Menu open keeps the bar visible even with the pointer elsewhere.
    await hoverNearBottom(page);
    await page.getByTestId('code-theme-select').click();
    await expect(page.getByTestId('code-theme-menu')).toBeVisible();
    await page.waitForTimeout(250); // pop-in animation
    await page.screenshot({ path: `${SHOTS}/desktop-light-menu.png` });
    await page.waitForTimeout(800);
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    await page.getByTestId('code-theme-option-dracula').click();
    await expect(page.getByTestId('code-theme-select')).toContainText('Dracula');
    const dracula = await cssOf(dslCm(page), 'background-color');
    expect(dracula).not.toBe(inkLight);

    // Explicit theme is independent of the app appearance.
    await setAppearance(page, 'dark');
    expect(await cssOf(dslCm(page), 'background-color')).toBe(dracula);
    await setAppearance(page, 'light');
    expect(await cssOf(dslCm(page), 'background-color')).toBe(dracula);

    // Follow app restores following.
    await chooseTheme(page, 'ink');
    await expect(page.getByTestId('code-theme-select')).toContainText('Follow app');
    expect(await cssOf(dslCm(page), 'background-color')).toBe(inkLight);
    await setAppearance(page, 'dark');
    const inkDark = await cssOf(dslCm(page), 'background-color');
    expect(inkDark).not.toBe(inkLight);
    await hoverNearBottom(page);
    await page.screenshot({ path: `${SHOTS}/desktop-dark-revealed.png` });
    await bar(page).screenshot({ path: `${SHOTS}/desktop-dark-bar.png` });
    await page.getByTestId('code-theme-select').click();
    await expect(page.getByTestId('code-theme-menu')).toBeVisible();
    await page.waitForTimeout(250); // pop-in animation
    await page.screenshot({ path: `${SHOTS}/desktop-dark-menu.png` });
    await page.keyboard.press('Escape');
    await setAppearance(page, 'light');
    expect(await cssOf(dslCm(page), 'background-color')).toBe(inkLight);
  });

  test('+/- updates DSL and CSS font, expanded CSS keeps its space, reload persists', async ({ page }) => {
    await seedAndOpen(page);
    await setAppearance(page, 'light');
    await chooseTheme(page, 'monokai');
    await expandCss(page);

    // Normalise to 16 through the control itself.
    await hoverNearBottom(page);
    const value = page.getByTestId('code-font-size-value');
    for (let i = 0; i < 6; i++) {
      const n = Number(await value.textContent());
      if (n === 16) break;
      await page.getByTestId(n > 16 ? 'code-font-decrease' : 'code-font-increase').click();
    }
    await expect(value).toHaveText('16');
    expect(await cssOf(dslCm(page), 'font-size')).toBe('16px');
    expect(await cssOf(cssCm(page), 'font-size')).toBe('16px');

    const previewBefore = await rect(previewPanel(page));

    await page.getByTestId('code-font-increase').click();
    await expect(value).toHaveText('17');
    expect(await cssOf(dslCm(page), 'font-size')).toBe('17px');
    expect(await cssOf(cssCm(page), 'font-size')).toBe('17px');

    expect(await rect(previewPanel(page))).toEqual(previewBefore);
    // Revealing/hiding the overlay leaves the expanded CSS panel's space unchanged.
    const cssPanelShown = await rect(page.getByTestId('css-panel-expanded'));
    const dslShown = await rect(dslCm(page));
    await moveAway(page);
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden', { timeout: 2000 });
    expect(await rect(page.getByTestId('css-panel-expanded'))).toEqual(cssPanelShown);
    expect(await rect(dslCm(page))).toEqual(dslShown);
    await hoverNearBottom(page);
    await page.screenshot({ path: `${SHOTS}/desktop-light-css-expanded.png` });

    // Limits.
    await page.getByTestId('code-font-increase').click();
    await expect(value).toHaveText('18');
    await expect(page.getByTestId('code-font-increase')).toBeDisabled();
    for (let i = 0; i < 6; i++) await page.getByTestId('code-font-decrease').click();
    await expect(value).toHaveText('12');
    await expect(page.getByTestId('code-font-decrease')).toBeDisabled();
    expect(await cssOf(dslCm(page), 'font-size')).toBe('12px');
    expect(await cssOf(cssCm(page), 'font-size')).toBe('12px');
    await page.getByTestId('code-font-increase').click();
    await expect(value).toHaveText('13');
    const monokaiBg = await cssOf(dslCm(page), 'background-color');

    // Reload: theme + size come back from the settings store.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await editorContent(page).waitFor();
    await expect(page.getByTestId('code-font-size-value')).toHaveText('13');
    await expect(page.getByTestId('code-theme-select')).toContainText('Monokai');
    expect(await cssOf(dslCm(page), 'font-size')).toBe('13px');
    expect(await cssOf(dslCm(page), 'background-color')).toBe(monokaiBg);
    await expandCss(page);
    expect(await cssOf(cssCm(page), 'font-size')).toBe('13px');

    // Restore defaults for later scenarios.
    await chooseTheme(page, 'ink');
    await hoverNearBottom(page);
    for (let i = 0; i < 3; i++) await page.getByTestId('code-font-increase').click();
    await expect(page.getByTestId('code-font-size-value')).toHaveText('16');
  });

  test('placement matches the approved slot and stays put when Custom CSS expands', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await seedAndOpen(page);
    await hoverNearBottom(page);
    const collapsed = await rect(bar(page));
    // Approved desktop slot (reference 1440x960): y856, height 36.
    expect(collapsed.y).toBe(856);
    expect(collapsed.height).toBe(36);
    const edges = await codeEdges(page);
    expect(collapsed.x).toBeGreaterThan(edges.gutterRight);
    expect(Math.abs(collapsed.x - edges.textLeft)).toBeLessThanOrEqual(1);
    // Nothing of the line-number lane is under the bar.
    const lane = await page.getByTestId('dsl-editor').locator('.cm-gutters').boundingBox();
    expect(lane!.x + lane!.width).toBeLessThan(collapsed.x);

    await expandCss(page);
    await hoverNearBottom(page);
    expect(await rect(bar(page))).toEqual(collapsed);
    await page.screenshot({ path: `${SHOTS}/desktop960-light-css-expanded.png` });
  });

  for (const appearance of ['light', 'dark'] as const) {
    test(`reference comparison 1440x960, stored size 15 (${appearance})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.addInitScript(() => localStorage.setItem('fontSize', '15'));
      await seedAndOpen(page);
      await setAppearance(page, appearance);
      await hoverNearBottom(page);
      await expect(page.getByTestId('code-font-size-value')).toHaveText('15');
      expect(await cssOf(dslCm(page), 'font-size')).toBe('15px');
      const b = await rect(bar(page));
      expect(b.y).toBe(856);
      expect(b.height).toBe(36);
      await page.screenshot({ path: `${SHOTS}/compare-960-${appearance}.png` });
    });
  }

  test('short documents get no extra scroll strip under an explicit theme', async ({ page }) => {
    await seedAndOpen(page);
    await chooseTheme(page, 'monokai');
    await expandCss(page);
    for (const cm of [dslCm(page), cssCm(page)]) {
      const pad = await cm.locator('.cm-content').evaluate((el) => {
        const cs = getComputedStyle(el);
        return [cs.paddingTop, cs.paddingBottom];
      });
      expect(pad[1]).toBe(pad[0]);
    }
  });

  test('the last CSS line can be scrolled above the bar and clicked when CSS is expanded', async ({ page }) => {
    await seedAndOpen(page);
    await expandCss(page);
    const css = page.getByTestId('css-editor').locator('.cm-content');
    await css.click();
    const lines = Array.from({ length: 40 }, (_, i) => `.p${i + 1} { color: red; }`);
    await page.keyboard.insertText(lines.join('\n'));
    await page.waitForTimeout(300);
    await page.getByTestId('css-editor').evaluate((root) => {
      let el: HTMLElement | null = root as HTMLElement;
      const all = [root, ...root.querySelectorAll<HTMLElement>('.cm-scroller')] as HTMLElement[];
      while (el && !el.classList.contains('editor-css-panel')) { all.push(el); el = el.parentElement; }
      for (const e of all) e.scrollTop = e.scrollHeight;
    });
    await page.waitForTimeout(200);
    const last = page.getByTestId('css-editor').locator('.cm-line', { hasText: '.p40 ' });
    const l = await rect(last);
    await page.mouse.move(l.x + 40, l.y + l.height / 2);
    await page.waitForTimeout(500);
    const b = await rect(bar(page));
    if ((await bar(page).getAttribute('data-state')) === 'visible') {
      expect(l.y + l.height).toBeLessThanOrEqual(b.y);
    }
    await page.mouse.click(l.x + 40, l.y + l.height / 2);
    await page.keyboard.press('End');
    await page.keyboard.press('Escape'); // close any completion popup
    await page.keyboard.type('X');
    await expect(last).toHaveText('.p40 { color: red; }X');
  });

  test('theme/font changes keep text, selection, focus and undo', async ({ page }) => {
    await seedAndOpen(page);
    await clearEditor(page);
    await page.keyboard.type('A->B: one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('B->A: two');
    // Select "two" (last 3 characters).
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    const before = await editorContent(page).innerText();

    await hoverNearBottom(page);
    await page.getByTestId('code-font-increase').click();
    await page.getByTestId('code-font-decrease').click();

    // The editor kept focus and selection: typing replaces "two".
    await expect(editorContent(page)).toBeFocused();
    expect(await editorContent(page).innerText()).toBe(before);
    await page.keyboard.type('2');
    await expect(editorContent(page)).toContainText('B->A: 2');

    // Theme change does not remount or edit the document; undo still works.
    await chooseTheme(page, 'github-light');
    await chooseTheme(page, 'ink');
    await expect(editorContent(page)).toContainText('B->A: 2');
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(editorContent(page)).toContainText('B->A: two');
  });

  test('theme/font changes keep DSL diagnostics', async ({ page }) => {
    await seedAndOpen(page);
    await clearEditor(page);
    await page.keyboard.type('A->B: hi\nif(x) {\n');
    await page.keyboard.type('}}}');
    const errors = page.getByTestId('dsl-editor').locator('.cm-lintRange-error');
    await expect(errors).toHaveCount(1, { timeout: 10000 });
    await hoverNearBottom(page);
    await page.getByTestId('code-font-increase').click();
    await chooseTheme(page, 'dracula');
    await expect(errors).toHaveCount(1);
    await expect(page.getByTestId('dsl-editor').locator('.cm-lint-marker-error')).toHaveCount(1);
  });

  test('code tooltips that extend over the preview are not clipped by the code column', async ({ page }) => {
    await seedAndOpen(page);
    await clearEditor(page);
    await page.keyboard.type('Alice->Bob: hi\nBob->Alice: x\n' + ' '.repeat(18) + 'Al');
    await page.keyboard.press('Control+Space');
    const tip = page.locator('.cm-tooltip-autocomplete');
    await expect(tip).toBeVisible();
    const t = await rect(tip);
    const preview = await rect(previewPanel(page));
    expect(t.x + t.width).toBeGreaterThan(preview.x); // the tooltip does reach over the preview
    const onTop = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cm-tooltip'), [
      t.x + t.width - 6,
      t.y + 8,
    ]);
    expect(onTop).toBe(true);
  });

  test('the last line of a long document can be scrolled above the bar and clicked', async ({ page }) => {
    await seedAndOpen(page);
    await clearEditor(page);
    const lines = Array.from({ length: 60 }, (_, i) => `A->B: line${i + 1}`);
    await page.keyboard.insertText(lines.join('\n'));
    // Scroll to the end in whichever container scrolls. In the BASE snapshot the
    // DSL .cm-editor grows past its overflow-hidden wrapper (no wheel scrolling,
    // see report); after a core fix .cm-scroller scrolls instead.
    await page.getByTestId('dsl-editor').evaluate((root) => {
      for (const el of [root, ...root.querySelectorAll<HTMLElement>('.cm-scroller')]) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(150);
    const last = page.getByTestId('dsl-editor').locator('.cm-line', { hasText: 'line60' });
    const l = await rect(last);
    // Move onto the last line and wait: the bar may reveal, but must not cover it.
    await page.mouse.move(l.x + 40, l.y + l.height / 2);
    await page.waitForTimeout(500);
    const b = await rect(bar(page));
    if ((await bar(page).getAttribute('data-state')) === 'visible') {
      expect(l.y + l.height).toBeLessThanOrEqual(b.y);
    }
    await page.mouse.click(l.x + 40, l.y + l.height / 2);
    await page.keyboard.press('End');
    await page.keyboard.type('X');
    await expect(last).toHaveText('A->B: line60X');
  });

  test('keyboard: focus reveals, controls are in tab order, leaving hides', async ({ page }) => {
    await seedAndOpen(page);
    await moveAway(page);
    await editorContent(page).click();
    await moveAway(page);
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden', { timeout: 2000 });

    // CodeMirror convention: Escape releases Tab from indentation.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('code-theme-select')).toBeFocused();
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    await page.screenshot({ path: `${SHOTS}/desktop-light-keyboard-focus.png` });

    const value = page.getByTestId('code-font-size-value');
    const start = Number(await value.textContent());
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('code-font-decrease')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('code-font-increase')).toBeFocused();
    expect(start).toBe(16); // fresh browser context → default size
    await page.keyboard.press('Enter');
    await expect(value).toHaveText('17');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Space');
    await expect(value).toHaveText('16');
    // Keyboard theme selection (focus is on decrease after Shift+Tab above).
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('code-theme-select')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('code-theme-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('code-theme-menu')).toBeHidden();
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');

    // Tab past the bar → hidden again.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden', { timeout: 2000 });
  });
});

test.describe('narrow 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const appearance of ['light', 'dark'] as const) {
    test(`hover reveal fits without overflow (${appearance})`, async ({ page }) => {
      await seedAndOpen(page);
      await setAppearance(page, appearance);
      await hoverNearBottom(page);
      const b = await rect(bar(page));
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
      for (const id of ['code-theme-select', 'code-font-decrease', 'code-font-size-value', 'code-font-increase']) {
        const r = await rect(page.getByTestId(id));
        expect(r.x).toBeGreaterThanOrEqual(b.x);
        expect(r.x + r.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
      }
      const overflow = await bar(page).evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `${SHOTS}/narrow-${appearance}-revealed.png` });
      await expandCss(page);
      await hoverNearBottom(page);
      await page.screenshot({ path: `${SHOTS}/narrow-${appearance}-css-expanded.png` });
      await page.getByTestId('code-theme-select').click();
      await expect(page.getByTestId('code-theme-menu')).toBeVisible();
      await page.waitForTimeout(250); // pop-in animation
      const m = await rect(page.getByTestId('code-theme-menu'));
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x + m.width).toBeLessThanOrEqual(390);
      await page.screenshot({ path: `${SHOTS}/narrow-${appearance}-menu.png` });
      await page.keyboard.press('Escape');

      // Longest theme name still fits without overflow.
      await chooseTheme(page, 'solarized-light');
      await expect(page.getByTestId('code-theme-select')).toContainText('Solarized Light');
      expect(await bar(page).evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      const t = await rect(page.getByTestId('code-theme-select'));
      const d = await rect(page.getByTestId('code-font-decrease'));
      expect(t.x + t.width).toBeLessThanOrEqual(d.x);
      await page.screenshot({ path: `${SHOTS}/narrow-${appearance}-solarized.png` });
    });
  }
});

test.describe('touch / coarse pointer', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('shows directly in the same slot, clear of the number lane, and is operable', async ({ page }) => {
    await seedAndOpen(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    const b = await rect(bar(page));
    const edges = await codeEdges(page);
    expect(b.x).toBeGreaterThan(edges.gutterRight);
    const strip = await rect(page.locator('.editor-css-panel-strip'));
    expect(strip.y - (b.y + b.height)).toBe(12);
    const value = page.getByTestId('code-font-size-value');
    await page.getByTestId('code-font-increase').tap();
    await expect(value).toHaveText('17');
    await page.getByTestId('code-font-decrease').tap();
    await expect(value).toHaveText('16');
    await page.getByTestId('code-theme-select').tap();
    await page.getByTestId('code-theme-option-dracula').tap();
    await expect(page.getByTestId('code-theme-select')).toContainText('Dracula');
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    await page.screenshot({ path: `${SHOTS}/touch-light.png` });
  });
});

test.describe('hybrid: fine primary pointer plus touchscreen', () => {
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: true });

  test('a touch in the code pane shows the bar; its controls work by touch; a mouse brings back hover mode', async ({ page }) => {
    // Chromium's touch emulation also makes the PRIMARY pointer coarse. A hybrid
    // laptop reports a fine primary pointer plus touch, so emulate that by
    // answering the primary-pointer query as a real hybrid device does.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => {
        if (q.replace(/\s/g, '') === '(pointer:coarse)') {
          const m = original('(pointer: fine) and (pointer: coarse)'); // never matches
          return m;
        }
        return original(q);
      };
    });
    await seedAndOpen(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    await page.mouse.move(700, 400); // pointer over the preview
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden');

    const content = await rect(editorContent(page));
    await page.touchscreen.tap(content.x + 40, content.y + 10);
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');
    await page.waitForTimeout(800); // stays shown after the finger lifts
    await expect(bar(page)).toHaveAttribute('data-state', 'visible');

    const value = page.getByTestId('code-font-size-value');
    await page.getByTestId('code-font-increase').tap();
    await expect(value).toHaveText('17');
    await page.getByTestId('code-font-decrease').tap();
    await expect(value).toHaveText('16');

    // Mouse use again: back to on-demand reveal.
    await page.mouse.move(200, 300);
    await page.mouse.move(210, 310);
    await expect(bar(page)).toHaveAttribute('data-state', 'hidden', { timeout: 2000 });
  });
});
