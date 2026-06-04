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

test('app loads with editor and diagram preview visible @smoke', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await expect(page.locator('#demo-frame')).toBeAttached();
});

test('editor renders default content and diagram renders @smoke', async ({ page }) => {
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

test('Escape key closes the cheatsheet modal', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Cheatsheet').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Cheat sheet' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('default diagram includes the BookLibService example participants', async ({ page }) => {
  // The shipped default diagram renders a RESTful book endpoint scenario
  // with several named participants. Asserting on the rendered iframe text
  // catches regressions in either the parser or the default snippet.
  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          document.getElementById('demo-frame')?.contentDocument?.body
            ?.textContent || '',
      ),
    { timeout: 15_000 },
  ).toContain('BookLibService');
});

test('alertsService surfaces a startup "New item created" toast', async ({ page }) => {
  // Visit /, then assert #js-alerts-container picks up the toast that
  // `createNewItem` fires on first-load. The toast's `is-active` class is
  // removed after 2s; firefox can boot slowly enough that by the time the
  // poll starts the class is already gone, so we assert on textContent
  // directly which persists.
  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          document.getElementById('js-alerts-container')?.textContent || '',
      ),
    { timeout: 8_000 },
  ).toContain('New item created');
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

test('two consecutive Add Page clicks create three total page tabs', async ({ page }) => {
  // Multiple Add Page invocations should each append a new tab and renumber
  // ("Page 1", "Page 2", "Page 3"). This guards the page-counter logic in
  // app.addNewPage without relying on intricate per-editor content swap
  // semantics (which differs between the sidebar editor and ContentWrap).
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Add new page').click();
  await page.getByTitle('Add new page').click();

  await expect.poll(
    async () =>
      page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('button'))
          .map((el) => (el.textContent || '').trim())
          .filter((t) => /^Page \d+$/.test(t));
        return new Set(labels).size;
      }),
    { timeout: 5_000 },
  ).toBeGreaterThanOrEqual(3);
});

test('renaming the diagram title via the input persists in the header', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByText('Untitled').first().click();
  const input = page.locator('#titleInput');
  await expect(input).toBeVisible();
  await input.fill('Smoke Renamed');
  // titleInputBlurHandler fires on blur.
  await input.blur();
  // Header re-renders to a span with the new title.
  await expect(page.getByText('Smoke Renamed')).toBeVisible();
});

test('saved item in localStorage has the new pages-array shape', async ({ page }) => {
  // Cmd+S writes the item via itemService.setItem; new items must conform
  // to the multi-page schema (pages: [{id, title, js, ...}]).
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(SAVE_KEY);

  await expect.poll(
    async () =>
      page.evaluate(() => {
        const itemKey = Object.keys(window.localStorage).find((k) => k.startsWith('item-'));
        if (!itemKey) return null;
        try {
          return JSON.parse(window.localStorage.getItem(itemKey));
        } catch {
          return null;
        }
      }),
    { timeout: 10_000 },
  ).not.toBeNull();

  const saved = await page.evaluate(() => {
    const itemKey = Object.keys(window.localStorage).find((k) => k.startsWith('item-'));
    return JSON.parse(window.localStorage.getItem(itemKey));
  });
  expect(saved).toHaveProperty('id');
  expect(saved).toHaveProperty('pages');
  expect(Array.isArray(saved.pages)).toBe(true);
  expect(saved.pages.length).toBeGreaterThanOrEqual(1);
  expect(typeof saved.pages[0].id).toBe('string');
});

test('main app container mounts under #app', async ({ page }) => {
  // Sanity guard: index.html ships an empty `<div id="app"></div>` and the
  // Preact app mounts into it. The wrapper itself is layout-only (Playwright
  // calls it `hidden` because it has no visible box of its own), so we assert
  // on its children count rather than visibility.
  await expect(page.locator('#app')).toBeAttached();
  await expect.poll(
    async () =>
      page.evaluate(() => document.getElementById('app')?.children.length || 0),
    { timeout: 10_000 },
  ).toBeGreaterThan(0);
});

test('preview iframe successfully loads the @zenuml/core UMD bundle @smoke', async ({ page }) => {
  // Regression for the Vite shim plugin in vite.config.js. If the shim breaks,
  // the iframe's <script src> would 404 and `window.zenuml` would never appear.
  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          typeof document.getElementById('demo-frame')?.contentWindow?.zenuml,
      ),
    { timeout: 15_000 },
  ).not.toBe('undefined');
});

test('Cmd/Ctrl+S twice does not create a duplicate localStorage item', async ({ page }) => {
  // saveItem assigns an id once and reuses it on subsequent saves. Two
  // consecutive saves must leave exactly one `item-...` key behind.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(SAVE_KEY);

  const countItemKeys = () =>
    page.evaluate(
      () =>
        Object.keys(window.localStorage).filter((k) => k.startsWith('item-')).length,
    );

  await expect.poll(countItemKeys, { timeout: 10_000 }).toBe(1);

  await page.keyboard.press(SAVE_KEY);
  // Give it a moment in case a duplicate were to be written, then reassert.
  await page.waitForTimeout(500);
  expect(await countItemKeys()).toBe(1);
});

