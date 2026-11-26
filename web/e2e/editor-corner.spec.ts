// Light appearance: the code sits on a white card with 10px rounded corners and a
// 1px border. With the cursor on line 1, the current-line band (gutter cell and
// line) painted square over the card's top edge, so the rounded corners and the
// top border disappeared. Reported 2026-11-27.
//
// The check reads real screen pixels: the top border must keep the border colour
// and the corner outside the curve must keep the frame colour, whether line 1 is
// the current line, selected, or neither.

import { test, expect, type Page } from '@playwright/test';
import { seedAndOpen, clearEditor, editorRoot } from './helpers/editor';

const FRAME = [247, 248, 250]; // --editor-bg #F7F8FA
const BORDER = [230, 232, 235]; // --editor-border #E6E8EB

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await seedAndOpen(page);
  const html = page.locator('html');
  if ((await html.getAttribute('data-appearance')) === 'dark') {
    await page.getByTestId('header-appearance').click();
  }
  await expect(html).not.toHaveAttribute('data-appearance', 'dark');
  await clearEditor(page);
  await page.keyboard.insertText(['A->B: one', 'B->C: two', 'C->D: three'].join('\n'));
});

/** RGB of screen pixels at page coordinates, read from a real screenshot. */
async function pixels(page: Page, points: [number, number][]): Promise<number[][]> {
  const shot = await page.screenshot({ scale: 'css' });
  return page.evaluate(
    async ({ b64, points }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return points.map(([x, y]) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)));
    },
    { b64: shot.toString('base64'), points },
  );
}

const near = (actual: number[], expected: number[]) => actual.every((v, i) => Math.abs(v - expected[i]) <= 2);

async function expectCardEdgeIntact(page: Page): Promise<void> {
  const e = (await editorRoot(page).locator('.cm-editor').boundingBox())!;
  const right = e.x + e.width - 1;
  const [topLeft, topRight, borderInLane, borderInCode, borderNearRight] = await pixels(page, [
    [e.x, e.y],
    [right, e.y],
    [e.x + 20, e.y],
    [e.x + 150, e.y],
    [right - 20, e.y],
  ]);
  expect(near(topLeft, FRAME), `top-left corner ${topLeft} should be frame ${FRAME}`).toBe(true);
  expect(near(topRight, FRAME), `top-right corner ${topRight} should be frame ${FRAME}`).toBe(true);
  for (const p of [borderInLane, borderInCode, borderNearRight]) {
    expect(near(p, BORDER), `top border ${p} should be ${BORDER}`).toBe(true);
  }
}

test('light card: corners and top border stay visible with the cursor on line 2 (control)', async ({ page }) => {
  await editorRoot(page).locator('.cm-line').nth(1).click();
  await expectCardEdgeIntact(page);
});

test('light card: corners and top border stay visible with the cursor on line 1', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+Home');
  await expect(editorRoot(page).locator('.cm-activeLine')).toHaveText('A->B: one');
  await expectCardEdgeIntact(page);
});

test('light card: corners and top border stay visible with line 1 selected', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+a');
  await expectCardEdgeIntact(page);
});

test('light card: the lint marker on line 1 still opens its message at its top-left corner', async ({ page }) => {
  await clearEditor(page);
  await page.keyboard.insertText('!!!@@@###');
  const marker = editorRoot(page).locator('.cm-lint-marker-error').first();
  await expect(marker).toBeVisible({ timeout: 15000 });
  const box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + 1);
  await expect(page.locator('.cm-tooltip-lint').first()).toContainText('Expecting end of file');
});
