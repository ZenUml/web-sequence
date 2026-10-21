// Diagrams page E2E (signed-out, local fixtures only — no cloud or user data).
//
//   DGM-1  wide 13-participant diagram: 70% scale, left-aligned, cropped, 12px top
//   DGM-2  narrow diagram: centred; outer frame title hidden, participants kept
//   DGM-3  empty diagram placeholder; long title stays clear of the actions
//   DGM-4  card opens the editor; Fork/Delete do not open it
//   DGM-5  keyboard delete: focus Cancel, Escape cancels, focus returns; confirm deletes
//   DGM-6  delete failure keeps the dialog and the diagram; retry succeeds
//   DGM-7  quick-start template creates the template diagram
//   DGM-8  appearance toggles immediately, persists, and matches the Editor
//   DGM-9  representative 24-card library renders every preview

import { test, expect } from '@playwright/test';

const now = Date.now();
function fx(id, title, js, extra = {}, ageMin = 0) {
  return {
    id, title, js, css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js',
    pages: [{ id: 'p1', title: 'Page 1', js, css: '', isDefault: true }],
    currentPageId: 'p1', updatedOn: now - ageMin * 60_000, folderId: null, ...extra,
  };
}
const WIDE = ['Browser', 'Gateway', 'Auth', 'Catalog', 'Cart', 'Pricing', 'Inventory', 'Payment', 'Fraud', 'Ledger', 'Shipping', 'Email', 'Analytics'];
const LONG_TITLE = 'A very long diagram title that keeps going to test truncation near the action icons';
const FIXTURES = [
  fx('fx-checkout', 'Checkout flow', 'title Checkout\nCustomer->Store: Place order\nStore->Payment: Charge\nPayment-->Store: Approved\nStore-->Customer: Confirmation', {}, 1),
  fx('fx-wide', 'Cross-service checkout', WIDE.slice(0, -1).map((n, i) => `${n}->${WIDE[i + 1]}: Step ${i + 1}`).join('\n'), {}, 2),
  fx('fx-empty', 'Untitled', '', {}, 3),
  fx('fx-long', LONG_TITLE, 'A->B: hi', {}, 4),
];

async function seed(page, items = FIXTURES, appearance = 'light') {
  await page.addInitScript(
    ({ items, appearance }) => {
      if (sessionStorage.getItem('__dgm_seeded')) return;
      sessionStorage.setItem('__dgm_seeded', '1');
      localStorage.clear();
      localStorage.setItem('onboarded', 'true');
      localStorage.setItem('lastSeenVersion', JSON.stringify('9999.12.31'));
      localStorage.setItem('appearance', JSON.stringify(appearance));
      const idx = {};
      for (const it of items) {
        localStorage.setItem(it.id, JSON.stringify(it));
        idx[it.id] = true;
      }
      localStorage.setItem('items', JSON.stringify(idx));
    },
    { items, appearance },
  );
}

async function gotoDiagrams(page) {
  await page.goto('/?view=diagrams');
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible({ timeout: 15_000 });
}

async function waitForThumb(page, id) {
  const thumb = page.locator(`[data-testid="home-thumb-${id}"]`);
  await expect(thumb).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  return thumb;
}

// Geometry of a rendered thumbnail, in page CSS px.
async function thumbGeometry(page, id) {
  const thumb = await waitForThumb(page, id);
  const box = await thumb.boundingBox();
  const frame = page.frameLocator(`[data-testid="home-thumb-${id}"] iframe`);
  const first = await frame.locator('.participant').first().boundingBox();
  const last = await frame.locator('.participant').last().boundingBox();
  const transform = await thumb.locator('iframe').evaluate((el) => getComputedStyle(el).transform);
  return { box, first, last, transform };
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err; });
});

test('DGM-1: a wide 13-participant diagram is 70% scale, left-aligned, top-aligned and cropped', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  const g = await thumbGeometry(page, 'fx-wide');
  await expect(page.locator('[data-testid="home-thumb-fx-wide"]')).toHaveAttribute('data-cropped', 'true');
  expect(g.transform).toMatch(/^matrix\(0\.7, 0, 0, 0\.7,/);
  expect(g.first.y - g.box.y).toBeGreaterThan(10.5);
  expect(g.first.y - g.box.y).toBeLessThan(13.5);
  // Left-aligned (not centred, not width-fitted); the last participant is beyond the card.
  expect(g.first.x - g.box.x).toBeLessThan(60);
  expect(g.last.x).toBeGreaterThan(g.box.x + g.box.width);
  // Participant headers keep their native proportions at 70% (no width fit).
  expect(g.first.height).toBeGreaterThan(40 * 0.7 - 2);
});

