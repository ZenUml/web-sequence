// Reusable Playwright helpers for the ZenUML DSL editor (CodeMirror 6).
//
// PURE helpers: every function takes a Playwright `Page` and drives the real
// editor through observable DOM. NO @playwright/test (expect/fixtures) imports —
// the spec composes these and owns the assertions, so the helpers stay reusable
// across specs (per repo convention: helpers module + spec file).
//
// Caveats baked in from live-browser probing (do NOT "simplify" these away):
//   - The app persists the doc to IndexedDB and re-saves on unload, so the
//     editor is NEVER guaranteed empty on load. ALWAYS clearEditor() at the
//     start of a scenario; never rely on a fresh default doc.
//   - closeBrackets (basicSetup) auto-inserts a matching `}` the moment you type
//     `{`. Helpers that need a bare opener Delete the auto-paired closer.
//   - Autocomplete option rows render label+detail concatenated (e.g.
//     "Aliceparticipant"). Match by substring, never exact text.

import type { Page, Locator } from '@playwright/test';

// Onboarding/version flags so the app boots straight into the editor with no
// modal overlays intercepting keystrokes.
const SEED_FLAGS: Record<string, string> = {
  onboarded: 'true',
  lastSeenVersion: '"9999.0.0"',
  pledgeModalSeen: 'true',
  loginAndsaveMessageSeen: 'true',
};

/** The CodeMirror content element of the DSL editor. */
export function editorContent(page: Page): Locator {
  return page.getByTestId('dsl-editor').locator('.cm-content');
}

/** The DSL editor root (scopes lint markers / snippet fields / option rows). */
export function editorRoot(page: Page): Locator {
  return page.getByTestId('dsl-editor');
}

/**
 * Seed onboarding flags, open the app at baseURL, and wait until the editor is
 * interactive (header rendered + content focusable). Uses a relative URL so the
 * config's baseURL drives where we point.
 */
export async function seedAndOpen(page: Page): Promise<void> {
  await page.addInitScript((flags: Record<string, string>) => {
    for (const [k, v] of Object.entries(flags)) localStorage.setItem(k, v);
  }, SEED_FLAGS);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByTestId('header-title').waitFor({ timeout: 15000 });
  await editorContent(page).waitFor({ timeout: 15000 });
}

/**
 * Clear the editor to a known-empty state. Required at the START of every
 * scenario — IndexedDB-persisted content from a prior run/page leaks otherwise.
 */
export async function clearEditor(page: Page): Promise<void> {
  const content = editorContent(page);
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
}

/** Current full text of the editor (newline-joined visual lines). */
export async function getEditorText(page: Page): Promise<string> {
  return editorContent(page).innerText();
}

/**
 * Open the `/`-triggered slash-command popup in the requested parse zone.
 *
 *  - 'head'  : a fresh empty doc — the cursor starts in Head, where only
 *              /participant and /group are offered.
 *  - 'block' : establish a StatementBraceBlock first (`A.run() {` + Enter lands
 *              the cursor on the indented body line), where /if, /sync, ... live.
 *
 * Clears the editor first so the zone is deterministic regardless of leftover
 * content. Leaves the popup OPEN; the caller asserts options or accepts.
 */
export async function openSlashPopup(page: Page, zone: 'head' | 'block'): Promise<void> {
  await clearEditor(page);
  if (zone === 'block') {
    // `{` auto-closes to `{}`; Enter splits it into an indented body line with
    // the `}` below — putting the cursor inside the StatementBraceBlock.
    await page.keyboard.type('A.run() {');
    await page.keyboard.press('Enter');
  }
  await page.keyboard.type('/');
  await page.locator('.cm-tooltip-autocomplete').first().waitFor({ timeout: 5000 });
}

/** Visible autocomplete option rows as raw strings (label+detail concatenated). */
export async function completionOptionTexts(page: Page): Promise<string[]> {
  return page
    .locator('.cm-tooltip-autocomplete li')
    .evaluateAll((els) => els.map((e) => e.textContent ?? ''));
}

/**
 * Accept the currently-highlighted completion (Enter). For slash snippets this
 * inserts the template and activates its tab stops.
 */
export async function acceptCompletion(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
}

/**
 * Count error markers shown in the editor. The DSL editor wires NO linter
 * (modes.ts: the Lezer linter is intentionally disabled; AppRoot passes no
 * diagnostics to dsl-editor), so on valid DSL this MUST be 0 — the assertion
 * guards against a future linter false-positiving on renderer-valid DSL.
 */
export async function errorMarkerCount(page: Page): Promise<number> {
  const root = editorRoot(page);
  const inline = await root.locator('.cm-lintRange-error').count();
  const gutter = await root.locator('.cm-lint-marker-error').count();
  return inline + gutter;
}

/**
 * Count active snippet tab-stop fields. This is the exact signal the Phase-1
 * regression flipped to 0 (a full reconfigure wiped the appended snippetState
 * after the first apply), so Tab fell through to acceptCompletion. A non-zero
 * count after applying a multi-field snippet proves the fix holds.
 */
export async function snippetFieldCount(page: Page): Promise<number> {
  return editorRoot(page).locator('.cm-snippetField').count();
}

/**
 * Type `A.run() {` and Delete the auto-paired `}`, leaving a BARE opener so the
 * caller can drive Enter/`}` indentation behaviour without the closeBrackets
 * autopair confusing the end state.
 */
export async function openBlockWithoutAutoClose(page: Page): Promise<void> {
  await page.keyboard.type('A.run() {');
  await page.keyboard.press('Delete'); // remove the auto-inserted matching `}`
}

/**
 * Clear, then open a `par { }` block and land the cursor on its indented body
 * line (a real StatementBraceBlock → zone 'block'). `par` avoids the `.`/`(`
 * that other openers need, so the body is deterministic. Leaves no popup open.
 */
export async function enterParBlock(page: Page): Promise<void> {
  await clearEditor(page);
  await page.keyboard.type('par {'); // closeBrackets auto-pairs `}`
  await page.keyboard.press('Enter'); // split into an indented body line, cursor inside
}

/** (text, color) for every styled token span on the editor's lines. */
export async function tokenSpans(page: Page): Promise<{ text: string; color: string }[]> {
  return editorContent(page)
    .locator('.cm-line span')
    .evaluateAll((els) =>
      els.map((e) => ({ text: e.textContent ?? '', color: getComputedStyle(e).color })),
    );
}

/** The editor's base foreground color (to compare token colors against). */
export async function baseColor(page: Page): Promise<string> {
  return editorContent(page).evaluate((e) => getComputedStyle(e).color);
}

/**
 * The Hint Bar command ids currently shown (e.g. ['hint-participant','hint-group']
 * in the head, ['hint-sync','hint-if',…] in a block). The bar is `role="toolbar"`
 * and each entry carries `data-testid="hint-<command>"`.
 */
export async function hintBarIds(page: Page): Promise<string[]> {
  return page
    .locator('[role="toolbar"] [data-testid^="hint-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
}
