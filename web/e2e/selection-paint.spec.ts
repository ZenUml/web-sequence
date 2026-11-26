// Selection must be VISIBLE on every selected line, including the line holding the
// cursor head. CodeMirror draws the selection in a layer BEHIND the text, and the
// current-line band (.cm-activeLine) paints an opaque background over it. Dragging
// upward puts the head on line 1, so line 1 was selected but showed no blue tint
// (dragging downward hid the last line the same way). Reported 2026-11-26.
//
// The check: after an upward drag that ends on line 1, the selection layer has a
// rectangle on line 1 AND the active line paints no background over it.

import { test, expect, type Page } from '@playwright/test';
import { seedAndOpen, clearEditor, editorRoot } from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await seedAndOpen(page);
});

async function dragUpToLineOne(page: Page): Promise<void> {
  await clearEditor(page);
  await page.keyboard.insertText(['// first', 'A -> B: one', 'B -> C: two', 'C -> D: three', 'D -> E: four'].join('\n'));
  const lines = editorRoot(page).locator('.cm-line');
  const first = (await lines.nth(0).boundingBox())!;
  const fifth = (await lines.nth(4).boundingBox())!;
  const start = { x: fifth.x + 80, y: fifth.y + fifth.height / 2 };
  const end = { x: first.x + 1, y: first.y + first.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
}

async function lineOnePaint(page: Page) {
  return editorRoot(page).evaluate((root) => {
    const line = root.querySelector('.cm-line')!.getBoundingClientRect();
    const onLineOne = [...root.querySelectorAll('.cm-selectionBackground')].some((e) => {
      const r = e.getBoundingClientRect();
      return r.top < line.bottom && r.bottom > line.top;
    });
    const active = root.querySelector('.cm-activeLine');
    return {
      activeIsLineOne: active === root.querySelector('.cm-line'),
      selectionOnLineOne: onLineOne,
      activeLineBackground: active ? getComputedStyle(active).backgroundColor : null,
    };
  });
}

for (const appearance of ['light', 'dark'] as const) {
  test(`selection: upward drag shows line 1 as selected (${appearance})`, async ({ page }) => {
    if (appearance === 'dark') {
      await page.evaluate(() => { document.documentElement.dataset.appearance = 'dark'; });
    }
    await dragUpToLineOne(page);
    const paint = await lineOnePaint(page);
    expect(paint.activeIsLineOne).toBe(true);
    expect(paint.selectionOnLineOne).toBe(true);
    // Nothing may cover the selection layer on the head's line.
    expect(paint.activeLineBackground).toBe('rgba(0, 0, 0, 0)');
  });
}

test('selection: current-line band returns once the selection collapses', async ({ page }) => {
  await dragUpToLineOne(page);
  await page.keyboard.press('ArrowLeft'); // collapse to the head
  const paint = await lineOnePaint(page);
  expect(paint.activeLineBackground).not.toBe('rgba(0, 0, 0, 0)');
});
