import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('lastSeenVersion', '"9999.0.0"');
    localStorage.setItem('pledgeModalSeen', 'true');
    localStorage.setItem('loginAndsaveMessageSeen', 'true');
  });
  await page.goto('/');
  await expect(page.frameLocator('iframe[title="ZenUML preview"]').locator('.participant').first()).toBeVisible();
}

async function readSurface(page: Page) {
  return page.locator('iframe[title="ZenUML preview"]').evaluate((iframe) => {
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    const canvas = doc?.querySelector('.bg-skin-canvas');
    const outer = iframe.parentElement?.closest('.editor-preview-canvas');
    if (!canvas || !outer) return null;
    return {
      canvas: getComputedStyle(canvas).backgroundColor,
      outer: getComputedStyle(outer).backgroundColor,
      body: getComputedStyle(doc!.body).backgroundColor,
    };
  });
}

test('workspace backing stays host-owned across document theme switches', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('header-appearance').click();
  await expect(page.locator('iframe[title="ZenUML preview"]')).toHaveCSS('color-scheme', 'normal');
  await expect.poll(() => readSurface(page)).toEqual({ canvas: 'rgba(0, 0, 0, 0)', outer: 'rgb(52, 63, 75)', body: 'rgba(0, 0, 0, 0)' });
  await page.getByTestId('header-appearance').click();
  await expect.poll(() => readSurface(page)).toEqual({ canvas: 'rgba(0, 0, 0, 0)', outer: 'rgb(255, 255, 255)', body: 'rgba(0, 0, 0, 0)' });
  await page.getByTestId('header-appearance').click();
  await expect.poll(() => readSurface(page)).toEqual({ canvas: 'rgba(0, 0, 0, 0)', outer: 'rgb(52, 63, 75)', body: 'rgba(0, 0, 0, 0)' });
});

test('CSS-only paint changes the document canvas while the host backing stays fixed', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('header-appearance').click();
  // Custom CSS editing is account-gated in the UI. Send the same updateCss
  // message the host uses so this signed-out browser fixture covers the renderer.
  await page.locator('iframe[title="ZenUML preview"]').evaluate((iframe) =>
    (iframe as HTMLIFrameElement).contentWindow?.postMessage({
      type: 'updateCss',
      css: '#diagram .bg-skin-canvas { background: #abc123 !important; }',
    }, '*'),
  );
  await expect.poll(() => page.frameLocator('iframe[title="ZenUML preview"]').locator('#zenumlstyle').textContent()).toContain('#abc123');
  await expect.poll(() => readSurface(page)).toEqual({
    canvas: 'rgb(171, 193, 35)', outer: 'rgb(52, 63, 75)', body: 'rgba(0, 0, 0, 0)',
  });
  await page.frameLocator('iframe[title="ZenUML preview"]').locator('body').evaluate(() =>
    parent.postMessage({ type: 'surface', token: -1, cssRevision: -1, backgroundColor: '#ff0000' }, '*'),
  );
  expect((await readSurface(page))?.outer).toBe('rgb(52, 63, 75)');
});

test('explicit light Blue template stays light inside dark app chrome', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('header-appearance').click();
  await page.goto('/?view=diagrams');
  await page.getByTestId('home-template-blue').click();
  await expect(page.getByLabel('Diagram title')).toHaveValue('Advanced');
  await expect.poll(() => readSurface(page)).toMatchObject({
    canvas: 'rgb(255, 255, 255)', outer: 'rgb(52, 63, 75)', body: 'rgba(0, 0, 0, 0)',
  });
});

test('mobile SVG and Present keep the host dark workspace', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('header-appearance').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.frameLocator('iframe[title="ZenUML preview"]').locator('#svg-mount > svg')).toBeVisible();
  await expect.poll(async () => (await readSurface(page))?.outer).toBe('rgb(52, 63, 75)');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('header-present').click();
  await expect(page.locator('.editor-preview-panel--fullscreen')).toBeVisible();
  await expect.poll(async () => (await readSurface(page))?.outer).toBe('rgb(52, 63, 75)');
});

test('mobile native SVG PNG preview preserves transparent outer corners', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('header-appearance').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.frameLocator('iframe[title="ZenUML preview"]').locator('#svg-mount > svg')).toBeVisible();
  await page.getByTestId('renderer-download').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  await page.getByLabel('Export theme').click();
  await page.getByRole('option', { name: 'Match current theme' }).click();
  const image = page.getByAltText('Diagram export preview');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const corners = await image.evaluate((img) => {
    const source = img as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 0, 0);
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    return [pixel(0, 0), pixel(canvas.width - 1, 0), pixel(0, canvas.height - 1), pixel(canvas.width - 1, canvas.height - 1)];
  });
  expect(corners.map(([, , , alpha]) => alpha)).toEqual([0, 0, 0, 0]);
});
