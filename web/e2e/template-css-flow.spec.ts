import { test, expect } from '@playwright/test';

const SEED_FLAGS: Record<string, string> = {
  lastSeenVersion: '"9999.0.0"',
  pledgeModalSeen: 'true',
  loginAndsaveMessageSeen: 'true',
};

async function expectBlueTemplatePreview(page: import('@playwright/test').Page) {
  await expect(page.getByLabel('Diagram title')).toHaveValue('Advanced');
  await expect(page.getByLabel('CSS pre-processor mode')).toHaveText('Less');

  const preview = page.locator('iframe[title="ZenUML preview"]');
  await expect.poll(async () => preview.evaluate((iframe) => {
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    const participant = doc?.querySelector('.participant');
    const message = doc?.querySelector('.message svg');
    const canvas = doc?.querySelector('.bg-skin-canvas');
    if (!participant || !message || !canvas) return null;
    return {
      stylesheet: doc.querySelector<HTMLStyleElement>('#zenumlstyle')?.textContent?.includes('#032C72') ?? false,
      participantBackground: getComputedStyle(participant).backgroundColor,
      participantBorder: getComputedStyle(participant).borderTopColor,
      messageColor: getComputedStyle(message).color,
      canvasBackground: getComputedStyle(canvas).backgroundColor,
    };
  })).toEqual({
    stylesheet: true,
    participantBackground: 'rgba(146, 192, 240, 0.3)',
    participantBorder: 'rgb(3, 44, 114)',
    messageColor: 'rgb(3, 44, 114)',
    canvasBackground: 'rgb(255, 255, 255)',
  });
}

async function openLibrary(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Record<string, string>) => {
    for (const [key, value] of Object.entries(flags)) localStorage.setItem(key, value);
  }, SEED_FLAGS);

  await page.goto('/?view=diagrams', { waitUntil: 'networkidle' });
}

test('Blue template carries its Less CSS from the library card into the live preview', async ({ page }) => {
  await openLibrary(page);
  await page.getByTestId('home-template-blue').click();
  await expectBlueTemplatePreview(page);
});

test('Blue template carries its Less CSS through the full template picker', async ({ page }) => {
  await openLibrary(page);
  await page.getByTestId('home-empty-templates').click();
  await page.getByTestId('create-template-blue').click();
  await expectBlueTemplatePreview(page);
});

for (const { id, compiledCssNeedle, background, border } of [
  { id: 'black-white', compiledCssNeedle: '#000', background: 'rgb(255, 255, 255)', border: 'rgb(0, 0, 0)' },
  { id: 'blue', compiledCssNeedle: '#032C72', background: 'rgba(146, 192, 240, 0.3)', border: 'rgb(3, 44, 114)' },
  { id: 'starUMLTheme', compiledCssNeedle: '#b94065', background: 'rgb(255, 254, 200)', border: 'rgb(185, 64, 101)' },
]) {
test(`the ${id} library template applies its compiled CSS to the created preview`, async ({ page }) => {
  await openLibrary(page);
  await page.getByTestId(`home-template-${id}`).click();
  await expect(page.getByLabel('CSS pre-processor mode')).toHaveText('Less');

  const preview = page.locator('iframe[title="ZenUML preview"]');
  await expect.poll(async () => preview.evaluate((iframe, expectedCompiledCssNeedle) => {
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    const participant = doc?.querySelector('.participant');
    const css = doc?.querySelector<HTMLStyleElement>('#zenumlstyle')?.textContent ?? '';
    if (!participant) return null;
    return {
      cssApplied: css.includes(expectedCompiledCssNeedle) && css.includes('#diagram .sequence-diagram'),
      background: getComputedStyle(participant).backgroundColor,
      border: getComputedStyle(participant).borderTopColor,
    };
  }, compiledCssNeedle)).toEqual({ cssApplied: true, background, border });
});
}
