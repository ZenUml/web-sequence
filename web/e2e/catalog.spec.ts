// Catalog spec — Playwright implementation of BROWSER_TEST_CATALOG.md, mapped
// 1:1 (A1…J6). Drives the real built app on :4399 (see playwright.config.ts).
//
// Reads are observable end-state only: popup option rows, editor text, token
// colors, error markers, hint-bar ids. The two documented gaps (B4 top-level
// slash zone, J6 slash-in-comment) are `test.fixme` — desired behavior, known
// unimplemented (ADR 0002). Everything else asserts current, correct behavior.

import { test, expect } from '@playwright/test';
import {
  seedAndOpen,
  clearEditor,
  getEditorText,
  editorRoot,
  completionOptionTexts,
  openSlashPopup,
  enterParBlock,
  tokenSpans,
  baseColor,
  hintBarIds,
  errorMarkerCount,
} from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await seedAndOpen(page);
});

// Type, let the completion source settle, return the option rows joined.
async function options(page: import('@playwright/test').Page): Promise<string[]> {
  await page.waitForTimeout(300);
  return completionOptionTexts(page);
}
const AS_ROW = 'Alias / label a participant';

// ── A. Annotation completion (`@`) ──────────────────────────────────────────
test.describe('A. annotation completion', () => {
  test('A1 — @ lists participant annotations incl. cloud types', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@');
    const j = (await options(page)).join('\n');
    expect(j).toContain('@Actor');
    expect(j).toContain('@Database');
    expect(j).toMatch(/@Lambda|@S3/);
  });

  test('A2 — @Da fuzzy-matches Database/DynamoDB and excludes @Actor', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Da');
    const j = (await options(page)).join('\n');
    expect(j).toContain('@Database');
    expect(j).toContain('@DynamoDB');
    expect(j).not.toContain('@Actor');
  });

  test('A3 — @ then Tab accepts @Actor (no leading whitespace)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@');
    await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
    await page.waitForTimeout(150); // past CM's 75ms completion interactionDelay before accepting
    await page.keyboard.press('Tab');
    await expect.poll(() => getEditorText(page)).toBe('@Actor');
  });

  test('A4 — @ then Enter accepts @Actor', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@');
    await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
    await page.waitForTimeout(150); // past CM's 75ms completion interactionDelay before accepting
    await page.keyboard.press('Enter');
    await expect.poll(() => getEditorText(page)).toBe('@Actor');
  });

  test('A5 — @ in a block offers NO annotations (head-only)', async ({ page }) => {
    await enterParBlock(page);
    await page.keyboard.type('@');
    expect((await options(page)).join('\n')).not.toContain('@Actor');
  });
});

// ── B. Slash commands ───────────────────────────────────────────────────────
test.describe('B. slash commands', () => {
  test('B1 — / in head offers exactly /participant + /group', async ({ page }) => {
    await openSlashPopup(page, 'head');
    const opts = await completionOptionTexts(page);
    expect(opts.join('\n')).toContain('/participant');
    expect(opts.join('\n')).toContain('/group');
    expect(opts).toHaveLength(2);
  });

  test('B2 — / in a block offers block commands, not /participant', async ({ page }) => {
    await openSlashPopup(page, 'block');
    const j = (await completionOptionTexts(page)).join('\n');
    expect(j).toContain('/if');
    expect(j).toContain('/sync');
    expect(j).toContain('/while');
    expect(j).not.toContain('/participant');
  });

  test('B3 — / in a group body offers /participant + /group', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('group G {');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    const j = (await options(page)).join('\n');
    expect(j).toContain('/participant');
    expect(j).toContain('/group');
  });

  // GAP (ADR 0002 #2): at the top level, message slash commands are not offered.
  test.fixme('B4 — top-level / should offer block commands (slash-zone gap)', async ({ page }) => {
    await openSlashPopup(page, 'head');
    expect((await completionOptionTexts(page)).join('\n')).toContain('/sync');
  });

  test('B5 — accept /if inserts the if-template', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('if');
    await page.keyboard.press('Enter');
    await expect.poll(() => getEditorText(page)).toContain('if(condition) {');
  });

  test('B6 — /sync + Tab field nav → Svc.doWork() {', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('sync');
    await page.keyboard.press('Enter');
    await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);
    await page.keyboard.type('Svc');
    await page.keyboard.press('Tab');
    await page.keyboard.type('doWork');
    await expect.poll(() => getEditorText(page)).toContain('Svc.doWork() {');
  });

  test('B7 — Shift-Tab returns to field 1', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('sync');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Svc');
    await page.keyboard.press('Tab');
    await page.keyboard.type('doWork');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.type('X');
    await expect.poll(() => getEditorText(page)).toContain('X.doWork() {');
  });

  test('B8 — accept /try inserts try/catch', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('try');
    await page.keyboard.press('Enter');
    const t = await getEditorText(page);
    expect(t).toContain('try {');
    expect(t).toContain('catch');
  });

  test('B9 — accept /note inserts a comment', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('note');
    await page.keyboard.press('Enter');
    await expect.poll(() => getEditorText(page)).toContain('//');
  });
});