test('multi-message diagram renders every interaction label', async ({ page }) => {
  // Drive the editor with a 3-message ZenUML source and verify each label
  // appears in the rendered iframe. Guards both the parser and renderer.
  // Wait for bootstrap to complete (default diagram visible) before setValue,
  // otherwise the app's `createNewItem` can race-write the default and
  // clobber our value.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  await page.evaluate(() => {
    const wrapper = document.querySelector('.CodeMirror');
    wrapper.CodeMirror.setValue('Alice->Bob: hi\nBob->Charlie: yo\nCharlie->Alice: ack');
  });

  // Single poll for all three labels at once — avoids racing on partial renders.
  await expect.poll(
    async () => {
      const t = await previewText();
      return t.includes('hi') && t.includes('yo') && t.includes('ack');
    },
    { timeout: 15_000 },
  ).toBe(true);
});

test('Add Page → Delete returns to a single Page 1 tab', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Add new page').click();

  // The delete button is opacity-0 unless hovered; force the click.
  await page.getByTitle('Delete page').first().click({ force: true });
  // DeletePageModal is a Radix dialog with title "Confirm to Delete".
  const confirmModal = page.getByRole('dialog').filter({ hasText: 'Confirm to Delete' });
  await expect(confirmModal).toBeVisible();
  await confirmModal.getByRole('button', { name: /^Delete$/ }).click();

  await expect.poll(
    async () =>
      page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('button'))
          .map((el) => (el.textContent || '').trim())
          .filter((t) => /^Page \d+$/.test(t));
        return new Set(labels).size;
      }),
    { timeout: 5_000 },
  ).toBe(1);
});

test('saved item captures the user-typed editor content', async ({ page }) => {
  // Wait for bootstrap so createNewItem doesn't clobber our typed content,
  // then setValue, save, and assert pages[0].js contains what we typed.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          document.getElementById('demo-frame')?.contentDocument?.body
            ?.textContent || '',
      ),
    { timeout: 15_000 },
  ).toContain('BookLibService');

  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue('Foo->Bar: smoke-content');
  });
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(SAVE_KEY);

  await expect.poll(
    async () =>
      page.evaluate(() => {
        const itemKey = Object.keys(window.localStorage).find((k) =>
          k.startsWith('item-'),
        );
        if (!itemKey) return null;
        try {
          const item = JSON.parse(window.localStorage.getItem(itemKey));
          return item?.pages?.[0]?.js || item?.js || '';
        } catch {
          return null;
        }
      }),
    { timeout: 10_000 },
  ).toContain('smoke-content');
});

test('Code Editor sidebar button hides the editor when toggled off', async ({ page }) => {
  // Default state: activeLeftPanel === 'editor', isEditorPanelOpen === true.
  // Clicking "Code Editor" calls onToggleEditorPanel, flipping isEditorPanelOpen.
  // The CodeMirror in the editor area becomes detached/hidden as a result.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('Code Editor').click();

  // After toggle-off the visible CodeMirror should drop to zero (the
  // ContentWrap editor is hidden via the hideEditor prop).
  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll('.CodeMirror'))
            .filter((el) => el.offsetParent !== null).length,
      ),
    { timeout: 5_000 },
  ).toBe(0);
});

test('Library panel search input accepts text', async ({ page }) => {
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await page.getByTitle('My Library').click();

  const search = page.locator('#librarySearchInput');
  await expect(search).toBeVisible();
  await search.fill('search-smoke');
  await expect(search).toHaveValue('search-smoke');
});

test('editor renders the CodeMirror line-number gutter', async ({ page }) => {
  // EditorPanel and ContentWrap configure 'CodeMirror-linenumbers' in
  // gutters. The gutter element should always be in the DOM under the
  // visible editor.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await expect(page.locator('.CodeMirror-linenumbers').first()).toBeAttached();
});

test('self-message diagram renders without dropping the label', async ({ page }) => {
  // A self-call (A->A) is a parser edge case worth guarding.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue('Alice->Alice: introspect');
  });
  await expect.poll(previewText, { timeout: 15_000 }).toContain('introspect');
});

test('comment lines do not break diagram rendering', async ({ page }) => {
  // ZenUML supports // single-line comments. A comment plus a real message
  // must still render the message (no crash, no missing label).
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue(
      '// this is a smoke comment\nClient->Server: ping',
    );
  });
  await expect.poll(previewText, { timeout: 15_000 }).toContain('ping');
});

test('default item title at startup is "Untitled"', async ({ page }) => {
  // No saved item, no auth → MainHeader falls back to "Untitled".
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  await expect(page.getByText('Untitled').first()).toBeVisible();
});