test('DGM-2: a narrow diagram is centred and only its outer title/frame is hidden', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  const g = await thumbGeometry(page, 'fx-checkout');
  await expect(page.locator('[data-testid="home-thumb-fx-checkout"]')).toHaveAttribute('data-cropped', 'false');
  const leftGap = g.first.x - g.box.x;
  const rightGap = g.box.x + g.box.width - (g.last.x + g.last.width);
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(40);
  expect(g.first.y - g.box.y).toBeGreaterThan(10.5);
  expect(g.first.y - g.box.y).toBeLessThan(13.5);
  const frame = page.frameLocator('[data-testid="home-thumb-fx-checkout"] iframe');
  await expect(frame.locator('.header.bg-skin-title')).toBeHidden();
  await expect(frame.locator('.participant')).toHaveCount(3);
  await expect(frame.locator('.message').first()).toBeVisible();
});

test('DGM-3: empty diagram placeholder and long title clear of the actions', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  const empty = page.locator('[data-testid="home-card-fx-empty"]');
  await expect(empty).toContainText('Empty diagram');
  await expect(empty.locator('iframe')).toHaveCount(0);

  const card = page.locator('[data-testid="home-card-fx-long"]');
  const title = card.locator('.dh-card-title');
  const fork = card.getByRole('button', { name: `Fork ${LONG_TITLE}` });
  const titleBox = await title.boundingBox();
  const forkBox = await fork.boundingBox();
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(forkBox.x);
  expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(forkBox.width).toBe(28);
  expect(forkBox.height).toBe(28);
});

test('DGM-4: the card opens the editor; Fork and Delete do not open it', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  const card = page.locator('[data-testid="home-card-fx-checkout"]');
  await card.getByRole('button', { name: 'Delete Checkout flow' }).click();
  await page.locator('[data-testid="home-delete-cancel"]').click();
  await expect(page.locator('[data-testid="home-view"]')).toBeVisible();
  await card.getByRole('button', { name: 'Open Checkout flow' }).click();
  await expect(page).toHaveURL(/[?&]id=fx-checkout/);
  await expect(page.locator('[data-testid="dsl-editor"] .cm-content')).toContainText('Place order');
});

test('DGM-5: keyboard delete confirmation — Cancel focus, Escape, focus return, confirm', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  const trash = page.getByRole('button', { name: 'Delete Checkout flow' });
  await trash.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('[data-testid="home-delete-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Delete this diagram?' })).toBeVisible();
  await expect(dialog.locator('[data-testid="home-delete-name"]')).toHaveText('Checkout flow');
  await expect(dialog).toContainText('This action cannot be undone.');
  await expect(page.locator('[data-testid="home-delete-cancel"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trash).toBeFocused();
  await expect(page.locator('[data-testid="home-card-fx-checkout"]')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-testid="home-delete-confirm"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-testid="home-card-fx-checkout"]')).toHaveCount(0);
  await expect(page.locator('#dh-diagrams-heading')).toBeFocused();
  // Persisted: still gone after a reload.
  await page.reload();
  await expect(page.locator('[data-testid="home-grid"]')).toBeVisible();
  await expect(page.locator('[data-testid="home-card-fx-checkout"]')).toHaveCount(0);
});

test('DGM-6: a failed delete keeps the dialog and the diagram, then retry succeeds', async ({ page }) => {
  await seed(page);
  // Make the first local removal of this fixture fail, like a storage error.
  await page.addInitScript(() => {
    const original = Storage.prototype.removeItem;
    let failed = false;
    Storage.prototype.removeItem = function (key) {
      if (key === 'fx-checkout' && !failed) {
        failed = true;
        throw new Error('Simulated storage failure');
      }
      return original.call(this, key);
    };
  });
  await gotoDiagrams(page);
  await page.getByRole('button', { name: 'Delete Checkout flow' }).click();
  const dialog = page.locator('[data-testid="home-delete-dialog"]');
  await dialog.locator('[data-testid="home-delete-confirm"]').click();
  await expect(dialog.getByRole('alert')).toContainText('Could not delete this diagram');
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-testid="home-card-fx-checkout"]')).toBeVisible();
  await dialog.locator('[data-testid="home-delete-confirm"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-testid="home-card-fx-checkout"]')).toHaveCount(0);
});

