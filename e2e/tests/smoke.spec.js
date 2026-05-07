import { test, expect } from '@playwright/test';

const SAVE_KEY = process.platform === 'darwin' ? 'Meta+s' : 'Control+s';

test.beforeEach(async ({ page }) => {
  // Suppress the first-save confirm() dialog that fires for unsigned-in users.
  // See src/components/app.jsx:845 — the dialog blocks headless runs.
  await page.addInitScript(() => {
    window.localStorage.setItem('loginAndsaveMessageSeen', 'true');
  });

  // Surface uncaught page errors as test failures.
  page.on('pageerror', (err) => {
    throw err;
  });

  await page.goto('/');
});

test('app loads with editor and diagram preview visible', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await expect(page.locator('#demo-frame')).toBeAttached();
});

test('editor renders default content and diagram renders', async ({ page }) => {
  // CodeMirror has been mounted and shows non-empty text.
  const editorText = page.locator('.CodeMirror .CodeMirror-code').first();
  await expect(editorText).toBeVisible();
  await expect(editorText).not.toBeEmpty();

  // The diagram iframe must contain at least one SVG produced by @zenuml/core.
  // Webkit's frameLocator times out here; reach through contentDocument instead.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            !!document.getElementById('demo-frame')?.contentDocument?.querySelector('svg'),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
});

test('updating editor content updates the rendered diagram', async ({ page }) => {
  // Wait for CodeMirror to mount, then call its API directly. Synthetic key
  // events through page.keyboard.type don't reliably trigger CodeMirror v5's
  // change pipeline, so the preview never re-renders.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.evaluate(() => {
    const wrapper = document.querySelector('.CodeMirror');
    wrapper.CodeMirror.setValue('A->B: Hello smoke test');
  });

  // Diagram re-render is debounced; the rendered text lives in SVG nodes
  // inside the iframe, which Playwright's `getByText` can miss. Poll the
  // iframe's full body content instead.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            document.getElementById('demo-frame')?.contentDocument?.body
              ?.textContent || '',
        ),
      { timeout: 15_000 },
    )
    .toContain('Hello smoke test');
});

test('Cmd/Ctrl+S persists an item to localStorage', async ({ page }) => {
  // Editor must be focused for the keyboard shortcut to register.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(SAVE_KEY);

  // Save is complete when a new `item-...` key appears AND the `items` index
  // points at it. Length comparisons would be brittle: Firebase init writes
  // transient keys that come and go independently of the save.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const keys = Object.keys(window.localStorage);
          const itemKey = keys.find((k) => k.startsWith('item-'));
          if (!itemKey) return null;
          let items = {};
          try {
            items = JSON.parse(window.localStorage.getItem('items') || '{}');
          } catch {
            return null;
          }
          return items[itemKey] === true ? itemKey : null;
        }),
      { timeout: 10_000 },
    )
    .not.toBeNull();
});

test('Cheatsheet sidebar button opens the cheatsheet modal', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Cheatsheet').click();
  // CheatSheetModal renders via Radix UI Dialog with title "Cheat sheet".
  await expect(page.getByRole('dialog').filter({ hasText: 'Cheat sheet' })).toBeVisible();
});

test('Keyboard Shortcuts sidebar button opens the shortcuts modal', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Keyboard Shortcuts').click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Keyboard Shortcuts' })).toBeVisible();
});

test('Settings sidebar button opens the settings modal', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Settings').click();
  // SettingsModal is a Radix dialog. Match it by its unique "Line wrap"
  // toggle label so this test never overlaps with other open dialogs.
  await expect(page.getByRole('dialog').filter({ hasText: 'Line wrap' })).toBeVisible();
});

test('clicking the diagram title opens the inline title editor', async ({ page }) => {
  // MainHeader renders the title as a clickable <span> until clicked, then
  // swaps in an <input id="titleInput">. The CSS tab would have made a poor
  // smoke test here: clicking it triggers a login prompt for unsigned-in
  // users (CSS is a premium feature, see ContentWrap.onCSSActiviation).
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByText('Untitled').first().click();
  await expect(page.locator('#titleInput')).toBeVisible();
});

test('My Library sidebar button reveals the library panel', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('My Library').click();
  await expect(page.locator('#librarySearchInput')).toBeVisible();
});

test('Add Page button creates a second page tab', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const addPage = page.getByTitle('Add new page');
  await expect(addPage).toBeVisible();
  await addPage.click();

  // The first run shows "Page 1"; after Add Page there should be at least
  // two page tabs. Tabs render as buttons containing the page title text.
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('button, [role="tab"]'))
          .map((el) => el.textContent || '')
          .filter((t) => /^Page \d+$/.test(t.trim()));
        return labels.length;
      }),
    { timeout: 5_000 },
  ).toBeGreaterThanOrEqual(2);
});