// ── C. Head keyword sub-positions ───────────────────────────────────────────
test.describe('C. head keyword sub-positions', () => {
  test('C1 — t at statement start offers title', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('t');
    expect((await options(page)).join('\n')).toContain('title');
  });

  test('C2 — g at statement start offers group', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('g');
    expect((await options(page)).join('\n')).toContain('group');
  });

  test('C3 — @Actor <name slot> does NOT offer as', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor ');
    await page.keyboard.type('a');
    expect((await options(page)).join('\n')).not.toContain(AS_ROW);
  });

  test('C4 — @Actor <name slot> does NOT offer title', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor ');
    await page.keyboard.type('t');
    expect((await options(page)).join('\n')).not.toContain('Diagram title');
  });

  test('C5 — group <name slot> does NOT offer as', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('group ');
    await page.keyboard.type('a');
    expect((await options(page)).join('\n')).not.toContain(AS_ROW);
  });

  test('C6 — @Actor Alice <modifier slot> DOES offer as', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice ');
    await page.keyboard.type('a');
    expect((await options(page)).join('\n')).toContain(AS_ROW);
  });

  test('C7 — @Actor <<service>> <name slot> does NOT offer as', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor <<service>> ');
    await page.keyboard.type('a');
    expect((await options(page)).join('\n')).not.toContain(AS_ROW);
  });
});

// ── D. Block keywords ───────────────────────────────────────────────────────
test.describe('D. block keywords', () => {
  test('D1 — i in a block offers if, not title', async ({ page }) => {
    await enterParBlock(page);
    await page.keyboard.type('i');
    const j = (await options(page)).join('\n');
    expect(j).toContain('if');
    expect(j).not.toContain('Diagram title');
  });

  test('D2 — w in a block offers while', async ({ page }) => {
    await enterParBlock(page);
    await page.keyboard.type('w');
    expect((await options(page)).join('\n')).toContain('while');
  });

  test('D3 — @ in a block offers no annotations', async ({ page }) => {
    await enterParBlock(page);
    await page.keyboard.type('@');
    expect((await options(page)).join('\n')).not.toContain('@Actor');
  });
});

// ── E. Participant-name completion ──────────────────────────────────────────
test.describe('E. participant names', () => {
  test('E1 — after Name. offers declared participants', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor OrderController');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Boundary Web');
    await page.keyboard.press('Enter');
    await page.keyboard.type('OrderController.');
    const j = (await options(page)).join('\n');
    expect(j).toContain('Web');
    expect(j).toContain('OrderController');
  });

  test('E2 — partial in a block offers the matching declared name', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Apple');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Banana');
    await page.keyboard.press('Enter');
    await page.keyboard.type('par {');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Ban');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Banana');
  });

  test('E3 — Al + Ctrl+Space offers declared Alice', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Bob');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Al');
    await page.keyboard.press('Control+Space');
    const j = (await options(page)).join('\n');
    expect(j).toContain('Alice');
    expect(j).toContain('participant');
  });

  test('E4 — after A-> offers the To endpoint B', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor A');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor B');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A->');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('B');
  });

  test('E5 — the in-progress token is excluded from suggestions', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Bob');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Ali');
    await page.keyboard.press('Control+Space');
    const j = (await options(page)).join('\n');
    expect(j).toContain('Alice');
    expect(j).not.toContain('Aliparticipant'); // the cursor token itself, never self-suggested
  });
});

// ── F. Accept & keymap mechanics ────────────────────────────────────────────
test.describe('F. accept & keymap', () => {
  test('F1 — Tab accepts the @-popup (outranks indentWithTab)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@');
    await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
    await page.waitForTimeout(150); // past CM's 75ms completion interactionDelay before accepting
    await page.keyboard.press('Tab');
    await expect.poll(() => getEditorText(page)).toBe('@Actor');
  });

  test('F2 — Tab indents when no completion is active', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('abc');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Home');
    await page.keyboard.press('Tab');
    await expect.poll(() => getEditorText(page)).toMatch(/^\s+abc/);
  });

  test('F3 — Escape closes the popup with no insert', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@');
    await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
    await page.waitForTimeout(150); // past CM's 75ms completion interactionDelay before accepting
    await page.keyboard.press('Escape');
    await expect.poll(() => getEditorText(page)).toBe('@');
    expect(await completionOptionTexts(page)).toHaveLength(0);
  });

  test('F4 — Enter accepts the @-popup (not a newline)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@');
    await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
    await page.waitForTimeout(150); // past CM's 75ms completion interactionDelay before accepting
    await page.keyboard.press('Enter');
    await expect.poll(() => getEditorText(page)).toBe('@Actor');
  });

  test('F5 — Enter inserts a newline with no popup/snippet', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('abc');
    await page.keyboard.press('Escape');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('x');
    await expect.poll(() => getEditorText(page)).toBe('abc\nx');
  });

  test('F6 — Shift-Tab outranks indentLess (returns to field 1)', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('sync');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Svc');
    await page.keyboard.press('Tab');
    await page.keyboard.type('doWork');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.type('X');
    await expect.poll(() => getEditorText(page)).toContain('X.doWork() {');
  });
});

