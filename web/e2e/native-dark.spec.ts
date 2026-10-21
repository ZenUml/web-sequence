import { expect, test } from '@playwright/test';

test('dark appearance uses the published native diagram skin', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lastSeenVersion', '"9999.0.0"');
    localStorage.setItem('pledgeModalSeen', 'true');
    localStorage.setItem('loginAndsaveMessageSeen', 'true');
  });
  await page.goto('/');
  await page.getByTestId('header-appearance').click();

  const frame = page.frameLocator('iframe[title="ZenUML preview"]');
  await expect(frame.locator('.participant').first()).toBeVisible();
  await expect.poll(() => frame.locator('body').evaluate((body) => {
    const doc = body.ownerDocument;
    const canvas = doc.querySelector('.bg-skin-canvas');
    const participant = doc.querySelector('.participant');
    const message = doc.querySelector('.message');
    const lifeline = doc.querySelector('.lifeline .line');
    if (!canvas || !participant || !message || !lifeline) return null;
    const skin = getComputedStyle(canvas);
    return {
      version: (window as typeof window & { zenuml?: { default?: { version?: string } } }).zenuml?.default?.version,
      nativeClass: canvas.classList.contains('theme-dark'),
      canvas: skin.backgroundColor,
      participant: getComputedStyle(participant).color,
      lifeline: getComputedStyle(lifeline).getPropertyValue('--color-border-base').trim(),
      message: getComputedStyle(message).color,
      arrow: skin.getPropertyValue('--color-message-arrow').trim(),
    };
  })).toEqual({
    version: '4.8.1',
    nativeClass: true,
    canvas: 'rgb(31, 31, 31)',
    participant: 'rgb(251, 251, 251)',
    lifeline: '#e1e1e1',
    message: 'rgb(251, 251, 251)',
    arrow: '#ffffff',
  });
});
