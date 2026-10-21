import { test, expect } from '@playwright/test';
import { TEMPLATES } from '../src/domain/templates';

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

for (const target of ['X', 'VeryLongParticipantName']) {
  test(`Blue creation geometry reaches the ${target} header border and centers its activation`, async ({ page }) => {
    await page.addInitScript((flags: Record<string, string>) => {
      for (const [key, value] of Object.entries(flags)) localStorage.setItem(key, value);
    }, SEED_FLAGS);
    const blue = TEMPLATES.find(t => t.id === 'blue')!.item;
    const item = { ...blue, js: blue.js!.replace('new X()', `new ${target}()`) };
    await page.goto(`/?code=${encodeURIComponent(JSON.stringify(item))}`);
    const preview = page.locator('iframe[title="ZenUML preview"]');
    await expect.poll(async () => preview.evaluate((iframe, participant) => {
      const doc = (iframe as HTMLIFrameElement).contentDocument;
      const creation = doc?.querySelector('.creation');
      const header = [...(doc?.querySelectorAll('.lifeline .participant') ?? [])]
        .find(el => el.parentElement?.id === participant);
      const lifeline = [...(doc?.querySelectorAll('.lifeline .line') ?? [])]
        .find(el => el.parentElement?.id === participant);
      const message = creation?.querySelector('.message');
      const arrow = message?.querySelector('svg:last-of-type');
      const occurrence = creation?.querySelector('.occurrence');
      if (!header || !lifeline || !arrow || !occurrence || !message) return null;
      const h = header.getBoundingClientRect();
      const l = lifeline.getBoundingClientRect();
      const a = arrow.getBoundingClientRect();
      const o = occurrence.getBoundingClientRect();
      return {
        arrowToHeader: Math.abs(a.right - h.left),
        arrowY: Math.abs((a.top + a.height / 2) - (h.top + h.height / 2)),
        activationX: Math.abs((o.left + o.width / 2) - (l.left + l.width / 2)),
        activationTopFromBorder: o.top - h.bottom,
        participantFill: getComputedStyle(header).backgroundColor,
      };
    }, target)).toMatchObject({ participantFill: 'rgba(146, 192, 240, 0.3)' });
    const measured = await preview.evaluate((iframe, participant) => {
      const doc = (iframe as HTMLIFrameElement).contentDocument!;
      const creation = doc.querySelector('.creation')!;
      const header = [...doc.querySelectorAll('.lifeline .participant')].find(el => el.parentElement?.id === participant)!;
      const lifeline = [...doc.querySelectorAll('.lifeline .line')].find(el => el.parentElement?.id === participant)!;
      const arrow = creation.querySelector('.message svg:last-of-type')!;
      const line = creation.querySelector('.message svg:first-of-type')!;
      const occurrence = creation.querySelector('.occurrence')!;
      const h = header.getBoundingClientRect(), l = lifeline.getBoundingClientRect();
      const a = arrow.getBoundingClientRect(), o = occurrence.getBoundingClientRect();
      return {
        arrowToHeader: Math.abs(a.right - h.left),
        lineToHeader: Math.abs(line.getBoundingClientRect().right - h.left),
        arrowY: Math.abs((a.top + a.height / 2) - (h.top + h.height / 2)),
        activationX: Math.abs((o.left + o.width / 2) - (l.left + l.width / 2)),
        activationTopFromBorder: o.top - h.bottom,
      };
    }, target);
    expect(measured.arrowToHeader).toBeLessThan(1);
    expect(measured.lineToHeader).toBeLessThan(1);
    expect(measured.arrowY).toBeLessThan(1);
    expect(measured.activationX).toBeLessThan(1);
    expect(measured.activationTopFromBorder).toBeCloseTo(-2, 0);
  });
}

test('Blue nested activations remain centered on their lifelines', async ({ page }) => {
  await openLibrary(page);
  await page.getByTestId('home-template-blue').click();
  const preview = page.locator('iframe[title="ZenUML preview"]');
  await expect.poll(async () => preview.evaluate((iframe) => {
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    if (!doc?.querySelector('.occurrence[data-belongs-to="MF"]')) return null;
    return ['SGW', 'svc', 'rep', 'MF'].map(name => {
      const line = doc.querySelector(`.lifeline#${name} > .line`);
      const occurrence = doc.querySelector(`.occurrence[data-belongs-to="${name}"]`);
      if (!line || !occurrence) return null;
      const l = line.getBoundingClientRect(), o = occurrence.getBoundingClientRect();
      return Math.abs(o.left + o.width / 2 - l.left - l.width / 2);
    });
  })).toEqual([0, 0, 0, 0]);
});

test('Blue translucent headers do not overlay a painted lifeline', async ({ page }) => {
  await openLibrary(page);
  await page.getByTestId('home-template-blue').click();
  const preview = page.locator('iframe[title="ZenUML preview"]');
  await expect.poll(async () => preview.evaluate((iframe) => {
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    if (!doc?.querySelector('.participant[data-participant-id="X"]')) return null;
    return ['Client', 'X'].map(name => {
      const line = doc.querySelector(`.lifeline#${name} > .line`);
      const header = doc.querySelector(`.participant[data-participant-id="${name}"]`);
      if (!line || !header) return null;
      const l = line.getBoundingClientRect(), h = header.getBoundingClientRect();
      const parent = line.parentElement!.getBoundingClientRect();
      return {
        headerGap: l.top - h.bottom,
        bottomGap: parent.bottom - l.bottom,
        fill: getComputedStyle(header).backgroundColor,
      };
    });
  })).toEqual([
    { headerGap: 0, bottomGap: 0, fill: 'rgba(146, 192, 240, 0.3)' },
    { headerGap: 0, bottomGap: 0, fill: 'rgba(146, 192, 240, 0.3)' },
  ]);
});

test('Blue header height variable keeps ordinary and created line starts in step', async ({ page }) => {
  await openLibrary(page);
  await page.getByTestId('home-template-blue').click();
  const preview = page.locator('iframe[title="ZenUML preview"]');
  await expect.poll(async () => preview.evaluate(iframe =>
    Boolean((iframe as HTMLIFrameElement).contentDocument?.querySelector('.participant[data-participant-id="X"]')),
  )).toBe(true);
  const measured = await preview.evaluate(iframe => {
    const doc = (iframe as HTMLIFrameElement).contentDocument!;
    (doc.querySelector('.sequence-diagram') as HTMLElement).style.setProperty('--blue-participant-height', '3rem');
    return ['Client', 'X'].map(name => {
      const line = doc.querySelector(`.lifeline#${name} > .line`)!;
      const header = doc.querySelector(`.participant[data-participant-id="${name}"]`)!;
      const l = line.getBoundingClientRect(), h = header.getBoundingClientRect();
      return { headerHeight: h.height, headerGap: l.top - h.bottom, bottomGap: line.parentElement!.getBoundingClientRect().bottom - l.bottom };
    });
  });
  expect(measured).toEqual([
    { headerHeight: 48, headerGap: 0, bottomGap: 0 },
    { headerHeight: 48, headerGap: 0, bottomGap: 0 },
  ]);
});
