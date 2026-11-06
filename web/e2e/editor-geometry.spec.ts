// Approved Figma gutter/row geometry for the code workspace (Light 32:4370, Dark
// 32:4188; exports editor-gutter-final-{light,dark}.png). At 1440x960:
// - Code workspace x16..368, y68..948; preview card x392, y68..948.
// - The DSL code area ends at y904, where the Custom CSS footer (and its divider,
//   x16..368) begins.
// - A 32px line-number lane starts at the code area's left edge; code starts 40px
//   right of it (x56), for 1, 2 and 3 digit line numbers alike.
// - The first row starts at the code area's top. Rows are 24px; code 15px, numbers
//   13px. The current-row highlight is one 24px band across lane and code.
// Light and dark must measure the same.

import { test, expect, type Page } from '@playwright/test';
import { seedAndOpen, clearEditor, editorRoot } from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await seedAndOpen(page);
});

const SAMPLE = 'Alice->Bob: Hello\nBob->Alice: Hi back';

async function setDoc(page: Page, doc: string): Promise<void> {
  await clearEditor(page);
  await page.keyboard.insertText(doc);
  await page.keyboard.press('ControlOrMeta+Home');
}

const lines = (n: number) => Array.from({ length: n }, (_, i) => `A->B: m${i}`).join('\n');

async function setAppearance(page: Page, appearance: 'light' | 'dark'): Promise<void> {
  const html = page.locator('html');
  if ((await html.getAttribute('data-appearance')) !== appearance) {
    await page.getByTestId('header-appearance').click();
  }
  await expect(html).toHaveAttribute('data-appearance', appearance);
}

