import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../../../package.json'));
const { chromium } = require('playwright');

const dir = resolve(dirname(fileURLToPath(import.meta.url)), 'screenshots');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4473/', { waitUntil: 'networkidle' });

async function shot(name, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

await shot('1440-light-dark', 1440);
await page.locator('#kb-input').click();
await page.keyboard.type('Hello');
const typed = await page.locator('#kb-input').inputValue();
await page.locator('#kb-select').focus();
await page.keyboard.press('ArrowDown');
await page.locator('[role="listbox"]').waitFor();
const selectOpen = await page.locator('[role="listbox"]').evaluate((el) => ({
  surface: el.getAttribute('data-ui-surface'),
  className: el.className,
}));
await page.screenshot({ path: `${dir}/1440-select-open.png` });
await page.keyboard.press('Enter');
const selectValue = await page.locator('#kb-select').innerText();
await page.locator('#kb-menu').focus();
await page.keyboard.press('Enter');
await page.locator('[role="menu"]').waitFor();
const menu = await page.locator('[role="menu"]').evaluate((el) => ({
  surface: el.getAttribute('data-ui-surface'),
  className: el.className,
}));
await page.screenshot({ path: `${dir}/1440-menu-open.png` });
await page.keyboard.press('Escape');
const focusAfterEscape = await page.evaluate(() => document.activeElement && document.activeElement.id);
const primary = page.locator('#surface-light [data-measure="light-primary-default"]').locator('xpath=..').locator('button');
await primary.hover();
await page.waitForTimeout(200);
const hovered = await primary.evaluate((el) => ({
  bg: getComputedStyle(el).backgroundColor,
  hover: el.matches(':hover'),
}));
await page.evaluate(() => document.querySelector('#surface-light').scrollIntoView());
await page.screenshot({ path: `${dir}/1440-primary-hover.png` });
await page.evaluate(() => document.querySelector('#overrides').scrollIntoView());
await page.screenshot({ path: `${dir}/1440-overrides.png` });
await shot('390-light-dark', 390);
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => document.querySelector('#surface-dark').scrollIntoView());
await page.screenshot({ path: `${dir}/390-dark.png` });
await page.evaluate(() => document.querySelector('#overrides').scrollIntoView());
await page.screenshot({ path: `${dir}/390-overrides.png` });
console.log(JSON.stringify({ typed, selectOpen, selectValue, menu, focusAfterEscape, hovered }, null, 2));
await browser.close();