test('saved item survives a page reload with its content intact', async ({ page }) => {
  // The biggest persistence guarantee: type → save → reload → content is back.
  // beforeEach's addInitScript fires on every navigation, so the
  // loginAndsaveMessageSeen flag is re-set for the post-reload load.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue('Foo->Bar: reload-survives');
  });
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(SAVE_KEY);

  // Wait for the save to land in localStorage before reloading.
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const itemKey = Object.keys(window.localStorage).find((k) =>
          k.startsWith('item-'),
        );
        if (!itemKey) return null;
        try {
          const item = JSON.parse(window.localStorage.getItem(itemKey));
          return item?.pages?.[0]?.js || '';
        } catch {
          return null;
        }
      }),
    { timeout: 10_000 },
  ).toContain('reload-survives');

  await page.reload();

  // After reload the localStorage entry must still be there with the same content.
  // We don't assert on the post-reload editor view because the app's bootstrap
  // creates a fresh "Untitled" item by default (it doesn't auto-load the most
  // recent save without auth) — what we're guarding here is the storage layer,
  // not the unsigned-in restore behaviour.
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const itemKey = Object.keys(window.localStorage).find((k) =>
          k.startsWith('item-'),
        );
        if (!itemKey) return null;
        try {
          const item = JSON.parse(window.localStorage.getItem(itemKey));
          return item?.pages?.[0]?.js || '';
        } catch {
          return null;
        }
      }),
    { timeout: 10_000 },
  ).toContain('reload-survives');
});

test('multi-page item persists per-page content into the pages array', async ({ page }) => {
  // The multi-page schema's contract: each page owns its own `js` field and
  // saving must capture them independently. Trying to assert on the editor
  // DOM after tab-switching is brittle (sidebar EditorPanel + ContentWrap
  // both render .CodeMirror, sync isn't always synchronous). Asserting on
  // the saved localStorage payload is the truer test of isolation.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  // Add a second page (switches to Page 2), type unique content, save.
  await page.getByTitle('Add new page').click();
  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue('Alice->Bob: page-two-only');
  });
  await page.locator('.CodeMirror').first().click();
  await page.keyboard.press(SAVE_KEY);

  // Wait for the save to land with both pages in the array.
  await expect.poll(
    async () =>
      page.evaluate(() => {
        const itemKey = Object.keys(window.localStorage).find((k) =>
          k.startsWith('item-'),
        );
        if (!itemKey) return null;
        try {
          const item = JSON.parse(window.localStorage.getItem(itemKey));
          return item?.pages?.length || 0;
        } catch {
          return 0;
        }
      }),
    { timeout: 10_000 },
  ).toBe(2);

  const saved = await page.evaluate(() => {
    const itemKey = Object.keys(window.localStorage).find((k) =>
      k.startsWith('item-'),
    );
    return JSON.parse(window.localStorage.getItem(itemKey));
  });

  // Page 2 (the active one when we typed) must hold our content; Page 1 must
  // not. Which index is which can vary, so check by content rather than index.
  const pageWithTyped = saved.pages.find((p) => (p.js || '').includes('page-two-only'));
  const pageWithoutTyped = saved.pages.find((p) => !(p.js || '').includes('page-two-only'));
  expect(pageWithTyped).toBeTruthy();
  expect(pageWithoutTyped).toBeTruthy();
  // The other page must not have leaked our typed content.
  expect(pageWithoutTyped.js || '').not.toContain('page-two-only');
});

test('if/else fragment renders both branch labels', async ({ page }) => {
  // ZenUML uses JS-like syntax for fragments (see CheatSheetModal). The if/else
  // path exercises the parser's alt-fragment handling and the renderer's
  // multi-branch layout.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue(
      'if (cond) {\n  A.branchOne()\n} else {\n  A.branchTwo()\n}',
    );
  });

  await expect.poll(
    async () => {
      const t = await previewText();
      return t.includes('branchOne') && t.includes('branchTwo');
    },
    { timeout: 15_000 },
  ).toBe(true);
});

test('while loop fragment renders the loop body label', async ({ page }) => {
  // Loop fragment: parser recognises `while (...) { ... }` and the renderer
  // wraps the body. Asserting on the inner call label catches both layers.
  await expect(page.locator('.CodeMirror').first()).toBeVisible();
  const previewText = () =>
    page.evaluate(
      () =>
        document.getElementById('demo-frame')?.contentDocument?.body
          ?.textContent || '',
    );
  await expect.poll(previewText, { timeout: 15_000 }).toContain('BookLibService');

  await page.evaluate(() => {
    document.querySelector('.CodeMirror').CodeMirror.setValue(
      'while (running) {\n  Worker.tickOnce()\n}',
    );
  });
  await expect.poll(previewText, { timeout: 15_000 }).toContain('tickOnce');
});