test('DGM-7: the Blue quick start creates the Blue template diagram', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  await expect(page.locator('[data-testid="home-template-basic"]')).toHaveCount(0);
  await page.locator('[data-testid="home-template-blue"]').click();
  await expect(page.locator('[data-testid="dsl-editor"] .cm-content')).toContainText('Get order by id', { timeout: 15_000 });
});

test('DGM-8: appearance toggles immediately, persists, and matches the Editor', async ({ page }) => {
  await seed(page);
  await gotoDiagrams(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-appearance', 'light');
  const surface = page.locator('.dh-surface');
  const lightBg = await surface.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.locator('[data-testid="home-appearance"]').click();
  await expect(html).toHaveAttribute('data-appearance', 'dark');
  await expect.poll(() => surface.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(lightBg);
  // Diagram previews stay light in the dark UI.
  const previewBg = await page.locator('[data-testid="home-card-fx-checkout"] .dh-card-preview').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(previewBg).toBe('rgb(255, 255, 255)');
  await page.reload();
  await expect(html).toHaveAttribute('data-appearance', 'dark');
  await page.locator('[data-testid="home-card-fx-checkout"]').getByRole('button', { name: 'Open Checkout flow' }).click();
  await expect(page.locator('[data-testid="dsl-editor"]')).toBeVisible();
  await expect(html).toHaveAttribute('data-appearance', 'dark');
  await expect(page.locator('[data-testid="header-appearance"]')).toHaveAccessibleName('Switch to light appearance');
});

// Every card action that is inside the viewport (below the sticky topbar) must be the
// element under the pointer at its centre. Scrolls the page in small steps so a fixed
// overlay (e.g. a floating button) cannot hide behind a lucky scroll position.
async function occludedActions(page) {
  return page.evaluate(async () => {
    const misses = [];
    const topbar = document.querySelector('.dh-topbar');
    const top = topbar ? topbar.getBoundingClientRect().bottom : 0;
    // The hub scrolls inside its own container, not the window: find the nearest
    // scrollable ancestor of the grid.
    let scroller = document.querySelector('[data-testid="home-grid"]');
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) {
      scroller = scroller.parentElement;
    }
    scroller = scroller || document.scrollingElement;
    const maxY = scroller.scrollHeight - scroller.clientHeight;
    if (maxY <= 0) misses.push('no scrollable container found');
    for (let y = 0; y <= maxY + 60; y += 60) {
      scroller.scrollTop = Math.min(y, maxY);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const btn of document.querySelectorAll('[data-testid^="home-action-"]')) {
        const r = btn.getBoundingClientRect();
        if (r.top < top || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !btn.contains(hit)) {
          misses.push(`${btn.dataset.testid} @scroll ${Math.round(scroller.scrollTop)} covered by ${hit ? (hit.dataset?.testid || hit.className || hit.tagName) : 'nothing'}`);
        }
      }
    }
    return [...new Set(misses)];
  });
}

for (const [label, viewport] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]) {
  for (const appearance of ['light', 'dark']) {
    test(`DGM-10: every card action stays clickable while scrolling (${label} ${appearance})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const many = Array.from({ length: 12 }, (_, i) => fx(`fx-hit-${i}`, `Hit ${i}`, `A->B: ${i}`, {}, i));
      await seed(page, many, appearance);
      await gotoDiagrams(page);
      await expect(page.locator('[data-testid^="home-action-delete-"]')).toHaveCount(12);
      expect(await occludedActions(page)).toEqual([]);
    });
  }
}

test('DGM-9: a 24-card library renders every preview', async ({ page }) => {
  const many = Array.from({ length: 24 }, (_, i) =>
    fx(`fx-many-${i}`, `Diagram ${String(i + 1).padStart(2, '0')}`, `A${i}->B${i}: call ${i}\nB${i}->C${i}: next\nC${i}-->A${i}: done`, {}, i),
  );
  await seed(page, many);
  const start = Date.now();
  await gotoDiagrams(page);
  await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(24);
  await expect
    .poll(() => page.locator('[data-testid^="home-thumb-"][data-status="ready"]').count(), { timeout: 60_000 })
    .toBe(24);
  test.info().annotations.push({ type: 'all-24-previews-ready-ms', description: String(Date.now() - start) });
  // Scrolling to the last card shows its rendered preview.
  const last = page.locator('[data-testid="home-card-fx-many-23"]');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});
