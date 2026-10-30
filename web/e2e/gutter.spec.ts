// DSL editor gutter geometry + function. The stock CodeMirror gutters (line numbers
// 16px with 5/3 padding and a 20px minimum, fold 11.6px, lint 1.4em = 22.4px) put
// code text 61px right of the editor's left edge for a 2-line doc (x85 vs the Figma
// reference's x56). These tests pin a compact gutter WITHOUT losing what the columns
// are for: readable, unclipped line numbers at 1/2/3+ digits, a working fold toggle,
// and a lint marker with a usable hover target. The last test checks that the
// lint tooltip stays readable in dark appearance (tooltip surface tokens).

import { test, expect, type Page } from '@playwright/test';
import { seedAndOpen, clearEditor, editorRoot } from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await seedAndOpen(page);
});

async function setDoc(page: Page, doc: string): Promise<void> {
  await clearEditor(page);
  await page.keyboard.insertText(doc);
  await page.keyboard.press('ControlOrMeta+Home');
}

/** Code text start, measured from the editor's left edge, plus line-number facts. */
async function measure(page: Page, lastLine: string) {
  return editorRoot(page).evaluate((root, last) => {
    const editor = root.querySelector('.cm-editor')!.getBoundingClientRect();
    const line = root.querySelector('.cm-line')!;
    const range = document.createRange();
    range.setStart(line.firstChild!, 0);
    range.setEnd(line.firstChild!, 1);
    const numbers = root.querySelector('.cm-lineNumbers')!;
    const lastNumber = [...numbers.querySelectorAll('.cm-gutterElement')].find((e) => e.textContent === last);
    const numberRange = document.createRange();
    if (lastNumber) numberRange.selectNodeContents(lastNumber);
    const numberBox = lastNumber ? numberRange.getBoundingClientRect() : null;
    const gutterBox = numbers.getBoundingClientRect();
    return {
      codeOffset: range.getBoundingClientRect().x - editor.x,
      numberFontPx: lastNumber ? parseFloat(getComputedStyle(lastNumber).fontSize) : 0,
      numberInside: !!numberBox && numberBox.x >= gutterBox.x && numberBox.right <= gutterBox.right,
      numberUnclipped: !!lastNumber && lastNumber.scrollWidth <= lastNumber.clientWidth,
    };
  }, lastLine);
}

const lines = (n: number) => Array.from({ length: n }, (_, i) => `A->B: m${i}`).join('\n');

test('gutter: 1-digit doc starts code within 50px of the editor edge, numbers readable', async ({ page }) => {
  await setDoc(page, 'Alice->Bob: Hello\nBob->Alice: Hi back');
  const m = await measure(page, '2');
  // Bounds include the 16px lint column (a 16x16 marker hover target).
  expect(m.codeOffset).toBeLessThanOrEqual(50);
  expect(m.numberFontPx).toBeGreaterThanOrEqual(12);
  expect(m.numberInside).toBe(true);
  expect(m.numberUnclipped).toBe(true);
});

test('gutter: 2- and 3-digit line numbers stay fully visible and compact', async ({ page }) => {
  await setDoc(page, lines(12));
  const two = await measure(page, '12');
  expect(two.numberInside).toBe(true);
  expect(two.numberUnclipped).toBe(true);
  expect(two.codeOffset).toBeLessThanOrEqual(58);

  await setDoc(page, lines(120));
  // Line 120 is off-screen until scrolled; the gutter width is set by the widest
  // number, so measure "120" after jumping to the end.
  await page.keyboard.press('ControlOrMeta+End');
  const three = await measure(page, '120');
  expect(three.numberInside).toBe(true);
  expect(three.numberUnclipped).toBe(true);
  expect(three.codeOffset).toBeLessThanOrEqual(66);
});

test('gutter: fold toggle keeps a >=12px target and still folds a block', async ({ page }) => {
  await setDoc(page, 'A.b() {\n  C.d()\n  E.f()\n}');
  const root = editorRoot(page);
  // The fold gutter takes no width (it overlays the number lane's right edge), so
  // the hit target is the "Fold line" toggle element itself: measure that.
  const marker = root.locator('.cm-foldGutter span[title="Fold line"]').first();
  await expect(marker).toBeVisible();
  const box = (await marker.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(12);
  expect(box.height).toBeGreaterThanOrEqual(12);
  await marker.click();
  await expect(root.locator('.cm-foldPlaceholder')).toBeVisible();
});

test('gutter: lint marker element itself is a >=12px hover target (glyph stays small)', async ({ page }) => {
  await setDoc(page, '!!!@@@###');
  const root = editorRoot(page);
  const marker = root.locator('.cm-lint-marker-error').first();
  await expect(marker).toBeVisible({ timeout: 15000 });
  // @codemirror/lint binds onmouseover on the marker element (marker.toDOM), not on
  // its gutter cell, so the marker's own box is the hover target.
  const m = await marker.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const cell = el.closest('.cm-gutterElement')!.getBoundingClientRect();
    return {
      w: r.width, h: r.height, x: r.x, y: r.y,
      glyph: parseFloat(cs.width),
      insideRow: r.top >= cell.top - 0.5 && r.bottom <= cell.bottom + 0.5,
      coversRow: Math.abs(r.top - cell.top) < 0.5 && Math.abs(r.height - cell.height) < 0.5,
    };
  });
  expect(m.w).toBeGreaterThanOrEqual(12);
  expect(m.h).toBeGreaterThanOrEqual(12);
  expect(m.glyph).toBeLessThanOrEqual(10); // visual glyph unchanged
  expect(m.insideRow).toBe(true);
  expect(m.coversRow).toBe(true); // the hover target spans the whole row height
  // Pointer at the target's corner (outside the 10px glyph) still opens the message.
  await page.mouse.move(m.x + 1, m.y + 1);
  await expect(page.locator('.cm-tooltip-lint').first()).toContainText('Expecting end of file');
});

test('gutter: diagnostics are reachable from the keyboard (lint panel, next diagnostic)', async ({ page }) => {
  await setDoc(page, 'A->B: ok\n!!!@@@###');
  await expect(editorRoot(page).locator('.cm-lint-marker-error').first()).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('F8'); // nextDiagnostic: selects the diagnostic range
  const sel = await page.evaluate(() => window.getSelection()!.toString());
  expect(sel.length).toBeGreaterThan(0);
  await page.keyboard.press('ControlOrMeta+Shift+m'); // openLintPanel
  await expect(page.locator('.cm-panel-lint')).toContainText('Expecting end of file');
});

test('lint tooltip is readable in dark appearance (dark surface, light text)', async ({ page }) => {
  await page.getByTestId('header-appearance').click();
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await setDoc(page, '!!!@@@###');
  const marker = editorRoot(page).locator('.cm-lint-marker-error').first();
  await expect(marker).toBeVisible({ timeout: 15000 });
  await marker.hover();
  const tooltip = page.locator('.cm-tooltip-lint').first();
  await expect(tooltip).toContainText('Expecting end of file');
  const colors = await tooltip.evaluate((el) => {
    const box = el.closest('.cm-tooltip') as HTMLElement;
    const text = el.querySelector('.cm-diagnostic') as HTMLElement;
    return { bg: getComputedStyle(box).backgroundColor, fg: getComputedStyle(text).color };
  });
  // --editor-surface / --code-fg in dark appearance (globals.css).
  expect(colors).toEqual({ bg: 'rgb(52, 63, 75)', fg: 'rgb(237, 240, 245)' });
});
