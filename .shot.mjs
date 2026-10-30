// usage: node shot.mjs <out.png> <width> <height> [dark]
import { chromium } from '@playwright/test';
const [out, w, h, mode] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.addInitScript(() => { localStorage.setItem('onboarded','true'); localStorage.setItem('pledgeModalSeen','true'); localStorage.setItem('lastSeenVersion', JSON.stringify('99.0.0')); });
if (mode === 'dark') await page.addInitScript(() => localStorage.setItem('appearance', JSON.stringify('dark')));
await page.goto('http://localhost:4411/');
await page.waitForTimeout(4000);
await page.screenshot({ path: out });
const info = await page.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  return { header: q('header'), preview: q('.editor-preview-panel'), editor: q('[data-testid=editor-region]'), overflowX: document.documentElement.scrollWidth > innerWidth };
});
console.log(JSON.stringify(info));
await browser.close();
