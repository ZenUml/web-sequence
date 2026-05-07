# Playwright Smoke Tests — Design

**Date**: 2026-05-07
**Status**: Approved, ready for implementation plan

## Goal

Add a small Playwright smoke test suite that catches catastrophic regressions in the four most fundamental flows of the web-sequence app: the page loads, the editor renders, typing updates the diagram, and saving works. Tests must run reliably in headless mode against a fresh Vite dev server with no Firebase auth setup.

## Context

Playwright is already configured in this repo:
- `@playwright/test ^1.55.0` is installed.
- `playwright.config.js` defines three browser projects (chromium, firefox, webkit), HTML reporter, and a `webServer` block that runs `pnpm dev`.
- `package.json` exposes `test:e2e`, `test:e2e:headed`, and `test:e2e:ui` scripts.
- `e2e/tests/` is the configured `testDir` and is currently empty.

What's missing is test files plus one config bug fix.

## Pre-existing config bug to fix

`playwright.config.js` has `baseURL: 'http://localhost:3001'` and `webServer.url: 'http://localhost:3001'`, but `vite.config.js` runs the dev server on port `3000`. As shipped, the suite cannot reach the app. Change both to `http://localhost:3000`. No other config changes.

## Test file

Single file: `e2e/tests/smoke.spec.js`. Plain JS to match the project (no TypeScript).

### Pre-test setup (`test.beforeEach`)

Before each test, navigate to `/` once to establish origin, then write to `localStorage`:

- `loginAndSaveMessageSeen = "true"` — suppresses the first-save `confirm()` dialog in `app.jsx` (line 848). A blocking native dialog would otherwise hang headless runs.

Then reload the page so the app boots with the flag in place.

### Tests

1. **App loads without errors**
   - Navigate to `/`.
   - Assert the CodeMirror editor element (`.CodeMirror`) is visible.
   - Assert the diagram preview container (the ZenUML render target — exact selector TBD during implementation by inspecting the running app) is visible.
   - Subscribe to `page.on('pageerror')` and `page.on('console')` for `error` level; fail if any uncaught error fires during load.

2. **Editor renders default content**
   - After load, assert the CodeMirror text area contains non-empty content (the app ships with a default diagram).
   - Assert the diagram preview contains rendered SVG (`svg` element present and non-empty).

3. **Diagram updates as you type**
   - Clear the editor and type a known short ZenUML snippet: `A->B: hello`.
   - Wait for the preview to re-render (debounce/poll on the SVG content, not a fixed timeout).
   - Assert the rendered diagram contains the text `hello`.

4. **Save works (anonymous, local)**
   - Trigger save via Cmd+S (macOS) / Ctrl+S (other platforms). Use `page.keyboard.press` with the platform-appropriate modifier (`process.platform === 'darwin' ? 'Meta+s' : 'Control+s'`).
   - Assert one of: a save notification appears (toast text contains "saved"), or the save button leaves any "saving" visual state cleanly within 5s.
   - Assert `localStorage` contains an `items` entry (or whatever key `itemService` uses — confirm during implementation) corresponding to the saved diagram.

### Selectors

Start with semantic and class selectors that already exist in the codebase:
- `.CodeMirror` for the editor (CodeMirror v5 default class).
- ZenUML preview: identify by inspecting the live DOM during implementation. The render target is a child of `ContentWrap.jsx`; expected to be a known class on a wrapper div containing an `<svg>`.
- Save button: locate by accessible name / title text. The codebase uses `window.saveBtn` so it has a stable `id="saveBtn"` somewhere — verify and use that.

If any selector proves brittle (e.g., the diagram preview wrapper has only generated class names), add a single targeted `data-testid` to the relevant component. Do not refactor more broadly. Document any added `data-testid` in this spec's "Implementation notes" section so the next round of tests can reuse them.

## What's deliberately out of scope

- Authentication flows (Firebase login, signup).
- Multi-page diagrams (PageTabs.jsx).
- Export PNG / SVG / PDF.
- Import / export JSON.
- Settings persistence and modals.
- Subscription / Paddle flows.
- Visual regression / screenshot snapshots.
- Chrome extension build.

These are candidates for a follow-up "core feature coverage" suite if the smoke set proves valuable.

## Success criteria

- `pnpm test:e2e` passes locally on chromium with the dev server already running (or auto-started by Playwright).
- `pnpm test:e2e` passes for all three browsers in `playwright.config.js`.
- Total wall-clock time < 60s for the full suite on a developer laptop.
- Zero changes to application source (`src/`) unless a single `data-testid` is required for one selector.

## Implementation notes (filled during implementation)

- **Editor selector**: `.CodeMirror` (CodeMirror v5 default class).
- **Diagram preview**: rendered inside an iframe with `id="demo-frame"`. Use `page.frameLocator('#demo-frame')` and assert against the iframe's body.
- **Save trigger**: keyboard only (`Meta+s` on darwin, `Control+s` elsewhere). `MainHeader.jsx` receives a `saveBtnHandler` prop but does not render a visible save button — there is no clickable save UI to target.
- **First-save confirm suppressor**: `localStorage.setItem('loginAndsaveMessageSeen', 'true')` (note the lowercase 's' in `save`). Set this before navigating, otherwise an unsigned-in user gets a blocking native `confirm()` on first save.
- **localStorage on successful anonymous save**:
  - A new key `item-<random>` appears holding the saved item (JSON-stringified).
  - Existing key `items` updates to include `{[itemId]: true}`.
- **Any `data-testid` added**: none — existing selectors are sufficient.
- **Vite config shim added** (`vite.config.js`): `@zenuml/core@3.43.2`'s `exports` only expose `.`, but `src/utils.js:6` does `import zenumlUrl from '@zenuml/core/dist/zenuml?url'`. Plain `resolve.alias` (string or regex) plus `optimizeDeps.exclude` both fail — Vite still feeds the path through dep optimization and 404s the cached `.vite/deps/@zenuml_core_dist_zenuml?url.js` file. Solution: a tiny `enforce: 'pre'` plugin (`zenumlAssetUrlShim`) that resolves that exact specifier to a virtual id and loads it as `export default '/@fs<absolute-path-to-zenuml.js>'`.
- **Editor input technique**: synthetic `page.keyboard.type` doesn't reliably trigger CodeMirror v5's change pipeline — the editor receives the keys but the preview never re-renders. Drive the value via `wrapper.CodeMirror.setValue(...)` instead.
- **Iframe content reads**: webkit's `frameLocator` + `locator('svg')` flakes; `getByText` misses SVG `<text>` nodes. Reach through `document.getElementById('demo-frame')?.contentDocument` directly via `page.evaluate` and assert against `querySelector` / `body.textContent`.