// ── G. Syntax highlighting ──────────────────────────────────────────────────
test.describe('G. highlighting', () => {
  test('G1 — message content + arrow are colored', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: Hello');
    await page.waitForTimeout(300);
    const base = await baseColor(page);
    const spans = await tokenSpans(page);
    expect(spans.find((s) => s.text === 'Hello')?.color).not.toBe(base);
    expect(spans.find((s) => s.text === '->')?.color).not.toBe(base);
  });

  test('G2 — declare-then-message colors Hello like a lone message', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: Hello');
    await page.waitForTimeout(300);
    const lone = (await tokenSpans(page)).find((s) => s.text === 'Hello')?.color;
    expect(lone).toBeTruthy();
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Alice->Bob: Hello');
    await page.waitForTimeout(300);
    const declared = (await tokenSpans(page)).find((s) => s.text === 'Hello')?.color;
    expect(declared).toBe(lone);
  });

  test('G3 — @Actor (meta) is colored distinct from the name', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Client');
    await page.waitForTimeout(300);
    const spans = await tokenSpans(page);
    const at = spans.find((s) => s.text === '@Actor')?.color;
    const name = spans.find((s) => s.text === 'Client')?.color;
    expect(at).toBeTruthy();
    expect(at).not.toBe(name);
  });

  test('G4 — method name is function-colored', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A.method()');
    await page.waitForTimeout(300);
    const base = await baseColor(page);
    expect((await tokenSpans(page)).find((s) => s.text === 'method')?.color).not.toBe(base);
  });
});

// ── H. Auto-indentation ─────────────────────────────────────────────────────
test.describe('H. auto-indentation', () => {
  test('H1 — Enter inside a block indents one unit', async ({ page }) => {
    await enterParBlock(page);
    await expect.poll(() => getEditorText(page)).toMatch(/par \{\n {2}/);
  });

  test('H2 — typing } dedents to the opener column', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A.run() {');
    await page.keyboard.press('Delete'); // drop the auto-paired }
    await page.keyboard.press('Enter');
    await page.keyboard.type('B->C: hi');
    await page.keyboard.press('Enter');
    await page.keyboard.type('}');
    await expect.poll(() => getEditorText(page)).toBe('A.run() {\n  B->C: hi\n}');
  });

  test('H3 — nested blocks indent one unit per depth', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A.a() {');
    await page.keyboard.press('Enter');
    await page.keyboard.type('B.b() {');
    await page.keyboard.press('Enter');
    await page.keyboard.type('C.c()');
    await expect.poll(() => getEditorText(page)).toMatch(/A\.a\(\) \{\n {2}B\.b\(\) \{\n {4}C\.c\(\)/);
  });

  test('H4 — if-block body indents', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('if(ready) {');
    await page.keyboard.press('Enter');
    await expect.poll(() => getEditorText(page)).toMatch(/if\(ready\) \{\n {2}/);
  });
});

// ── I. Hint Bar ─────────────────────────────────────────────────────────────
test.describe('I. hint bar', () => {
  test('I1 — head shows participant/group hints', async ({ page }) => {
    await clearEditor(page);
    const ids = await hintBarIds(page);
    expect(ids).toContain('hint-participant');
    expect(ids).toContain('hint-group');
  });

  test('I2 — block shows message/control hints, not participant', async ({ page }) => {
    await enterParBlock(page);
    const ids = await hintBarIds(page);
    expect(ids).toContain('hint-sync');
    expect(ids).not.toContain('hint-participant');
  });
});

// ── J. Negative / edge / no-false-positives ─────────────────────────────────
test.describe('J. negative / edge', () => {
  test('J1 — valid declare-then-message + #color shows zero error markers', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Client #FFEBE6');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Database DB');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Client->DB: query');
    await page.waitForTimeout(400);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain('Client->DB: query');
  });

  test('J2 — garbage does not crash and shows no error markers', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('!!!@@@###');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain('!!!');
  });

  test('J3 — a message label is never fabricated as a participant', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Alice->Bob: Hello');
    await page.keyboard.press('Enter');
    await page.keyboard.type('He'); // would prefix-match a fabricated "Hello" participant
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).not.toContain('Hello');
  });

  test('J4 — a dangling arrow does not crash', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->');
    await page.waitForTimeout(200);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toBe('A->');
  });

  test('J5 — quiescent editor shows no completion popup', async ({ page }) => {
    await clearEditor(page);
    await page.waitForTimeout(300);
    expect(await completionOptionTexts(page)).toHaveLength(0);
  });

  // GAP: the slash popup currently fires inside comments. Desired: suppressed.
  test.fixme('J6 — slash inside a comment should not pop the menu', async ({ page }) => {
    await enterParBlock(page);
    await page.keyboard.type('// /sync');
    expect((await options(page)).join('\n')).not.toContain('/sync');
  });
});
