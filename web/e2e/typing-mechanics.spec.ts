// typing-mechanics.spec.ts — TEST_TREES.md typing/indent mechanics gaps
// (TT-I1, TT-I3, TT-I9, TT-I10, TT-I11, TT-I12, TT-I20), driven at KEYSTROKE
// level against the real preview build, asserting OBSERVABLE end state (final
// editor text) only — same contract as editor-language.spec.ts.
//
// Mechanics under test live in CodeMirror extensions the unit layer cannot run
// faithfully (jsdom has no real keymap/closeBrackets dispatch — taxonomy class 7
// "wrong substrate" per TEST_TREES.md), so e2e is the cheapest honest layer.
//
// Caveats honored from helpers/editor.ts:
//   - ALWAYS clearEditor() at scenario start (IndexedDB leaks prior content).
//   - `{` / `(` / `"` auto-pair their closers (zenumlLanguage closeBrackets).
//   - Escape before Enter wherever a completion popup could be open — the
//     editor's Enter binding accepts an open popup instead of inserting \n.

import { test, expect } from '@playwright/test';
import { seedAndOpen, clearEditor, getEditorText, enterParBlock } from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await seedAndOpen(page);
});

test.describe('bracket pair mechanics', () => {
  // TT-I1 — Backspace with the cursor between an auto-paired {} / () / "" deletes
  // BOTH characters (deleteBracketPair), not just the opener.
  test('TT-I1 — Backspace between auto-paired {} / () / "" deletes both chars', async ({ page }) => {
    // {} — typing `{` auto-inserts `}` with the cursor between them.
    await clearEditor(page);
    await page.keyboard.type('x{');
    await expect.poll(() => getEditorText(page)).toBe('x{}');
    await page.keyboard.press('Backspace');
    await expect.poll(() => getEditorText(page)).toBe('x');

    // () — same pair-delete for parens.
    await clearEditor(page);
    await page.keyboard.type('x(');
    await expect.poll(() => getEditorText(page)).toBe('x()');
    await page.keyboard.press('Backspace');
    await expect.poll(() => getEditorText(page)).toBe('x');

    // "" — same pair-delete for quotes. NOTE: closeBrackets only auto-pairs a quote
    // when it is NOT typed directly after a word char (probe-verified: `x"` stays
    // `x"`), so anchor it after a space. The post-Backspace state is proven by a
    // follow-up keystroke (`y`) — a lone-opener delete would leave `x y"`, and the
    // trailing-space-only state `x ` is ambiguous in innerText.
    await clearEditor(page);
    await page.keyboard.type('x "');
    await expect.poll(() => getEditorText(page)).toBe('x ""');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('y');
    await expect.poll(() => getEditorText(page)).toBe('x y');
  });

  // TT-I3 — typing `}` against the pending auto-paired closer types OVER it; the
  // exact-text assert catches the regression where every hand-closed block doubles.
  test('TT-I3 — typing } over a pending auto-paired closer does not double it', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('par {'); // auto-pairs -> `par {}` with the cursor inside
    await expect.poll(() => getEditorText(page)).toBe('par {}');
    await page.keyboard.type('}'); // hand-close: must type over, not insert
    await expect.poll(() => getEditorText(page)).toBe('par {}');
  });
});

test.describe('indentation mechanics', () => {
  // TT-I9 — Enter after a COMPLETED statement on a body line continues at body
  // indent. Every pre-existing test overwrote this intermediate line (with `}` or
  // a nested opener), so a regression to column 0 was invisible.
  test('TT-I9 — Enter after a completed statement in a block body continues at body indent', async ({ page }) => {
    await enterParBlock(page); // par {\n  |\n}
    await page.keyboard.type('B->C: hi');
    await page.keyboard.press('Escape'); // popup hygiene before Enter
    await page.keyboard.press('Enter');
    await page.keyboard.type('D->E: yo');
    await page.keyboard.press('Escape');
    await expect.poll(() => getEditorText(page)).toBe('par {\n  B->C: hi\n  D->E: yo\n}');
  });

  // TT-I10 — Enter between an auto-paired {} drops the auto-closer onto ITS OWN
  // line at the OPENER's column (depth 1), and at the depth-1 column for a nested
  // block (depth 2). Prior tests asserted only the body-line indent, so a closer
  // glued to the body line or left at body indent stayed green.
  test('TT-I10 — Enter between auto-paired {} puts the closer on its own line at the opener column', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A.m() {'); // -> A.m() {} with the cursor inside the braces
    await page.keyboard.press('Enter');
    // Closer on its own line at column 0 (the opener's column); body line indented 2.
    await expect.poll(() => getEditorText(page)).toBe('A.m() {\n  \n}');

    // Depth 2: nested opener on the body line; its closer lands at the depth-1 column.
    await page.keyboard.type('B.n() {');
    await page.keyboard.press('Enter');
    await expect.poll(() => getEditorText(page)).toBe('A.m() {\n  B.n() {\n    \n  }\n}');
  });

  // TT-I11 — Enter MID-statement (cursor after `B->C:`, before ` hi`) splits the
  // line; the continuation must land at body indent, not column 0. Line-splitting
  // is a daily editing action with no other coverage.
  test('TT-I11 — Enter mid-statement on a body line indents the continuation to body level', async ({ page }) => {
    await enterParBlock(page); // par {\n  |\n}
    await page.keyboard.type('B->C: hi');
    await page.keyboard.press('Escape'); // popup hygiene before Enter
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft'); // cursor after `B->C:`
    await page.keyboard.press('Enter');
    // The continuation (` hi`, leading space carried from the split) starts at the
    // 2-space body indent — a column-0 regression would leave at most 1 leading space.
    await expect.poll(() => getEditorText(page)).toMatch(/^par \{\n {2}B->C:\n {2}\s*hi\n\}$/);
  });

  // TT-I12 — plain Shift-Tab (no snippet, no popup) falls through the snippet
  // keymap to indentLess and dedents the line one unit. Previously asserted only
  // by a source comment (F6 covers the snippet branch, T9 covers Mod-[).
  test('TT-I12 — Shift-Tab with no snippet/popup active dedents the line one unit', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('abc');
    await page.keyboard.press('Escape'); // close the bare-identifier popup
    await page.keyboard.press('Home');
    await page.keyboard.press('Tab'); // indent one unit first (catalog F2 contract)
    await expect.poll(() => getEditorText(page)).toBe('  abc');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => getEditorText(page)).toBe('abc');
  });

  // TT-I20 — a multi-line selection + Tab indents EVERY selected line; Shift-Tab
  // dedents them back. Block re-indentation is a core editing gesture.
  test('TT-I20 — multi-line selection: Tab indents every line, Shift-Tab dedents back', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: one');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await page.keyboard.type('C->D: two');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+a'); // select both lines
    await page.keyboard.press('Tab');
    await expect.poll(() => getEditorText(page)).toBe('  A->B: one\n  C->D: two');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => getEditorText(page)).toBe('A->B: one\nC->D: two');
  });
});
