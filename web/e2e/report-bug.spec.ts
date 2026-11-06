import { test, expect } from '@playwright/test';
import { seedAndOpen } from './helpers/editor';

test('Report-a-bug FAB opens the modal and builds a prefilled GitHub URL', async ({ page }) => {
  // Capture window.open instead of spawning a real tab. addInitScript must run
  // before navigation, so register it before seedAndOpen (which calls page.goto).
  await page.addInitScript(() => {
    (window as unknown as { __lastOpen?: string }).__lastOpen = undefined;
    window.open = ((url?: string | URL) => {
      (window as unknown as { __lastOpen?: string }).__lastOpen = String(url);
      return null;
    }) as typeof window.open;
  });

  await seedAndOpen(page);

  const fab = page.getByTestId('report-bug-fab');
  await expect(fab).toBeVisible();
  await fab.click();

  const modal = page.getByTestId('report-bug-modal');
  await expect(modal).toBeVisible();

  // Screenshot the open modal for the milestone gallery.
  await page.screenshot({ path: 'test-results/report-bug-modal.png' });

  await page.getByTestId('report-bug-description').fill('Arrows render upside down on page 2');
  const submit = page.getByTestId('report-bug-submit');
  await expect(submit).toBeEnabled();
  await submit.click();

  const opened = await page.evaluate(
    () => (window as unknown as { __lastOpen?: string }).__lastOpen,
  );
  expect(opened).toContain('github.com/ZenUml/web-sequence/issues/new');
  expect(opened).toContain('Arrows');
});