/** Geometry of the DSL editor, relative to the page. */
async function geometry(page: Page) {
  return editorRoot(page).evaluate((root) => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
    };
    const editor = root.querySelector('.cm-editor')!;
    const firstLine = root.querySelector('.cm-line')!;
    const range = document.createRange();
    const text = firstLine.firstChild && firstLine.firstChild.nodeType === 3 ? firstLine.firstChild : firstLine.querySelector('span')?.firstChild ?? firstLine.firstChild!;
    range.setStart(text!, 0);
    range.setEnd(text!, 1);
    const firstChar = range.getBoundingClientRect();
    const numbers = [...root.querySelectorAll('.cm-lineNumbers .cm-gutterElement')].filter((e) => /^\d+$/.test(e.textContent ?? ''));
    const numberText = (el: Element) => {
      const nr = document.createRange();
      nr.selectNodeContents(el);
      return nr.getBoundingClientRect();
    };
    const activeLine = root.querySelector('.cm-activeLine');
    const activeGutter = root.querySelector('.cm-lineNumbers .cm-activeLineGutter');
    const content = root.querySelector('.cm-content')!;
    return {
      editor: r(editor),
      gutters: r(root.querySelector('.cm-gutters')),
      lineNumbers: r(root.querySelector('.cm-lineNumbers')),
      firstLine: r(firstLine),
      codeX: firstChar.x,
      firstNumberTop: numbers[0] ? numbers[0].getBoundingClientRect().y : null,
      numberRights: numbers.slice(0, 3).map((n) => numberText(n).right),
      lastNumberLeft: numbers.length ? numberText(numbers[numbers.length - 1]).x : null,
      codeFont: getComputedStyle(content).fontSize,
      codeFamily: getComputedStyle(content).fontFamily,
      codeLineHeight: getComputedStyle(firstLine).lineHeight,
      numberFont: numbers[0] ? getComputedStyle(numbers[0]).fontSize : null,
      numberLineHeight: numbers[0] ? getComputedStyle(numbers[0]).lineHeight : null,
      activeLine: r(activeLine),
      activeGutter: r(activeGutter),
      activeLineBg: activeLine ? getComputedStyle(activeLine).backgroundColor : null,
      activeGutterBg: activeGutter ? getComputedStyle(activeGutter).backgroundColor : null,
      activeRadius: activeLine ? getComputedStyle(activeLine).borderRadius : null,
      activeGutterRadius: activeGutter ? getComputedStyle(activeGutter).borderRadius : null,
    };
  });
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance}: workspace, preview and Custom CSS footer edges`, async ({ page }) => {
    await setAppearance(page, appearance);
    await setDoc(page, SAMPLE);
    const g = await geometry(page);
    expect(g.editor).toMatchObject({ x: 16, y: 68, w: 352 });
    expect(g.editor!.bottom).toBe(904);
    // The footer row (its top border is the divider) holds the collapse toggle.
    const footer = page.locator('.editor-css-panel-strip');
    await expect(footer.getByTestId('css-panel-strip')).toBeVisible();
    const strip = (await footer.boundingBox())!;
    expect(strip).toMatchObject({ x: 16, y: 904, width: 352 });
    expect(strip.y + strip.height).toBe(948);
    const divider = await footer.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(divider).toBe('1px');
    // Footer content keeps the design's insets inside the flush divider: label text
    // starts at x50 and "Report a bug" ink ends at x344 (its text box ends 2px later,
    // at x346, after the final glyph's side bearing).
    const text = await footer.evaluate((el) => {
      const box = (node: Element) => { const r = document.createRange(); r.selectNodeContents(node); return r.getBoundingClientRect(); };
      const label = [...el.querySelectorAll('*')].find((n) => n.childElementCount === 0 && n.textContent?.trim() === 'Custom CSS') ?? el;
      const bug = [...el.querySelectorAll('*')].find((n) => n.childElementCount === 0 && n.textContent?.trim() === 'Report a bug') ?? el;
      return { labelX: box(label).x, bugRight: box(bug).right };
    });
    expect(Math.abs(text.labelX - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(text.bugRight - 346)).toBeLessThanOrEqual(1);
    const preview = (await page.locator('.editor-preview-panel').first().boundingBox())!;
    expect(preview).toMatchObject({ x: 392, y: 68 });
    expect(preview.y + preview.height).toBe(948);
  });

  test(`${appearance}: first row at the top, 24px rows, 15px code and 13px numbers`, async ({ page }) => {
    await setAppearance(page, appearance);
    await setDoc(page, SAMPLE);
    const g = await geometry(page);
    expect(g.firstLine!.y).toBe(g.editor!.y);
    expect(g.firstLine!.h).toBe(24);
    expect(g.firstNumberTop).toBe(g.editor!.y);
    expect(g.codeFont).toBe('15px');
    expect(g.codeLineHeight).toBe('24px');
    expect(g.numberFont).toBe('13px');
    expect(g.numberLineHeight).toBe('24px');
  });

  test(`${appearance}: 32px number lane, code at x56 for 1/2/3 digits, numbers right-aligned`, async ({ page }) => {
    await setAppearance(page, appearance);
    const seen: number[] = [];
    for (const n of [2, 12, 120]) {
      await setDoc(page, lines(n));
      const g = await geometry(page);
      expect(g.gutters).toMatchObject({ x: 16, w: 32 });
      expect(g.codeX).toBe(56);
      // Right-aligned: every visible number ends at the same x, inside the lane.
      expect(new Set(g.numberRights.map((v) => Math.round(v * 10))).size).toBe(1);
      expect(g.numberRights[0]).toBeLessThanOrEqual(48);
      expect(g.lastNumberLeft!).toBeGreaterThanOrEqual(16);
      seen.push(g.numberRights[0]);
    }
    expect(new Set(seen.map((v) => Math.round(v * 10))).size).toBe(1);
  });

  test(`${appearance}: current row is one square 24px band across lane and code, following the cursor`, async ({ page }) => {
    await setAppearance(page, appearance);
    await setDoc(page, SAMPLE);
    let g = await geometry(page);
    expect(g.activeGutter).toMatchObject({ x: 16, y: 68, w: 32, h: 24 });
    expect(g.activeLine).toMatchObject({ x: 48, y: 68, h: 24 });
    expect(g.activeLine!.right).toBe(368);
    expect(g.activeLineBg).toBe(g.activeGutterBg);
    expect(g.activeRadius).toBe('0px');
    expect(g.activeGutterRadius).toBe('0px');
    await page.keyboard.press('ArrowDown');
    g = await geometry(page);
    expect(g.activeGutter!.y).toBe(92);
    expect(g.activeLine!.y).toBe(92);
  });
}

test('light and dark measure the same', async ({ page }) => {
  await setDoc(page, SAMPLE);
  await setAppearance(page, 'light');
  const light = await geometry(page);
  await setAppearance(page, 'dark');
  const dark = await geometry(page);
  const pick = (g: typeof light) => ({ ...g, activeLineBg: null, activeGutterBg: null });
  expect(pick(dark)).toEqual(pick(light));
  expect(dark.activeLineBg).not.toBe(light.activeLineBg); // each theme's own row colour
});

test('99 -> 100 lines: code start and number edge do not move', async ({ page }) => {
  await setDoc(page, lines(99));
  const before = await geometry(page);
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\nA->B: hundred');
  await page.keyboard.press('ControlOrMeta+Home');
  const after = await geometry(page);
  expect(after.codeX).toBe(before.codeX);
  expect(after.numberRights[0]).toBe(before.numberRights[0]);
  expect(after.gutters!.w).toBe(32);
});

test('long lines wrap; the current-row band covers the wrapped row in lane and code', async ({ page }) => {
  await setDoc(page, `A->B: ${'very long message '.repeat(12)}\nB->A: ok`);
  const g = await geometry(page);
  expect(g.activeLine!.h).toBeGreaterThan(24);
  expect(g.activeLine!.h % 24).toBe(0);
  expect(g.activeGutter!.h).toBe(g.activeLine!.h);
  expect(g.codeX).toBe(56);
});

test('narrow view keeps the lane and code offset relative to the editor', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await setDoc(page, lines(12));
  const g = await geometry(page);
  expect(g.gutters!.w).toBe(32);
  expect(g.codeX - g.editor!.x).toBe(40);
  expect(g.firstLine!.y).toBe(g.editor!.y);
  // The collapsed footer fits: toggle and "Report a bug" neither clip nor overlap.
  const footer = await page.locator('.editor-css-panel-strip').evaluate((el) => {
    const strip = el.getBoundingClientRect();
    const toggle = el.querySelector('[data-testid="css-panel-strip"]')!.getBoundingClientRect();
    const bugEl = el.querySelector('.editor-report-bug') as HTMLElement;
    const bug = bugEl.getBoundingClientRect();
    return { stripRight: strip.right, toggleRight: toggle.right, bugLeft: bug.left, bugRight: bug.right, bugClipped: bugEl.scrollWidth > bugEl.clientWidth, bugName: bugEl.getAttribute('aria-label') };
  });
  expect(footer.bugRight).toBeLessThanOrEqual(footer.stripRight);
  expect(footer.bugLeft).toBeGreaterThanOrEqual(footer.toggleRight);
  expect(footer.bugClipped).toBe(false);
  expect(footer.bugName).toBe('Report a bug');
});
