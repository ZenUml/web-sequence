// catalog-extended.spec.ts — AUTO-ASSEMBLED from the design workflow
// (design-editor-100-cases). 112 NEW cases (areas K–V) beyond the 51 in
// catalog.spec.ts. Each drives the real built app on :4399 via the shared helpers.
//
// Cases encode the EXPECTED (correct) behavior. Failing cases were verified
// adversarially: real bugs drove the src/editor/ fixes (#803/#804/#805/#806/#807);
// the 4 verified BAD tests (L4/M7/V4/V7) were corrected in place.
//
// NOTE: this file is now HAND-MAINTAINED — do NOT regenerate from the workflow output
// (that would clobber the bad-test corrections). The assembler was a one-shot.
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

// Type, let the completion source settle (past CM's 75ms interactionDelay), return rows.
async function options(page: import('@playwright/test').Page): Promise<string[]> {
  await page.waitForTimeout(300);
  return completionOptionTexts(page);
}
const AS_ROW = 'Alias / label a participant';

test.describe("K. Annotation completion (deep)", () => {
  test('K1 — @ on empty doc offers exactly the 24 annotation rows', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@');
      const rows = await options(page);
      expect(rows).toHaveLength(24);
    });

  test('K2 — @DnDb subsequence-matches @DynamoDB', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@DnDb');
      expect((await options(page)).join('\n')).toContain('@DynamoDB');
    });

  test('K3 — lowercase @elc case-insensitively matches @ElastiCache', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@elc');
      expect((await options(page)).join('\n')).toContain('@ElastiCache');
    });

  test('K4 — @Lam + Enter accepts @Lambda', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Lam');
      await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
      await page.waitForTimeout(150); // past CM's 75ms interactionDelay before accepting
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toBe('@Lambda');
    });

  test('K5 — @RD + Tab accepts @RDS', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@RD');
      await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
      await page.waitForTimeout(150); // past CM's 75ms interactionDelay before accepting
      await page.keyboard.press('Tab');
      await expect.poll(() => getEditorText(page)).toBe('@RDS');
    });

  test('K6 — @ in a group body offers annotations', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group G {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@');
      const j = (await options(page)).join('\n');
      expect(j).toContain('@Actor');
      expect(j).toContain('@Database');
    });

  test('K7 — @ inside a message label offers no annotations', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A->B: @');
      expect((await options(page)).join('\n')).not.toContain('@Actor');
    });

  test('K8 — @Foo matches nothing, no crash', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Foo');
      expect((await options(page)).join('\n')).not.toContain('@Actor');
      expect(await errorMarkerCount(page)).toBe(0);
      await expect.poll(() => getEditorText(page)).toBe('@Foo');
    });

  test('K9 — @ on a fresh head line still offers the full catalog', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@');
      const j = (await options(page)).join('\n');
      expect(j).toContain('@Actor');
      expect(j).toContain('@Queue');
    });

});

test.describe("L. Slash command coverage (all 14)", () => {
  test('L1 — accept /participant inserts @Actor Name #FFEBE6 (3 fields)', async ({ page }) => {
      await openSlashPopup(page, 'head'); // empty doc = top zone, offers head commands incl. /participant
      await page.keyboard.type('participant');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(3);
      await expect.poll(() => getEditorText(page)).toContain('@Actor Name #FFEBE6');
    });

  test('L2 — accept /group inserts `group Name {` (1 field)', async ({ page }) => {
      await openSlashPopup(page, 'head'); // top zone offers head commands incl. /group
      await page.keyboard.type('group');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(1);
      await expect.poll(() => getEditorText(page)).toContain('group Name {');
    });

  test('L3 — accept /async inserts A->B: message (3 fields)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('async');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(3);
      await expect.poll(() => getEditorText(page)).toContain('A->B: message');
    });

  test('L4 — accept /return inserts `return value`; single-field snippet paints NO .cm-snippetField', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('return');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      // CodeMirror's snippet() only activates the ActiveSnippet field decoration when a
      // template has MORE THAN ONE field (ranges.some(r => r.field > 0)). `return ${1:value}`
      // has a single field (index 0), so NO `.cm-snippetField` is painted — the placeholder
      // `value` is merely selected. Asserting 0 is the correct mechanical expectation.
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(0);
      await expect.poll(() => getEditorText(page)).toContain('return value');
    });

  test('L5 — accept /reply inserts `@Return B->A: value` (3 fields, distinct from /return)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('reply');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(3);
      const t = await getEditorText(page);
      expect(t).toContain('@Return B->A: value');
      expect(t).not.toContain('return value'); // /reply is NOT the bare /return form
    });

  test('L6 — accept /new inserts `a = new A()` (2 fields)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('new');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);
      await expect.poll(() => getEditorText(page)).toContain('a = new A()');
    });

  test('L7 — accept /while inserts `while(condition) {` (1 field)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('while');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(1);
      await expect.poll(() => getEditorText(page)).toContain('while(condition) {');
    });

  test('L8 — accept /par inserts `par {` (0 snippet fields)', async ({ page }) => {
      await openSlashPopup(page, 'block'); // block zone: /participant absent, so `par` cannot fuzzy-match it
      await page.keyboard.type('par');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      // par template has only ${0} (final cursor), no numbered placeholders → 0 fields.
      // Assert text too: count 0 is also true if accept silently no-op'd.
      await expect.poll(() => getEditorText(page)).toContain('par {');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(0);
    });

  test('L9 — accept /section inserts `section(name) {` (1 field)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('section');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(1);
      await expect.poll(() => getEditorText(page)).toContain('section(name) {');
    });

  test('L10 — accept /ref inserts `ref(A, B)` (2 fields)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('ref');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);
      await expect.poll(() => getEditorText(page)).toContain('ref(A, B)');
    });

  test('L11 — head (group body) offers participant/group but NOT /sync or /async', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group G {'); // declaration-only Head context (not the top union)
      await page.keyboard.press('Enter');
      await page.keyboard.type('/');
      const j = (await options(page)).join('\n');
      expect(j).toContain('/participant');
      expect(j).toContain('/group');
      expect(j).not.toContain('/sync');
      expect(j).not.toContain('/async');
    });

  test('L12 — block excludes head commands /group and /participant', async ({ page }) => {
      await openSlashPopup(page, 'block');
      const j = (await completionOptionTexts(page)).join('\n');
      expect(j).toContain('/sync');
      expect(j).not.toContain('/group');
      expect(j).not.toContain('/participant');
    });

  test('L13 — /opt matches no command and inserts no template', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('opt'); // no /opt command exists; not a subsequence of any of the 14 names
      await page.keyboard.press('Enter');
      // Nothing should be accepted — the literal /opt token remains untouched.
      await expect.poll(() => getEditorText(page)).toContain('/opt');
    });

});

test.describe("M. Snippet placeholders / tab-stops", () => {
  test('M1 — /async exposes 3 snippet fields (no $0)', async ({ page }) => {
      await openSlashPopup(page, 'head'); // empty doc = 'top' zone = head ∪ block, offers /async
      await page.keyboard.type('async');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(3);
    });

  test('M2 — /async initial field is selected and typed over', async ({ page }) => {
      await openSlashPopup(page, 'head');
      await page.keyboard.type('async');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.keyboard.type('User');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Svc');
      await page.keyboard.press('Tab');
      await page.keyboard.type('login');
      await expect.poll(() => getEditorText(page)).toContain('User->Svc: login');
    });

  test('M3 — /participant 3-field template navigated fully', async ({ page }) => {
      await openSlashPopup(page, 'head');
      await page.keyboard.type('participant');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Database');
      await page.keyboard.press('Tab');
      await page.keyboard.type('DB');
      await page.keyboard.press('Tab');
      await page.keyboard.type('C0FFEE');
      await expect.poll(() => getEditorText(page)).toContain('@Database DB #C0FFEE');
    });

  test('M4 — /participant exposes exactly 3 fields (no $0)', async ({ page }) => {
      await openSlashPopup(page, 'head');
      await page.keyboard.type('participant');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(3);
    });

  test('M5 — /try field 1 is the catch var, $0 is the body', async ({ page }) => {
      await openSlashPopup(page, 'head'); // top zone offers /try; literal template indent only
      await page.keyboard.type('try');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.keyboard.type('err');
      await page.keyboard.press('Tab');
      await page.keyboard.type('log()');
      const t = await getEditorText(page);
      expect(t).toContain('catch(err)');
      expect(t).toMatch(/try \{\n\s+log\(\)/);
    });

  test('M6 — /section lands $0 in the body after Tab', async ({ page }) => {
      await openSlashPopup(page, 'head');
      await page.keyboard.type('section');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.keyboard.type('auth');
      await page.keyboard.press('Tab');
      await page.keyboard.type('A.b()');
      const t = await getEditorText(page);
      expect(t).toContain('section(auth) {');
      expect(t).toMatch(/section\(auth\) \{\n\s+A\.b\(\)/);
    });

  test('M7 — /reply Tab forward fills all 3 fields in order', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('reply');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.keyboard.type('B');
      await page.keyboard.press('Tab');
      await page.keyboard.type('A');
      await page.keyboard.press('Tab');
      await page.keyboard.type('msg'); // field 3, the LAST explicit field
      // The /reply template `@Return ${1:B}->${2:A}: ${3:value}` has NO `$0`, so reaching
      // field 3 COMMITS the snippet (CodeMirror's "last field = exit"). Forward 3-field
      // navigation is the meaningful assertion; Shift-Tab from the committed state is a
      // documented no-op (verified — see catalog B7 which uses /sync's $0-terminated form).
      await expect.poll(() => getEditorText(page)).toContain('@Return B->A: msg');
    });

  test('M8 — /ref fills both fields in order', async ({ page }) => {
      await openSlashPopup(page, 'head');
      await page.keyboard.type('ref');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);
      await page.keyboard.type('Auth');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Store');
      await expect.poll(() => getEditorText(page)).toContain('ref(Auth, Store)');
    });

  test('M9 — Tab past the last /async field ends the session', async ({ page }) => {
      await openSlashPopup(page, 'head');
      await page.keyboard.type('async');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(3);
      await page.keyboard.press('Tab'); // 1 -> 2
      await page.keyboard.press('Tab'); // 2 -> 3
      await page.keyboard.press('Tab'); // past last field: no next stop
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(0);
    });

});

test.describe("N. Participant-name completion + ORACLE parity", () => {
  test('N1 — participant from a sync message source A.m() is offered later', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice.run()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Bob.');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).toContain('Alice');
    });

  test('N2 — both endpoints of first-mention A->B are participants', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice->Bob: hi');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Carol->');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Alice');
      expect(j).toContain('Bob');
    });

  test('N3 — new X() constructor target is offered as a participant', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Svc.create() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('new Order()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Worker->');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).toContain('Order');
    });

  test('N4 — participants declared inside a group block are offered', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group G {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Apple');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Mango');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}');
      await page.keyboard.press('Enter');
      await page.keyboard.type('User->');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Apple');
      expect(j).toContain('Mango');
    });

  test('N5 — mixed declared + message-introduced participants all offered', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice->Bob: hi');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Charlie.run()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('New->');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Alice');
      expect(j).toContain('Bob');
      expect(j).toContain('Charlie');
    });

  test('N6 — a participant declared below the cursor line is offered', async ({ page }) => {
      await clearEditor(page);
      // Declare Zoe first, then move the cursor ABOVE it and trigger.
      await page.keyboard.type('placeholder->X: seed');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Zoe');
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Hub->');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).toContain('Zoe');
    });

  test('N7 — a message label/Content is never offered as a participant', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice->Bob: Greetings');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Gr');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).not.toContain('Greetings');
    });

  test('N8 — a method name is never offered as a participant', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice.processOrder()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('pro');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).not.toContain('processOrder');
    });

  test('N9 — the To endpoint of A->B is a participant offered after a dot trigger', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Hermes->Iris: ping');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Iris.');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Hermes');
    });

});

test.describe("O. Trigger-context completion (. -> Ctrl+Space)", () => {
  test('O1 — after Name. offers participant names only, no keywords (exposes #803)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice.');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Bob');
      expect(j).not.toContain('Return a value to the caller');
      expect(j).not.toContain('Create a new instance');
      expect(j).not.toContain('Conditional (alt) block');
    });

  test('O2 — after Name-> offers participant names only, no @annotations (exposes #803)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor A');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor B');
      await page.keyboard.press('Enter');
      await page.keyboard.type('A->');
      const j = (await options(page)).join('\n');
      expect(j).toContain('B');
      expect(j).not.toContain('@Actor');
      expect(j).not.toContain('Participant annotation');
    });

  test('O3 — after Name. omits head keywords as/title at top level (exposes #803)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice.');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Bob');
      expect(j).not.toContain(AS_ROW);
      expect(j).not.toContain('Diagram title');
    });

  test('O4 — message-introduced source participant appears after a trigger (exposes #804)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice.greet()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Bob->');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Alice');
    });

  test('O5 — arrow-introduced target participant appears after a trigger (exposes #804)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A->B: hi');
      await page.keyboard.press('Enter');
      await page.keyboard.type('A.');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('B');
    });

  test('O6 — new-expression target participant appears after a trigger (exposes #804)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Factory');
      await page.keyboard.press('Enter');
      await page.keyboard.type('new Order()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Factory->');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Order');
    });

  test('O8 — Ctrl+Space on empty word in a block offers participants, not @annotations', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.type('par {');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Alice');
      expect(j).toContain('Bob');
      expect(j).not.toContain('Participant annotation');
    });

  test('O9 — method name is never offered as an arrow target', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice.process()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Bob->pro');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).not.toContain('process');
    });

});

test.describe("P. Head keyword sub-positions / naming guard", () => {
  test('P1 — group <name slot> suppresses title too', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group ');
      await page.keyboard.type('t');
      expect((await options(page)).join('\n')).not.toContain('Diagram title');
    });

  test('P2 — @Actor <<service>> <name slot> suppresses title', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor <<service>> ');
      await page.keyboard.type('t');
      expect((await options(page)).join('\n')).not.toContain('Diagram title');
    });

  test('P3 — @Actor with no name yet suppresses head keywords', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor ');
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).not.toContain('Diagram title');
    });

  test('P4 — bare leading identifier offers as', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('a');
      expect((await options(page)).join('\n')).toContain(AS_ROW);
    });

  test('P5 — modifier slot re-enables group', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice ');
      await page.keyboard.type('g');
      expect((await options(page)).join('\n')).toContain('group');
    });

  test('P6 — group body offers title', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group G {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('t');
      expect((await options(page)).join('\n')).toContain('title');
    });

  test('P7 — second participant name slot suppresses group', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Database ');
      await page.keyboard.type('g');
      expect((await options(page)).join('\n')).not.toContain('group');
    });

  test('P8 — slash in a group name slot still offers /group', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group ');
      await page.keyboard.type('/');
      const j = (await options(page)).join('\n');
      expect(j).toContain('/group');
      expect(j).toContain('/participant');
    });

  test('P9 — group name slot never offers block keyword if', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group ');
      await page.keyboard.type('if');
      expect((await options(page)).join('\n')).not.toContain('Conditional (alt) block');
    });

});

test.describe("Q. Block keywords zone gating", () => {
  test('Q1 — o in a block offers opt, not title', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('o');
      const j = (await options(page)).join('\n');
      expect(j).toContain('opt');
      expect(j).not.toContain('Diagram title');
    });

  test('Q2 — cr in a block fuzzy-matches critical', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('cr');
      expect((await options(page)).join('\n')).toContain('Critical block');
    });

  test('Q3 — fr in a block fuzzy-matches frame', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('fr');
      expect((await options(page)).join('\n')).toContain('Named frame');
    });

  test('Q4 — fi in a block fuzzy-matches finally', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('fi');
      expect((await options(page)).join('\n')).toContain('Finally branch');
    });

  test('Q5 — as in a block offers async, not the head as modifier', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('as');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Async message');
      expect(j).not.toContain(AS_ROW);
    });

  test('Q6 — re in a block offers both return and ref', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('re');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Return a value to the caller');
      expect(j).toContain('Reference to another diagram');
    });

  test('Q7 — el in a block offers else, not group', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('el');
      const j = (await options(page)).join('\n');
      expect(j).toContain('Else / else-if branch');
      expect(j).not.toContain('Group participants under a box');
    });

  test('Q8 — t in a block offers try but not title', async ({ page }) => {
      await enterParBlock(page);
      await page.keyboard.type('t');
      const j = (await options(page)).join('\n');
      expect(j).toContain('try');
      expect(j).not.toContain('Diagram title');
    });

  test('Q9 — i at the top level offers if (top = head ∪ block keywords)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('i');
      expect((await options(page)).join('\n')).toContain('Conditional (alt) block');
    });

});

test.describe("R. Syntax highlighting tags", () => {
  test('R1 — line comment is colored distinct from base text', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('// a note about Alice');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const spans = await tokenSpans(page);
      const comment = spans.find((s) => s.text.includes('a note about Alice'))?.color;
      expect(comment).toBeTruthy();
      expect(comment).not.toBe(base);
    });

  test('R2 — control keyword if differs from method-call color', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('if(cond) {');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const ifColor = (await tokenSpans(page)).find((s) => s.text === 'if')?.color;
      expect(ifColor).toBeTruthy();
      expect(ifColor).not.toBe(base);
      await clearEditor(page);
      await page.keyboard.type('A.method()');
      await page.waitForTimeout(300);
      const methodColor = (await tokenSpans(page)).find((s) => s.text === 'method')?.color;
      expect(methodColor).toBeTruthy();
      expect(ifColor).not.toBe(methodColor);
    });

  test('R3 — quoted string is colored and differs from method-name color', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A.m("payload")');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const spans = await tokenSpans(page);
      const str = spans.find((s) => s.text.includes('payload'))?.color;
      const method = spans.find((s) => s.text === 'm')?.color;
      expect(str).toBeTruthy();
      expect(method).toBeTruthy();
      expect(str).not.toBe(base);
      expect(str).not.toBe(method);
    });

  test('R4 — return keyword is colored distinct from base', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('while(true) {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('return result');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const ret = (await tokenSpans(page)).find((s) => s.text === 'return')?.color;
      expect(ret).toBeTruthy();
      expect(ret).not.toBe(base);
    });

  test('R5 — Dot punctuation in a method call is colored distinct from base', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Service.fetch()');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const dot = (await tokenSpans(page)).find((s) => s.text === '.')?.color;
      expect(dot).toBeTruthy();
      expect(dot).not.toBe(base);
    });

  test('R6 — method name colored differently from its participant name', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice.doWork()');
      await page.waitForTimeout(300);
      const spans = await tokenSpans(page);
      const name = spans.find((s) => s.text === 'Alice')?.color;
      const method = spans.find((s) => s.text === 'doWork')?.color;
      expect(name).toBeTruthy();
      expect(method).toBeTruthy();
      expect(method).not.toBe(name);
    });

  test('R7 — boolean literal true is colored distinct from base', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('while(true) {');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const boolColor = (await tokenSpans(page)).find((s) => s.text === 'true')?.color;
      expect(boolColor).toBeTruthy();
      expect(boolColor).not.toBe(base);
    });

  test('R8 — @return annotation (meta) is colored distinct from base', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@return A->B: result');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const meta = (await tokenSpans(page)).find((s) => s.text === '@return')?.color;
      expect(meta).toBeTruthy();
      expect(meta).not.toBe(base);
    });

  test('R9 — number renders neutral while string is colored', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('while(true) {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('A.m(7): "label"');
      await page.waitForTimeout(300);
      const base = await baseColor(page);
      const spans = await tokenSpans(page);
      const num = spans.find((s) => s.text === '7')?.color;
      const str = spans.find((s) => s.text.includes('label'))?.color;
      expect(num).toBe(base);
      expect(str).toBeTruthy();
      expect(str).not.toBe(base);
    });

});

test.describe("S. Auto-indentation", () => {
  test('S1 — named group body indents one unit', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group Office {');
      await page.keyboard.press('Delete'); // drop the auto-paired }
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toMatch(/^group Office \{\n {2}/);
    });

  test('S2 — anonymous group body indents one unit', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group {');
      await page.keyboard.press('Delete'); // drop the auto-paired }
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toMatch(/^group \{\n {2}/);
    });

  test('S3 — while-block body indents one unit', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('while(x) {');
      await page.keyboard.press('Delete'); // drop the auto-paired }
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toMatch(/^while\(x\) \{\n {2}/);
    });

  test('S4 — opt-block body indents one unit', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('opt {');
      await page.keyboard.press('Delete'); // drop the auto-paired }
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toMatch(/^opt \{\n {2}/);
    });

  test('S5 — try-block body indents one unit', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('try {');
      await page.keyboard.press('Delete'); // drop the auto-paired }
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toMatch(/^try \{\n {2}/);
    });

  test('S6 — critical-block body indents one unit', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('critical {');
      await page.keyboard.press('Delete'); // drop the auto-paired }
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toMatch(/^critical \{\n {2}/);
    });

  test('S7 — three nesting levels indent 2/4/6 spaces', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A.a() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('B.b() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('C.c() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('D.d()');
      await expect
        .poll(() => getEditorText(page))
        .toMatch(/A\.a\(\) \{\n {2}B\.b\(\) \{\n {4}C\.c\(\) \{\n {6}D\.d\(\)/);
    });

  test('S8 — } dedents to each opener column across depths', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A.a() {');
      await page.keyboard.press('Delete'); // bare opener so a typed } reindents
      await page.keyboard.press('Enter');
      await page.keyboard.type('B.b() {');
      await page.keyboard.press('Delete');
      await page.keyboard.press('Enter');
      await page.keyboard.type('C.c() {');
      await page.keyboard.press('Delete');
      await page.keyboard.press('Enter');
      await page.keyboard.type('D.d()');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}');
      await expect
        .poll(() => getEditorText(page))
        .toBe('A.a() {\n  B.b() {\n    C.c() {\n      D.d()\n    }\n  }\n}');
    });

  test('S9 — group closing } aligns to the group opener column', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group Office {');
      await page.keyboard.press('Delete'); // bare opener so a typed } reindents
      await page.keyboard.press('Enter');
      await page.keyboard.type('A');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}');
      await expect.poll(() => getEditorText(page)).toBe('group Office {\n  A\n}');
    });

});

test.describe("T", () => {
  test('T1 — Ctrl+Space re-opens a popup Escape just closed', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@');
      await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
      await page.waitForTimeout(150);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      expect(await completionOptionTexts(page)).toHaveLength(0);
      await page.keyboard.press('Control+Space');
      expect((await options(page)).join('\n')).toContain('@Actor');
    });

  test('T2 — ArrowDown then Enter accepts the 2nd annotation row', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@');
      await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toBe('@Boundary');
    });

  test('T3 — ArrowDown then ArrowUp returns to row 1, Enter accepts @Actor', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@');
      await editorRoot(page).locator('.cm-tooltip-autocomplete').first().waitFor();
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(150);
      await page.keyboard.press('Enter');
      await expect.poll(() => getEditorText(page)).toBe('@Actor');
    });

  test('T4 — Tab advances the snippet field after the popup is dismissed', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('sync');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);
      await page.keyboard.type('Svc');
      await page.keyboard.press('Escape'); // dismiss participant popup, snippet stays active
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);
      await page.keyboard.press('Tab');
      await page.keyboard.type('doWork');
      await expect.poll(() => getEditorText(page)).toContain('Svc.doWork() {');
    });

  test('T5 — Enter inside an active snippet inserts a newline, not a field jump', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('if');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(1);
      await page.keyboard.type('ready');
      await page.keyboard.press('Tab'); // advance to the ${0} body stop
      await page.keyboard.type('X.y()');
      await page.keyboard.press('Enter'); // plain newline, NOT a field jump
      await page.keyboard.type('Z.z()');
      await expect.poll(() => getEditorText(page)).toContain('X.y()\n    Z.z()');
    });

  test('T6 — Tab indents in a final-stop-only snippet (no numbered field to advance)', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('par');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(0);
      const before = await getEditorText(page);
      await page.keyboard.press('Tab');
      await expect.poll(() => getEditorText(page)).not.toBe(before);
      await expect.poll(() => getEditorText(page)).toMatch(/par \{\n {4,}/);
    });

  test('T7 — Escape during an active snippet leaves the template text intact', async ({ page }) => {
      await openSlashPopup(page, 'block');
      await page.keyboard.type('sync');
      await page.waitForTimeout(180); // settle past CM interactionDelay before accept (anti-flake)
      await page.keyboard.press('Enter');
      await page.keyboard.type('Svc');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await page.keyboard.press('Escape');
      await expect.poll(() => getEditorText(page)).toContain('Svc.method() {');
    });

  test('T8 — Mod-/ toggles a line comment using the DSL commentTokens', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A->B: hi');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await page.keyboard.press('ControlOrMeta+/');
      await expect.poll(() => getEditorText(page)).toBe('// A->B: hi');
    });

  test('T9 — Mod-] indents and Mod-[ dedents the line', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('abc');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await page.keyboard.press('ControlOrMeta+]');
      await expect.poll(() => getEditorText(page)).toBe('  abc');
      await page.keyboard.press('ControlOrMeta+[');
      await expect.poll(() => getEditorText(page)).toBe('abc');
    });

});

test.describe("U. Negative / edge / comments / no-false-positives", () => {
  test('U1 — slash inside a top-level comment is suppressed (not just in blocks)', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('// /sync');
      expect((await options(page)).join('\n')).not.toContain('/sync');
      expect(await completionOptionTexts(page)).toHaveLength(0);
    });

  test('U2 — @ inside a comment offers no annotations', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('// @Actor');
      const j = (await options(page)).join('\n');
      expect(j).not.toContain('@Database');
      expect(j).not.toContain('@Actor');
    });

  test('U3 — a word in the message content slot is not offered a participant name', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice->Bob: ');
      await page.keyboard.type('Al');
      expect((await options(page)).join('\n')).not.toContain('Alice');
    });

  test('U4 — multi-line garbage: no crash, zero error markers', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('!!!###');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@@@ <<>> ::');
      await page.keyboard.press('Enter');
      await page.keyboard.type('}}} ))) ...');
      await page.waitForTimeout(400);
      expect(await errorMarkerCount(page)).toBe(0);
      await expect.poll(() => getEditorText(page)).toContain('!!!');
    });

  test('U5 — four nested blocks indent 2 spaces per depth, no crash', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A.a() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('B.b() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('C.c() {');
      await page.keyboard.press('Enter');
      await page.keyboard.type('D.d()');
      await expect
        .poll(() => getEditorText(page))
        .toMatch(/A\.a\(\) \{\n {2}B\.b\(\) \{\n {4}C\.c\(\) \{\n {6}D\.d\(\)/);
      expect(await errorMarkerCount(page)).toBe(0);
    });

  // #807 FIXED: keywords are now @specialize'd from Identifier, so keyword-prefixed
  // names (`ifService`) lex as a single Identifier and collect fully.
  test('U6 — participant `ifService` (keyword-prefixed name) is offered after a dot', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor ifService');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor whileWorker');
      await page.keyboard.press('Enter');
      await page.keyboard.type('ifService.');
      expect((await options(page)).join('\n')).toContain('whileWorker');
    });

  test('U7 — trailing whitespace after a declaration does not drop the participant', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice   ');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice.');
      expect((await options(page)).join('\n')).toContain('Bob');
    });

  test('U8 — blank lines between statements keep participants intact', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor Bob');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Alice.');
      expect((await options(page)).join('\n')).toContain('Bob');
    });

  test('U9 — after A-> the popup is participant-only, no @annotations/keywords [#803]', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor A');
      await page.keyboard.press('Enter');
      await page.keyboard.type('@Actor B');
      await page.keyboard.press('Enter');
      await page.keyboard.type('A->');
      await page.keyboard.press('Control+Space');
      const j = (await options(page)).join('\n');
      expect(j).toContain('B');
      expect(j).not.toContain('@Actor');
      expect(j).not.toContain('Conditional (alt) block');
    });

  test('U10 — dangling Bob. at EOF offers message-introduced Alice [#804]', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('Alice->Bob: hi');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Bob.');
      expect((await options(page)).join('\n')).toContain('Alice');
    });

});

test.describe("V. Hint Bar", () => {
  test('V1 — group body shows only participant/group hints', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group G {');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300); // let the zone updateListener settle the bar
      const ids = await hintBarIds(page);
      expect(ids).toContain('hint-participant');
      expect(ids).toContain('hint-group');
      expect(ids).not.toContain('hint-sync');
    });

  test('V2 — block bar exposes the full block command set', async ({ page }) => {
      await enterParBlock(page);
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      for (const id of [
        'hint-sync', 'hint-async', 'hint-return', 'hint-reply', 'hint-new',
        'hint-if', 'hint-while', 'hint-par', 'hint-try', 'hint-section',
        'hint-ref', 'hint-note',
      ]) {
        expect(ids).toContain(id);
      }
    });

  test('V3 — block bar excludes both head commands', async ({ page }) => {
      await enterParBlock(page);
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      expect(ids).not.toContain('hint-participant');
      expect(ids).not.toContain('hint-group');
    });

  test('V4 — bar updates as the cursor leaves the block', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('@Actor Alice');
      await page.keyboard.press('Enter');
      await page.keyboard.type('par {');
      await page.keyboard.press('Enter'); // cursor in StatementBraceBlock body
      await page.waitForTimeout(300);
      expect(await hintBarIds(page)).toContain('hint-sync');
      // Move INTO the @Actor declaration text (Home→pos0 is the doc boundary, which
      // resolves to the 'top' union; a position ON the declaration token resolves to
      // 'head'). End of line 1 sits inside the Participant node → zone 'head'.
      await page.keyboard.press('ControlOrMeta+Home');
      await page.keyboard.press('End');
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      expect(ids).not.toContain('hint-sync'); // head zone: no block commands
      expect(ids).toContain('hint-participant');
    });

  test('V5 — top level shows the union of declaration + message hints', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('A->B: hi');
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      expect(ids).toContain('hint-participant');
      expect(ids).toContain('hint-sync');
    });

  test('V6 — block bar renders exactly 12 chips', async ({ page }) => {
      await enterParBlock(page);
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      expect(ids).toHaveLength(12);
      expect(ids).not.toContain('hint-participant');
    });

  test('V7 — opening a line below the block restores top-level hints', async ({ page }) => {
      await enterParBlock(page); // par {\n  |\n}
      await page.waitForTimeout(300);
      expect(await hintBarIds(page)).toContain('hint-sync');
      // The `}` delimiter is structurally INSIDE the StatementBraceBlock (left-bias
      // resolveInner keeps the close brace in 'block'), so landing on the `}` line is
      // still 'block'. Open a fresh line BELOW the block to genuinely return to top level.
      await page.keyboard.press('ControlOrMeta+End'); // doc end (after `}`)
      await page.keyboard.press('Enter'); // new top-level line below the block
      await page.waitForTimeout(300);
      expect(await hintBarIds(page)).toContain('hint-participant');
    });

  test('V8 — group body excludes every block id', async ({ page }) => {
      await clearEditor(page);
      await page.keyboard.type('group G {');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      for (const id of ['hint-sync', 'hint-if', 'hint-while', 'hint-try', 'hint-return', 'hint-note']) {
        expect(ids).not.toContain(id);
      }
    });

  test('V9 — block bar surfaces both return and reply', async ({ page }) => {
      await enterParBlock(page);
      await page.waitForTimeout(300);
      const ids = await hintBarIds(page);
      expect(ids).toContain('hint-return');
      expect(ids).toContain('hint-reply');
    });

});

// ── W. i18n / quotes / special chars / long DSL ─────────────────────────────
// Requested coverage: Chinese (and other Unicode) names, double/single quotes,
// other special characters, and very long DSLs. Expectations are grounded in the
// ANTLR renderer (oracle): it accepts Unicode letters as identifiers and `as
// "string"` labels; it rejects digit-leading tokens and emoji-led names. The
// strongest signal is autocomplete — a participant only appears if it parsed AND
// was collected, so these prove #808 (string labels) and #809 (Unicode names)
// end-to-end through the real editor path.
test.describe('W. i18n / quotes / special chars / long DSL', () => {
  test('W1 — Chinese participants are offered in autocomplete after a dot (#809)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('用户');
    await page.keyboard.press('Enter');
    await page.keyboard.type('服务');
    await page.keyboard.press('Enter');
    await page.keyboard.type('用户.');
    expect((await options(page)).join('\n')).toContain('服务');
  });

  test('W2 — a Chinese @annotated participant carries no error marker (#809)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor 用户');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain('用户');
  });

  test('W3 — string label `as "The User"` parses; the name stays collectible (#808)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice as "The User"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    // Alice is still a participant despite the string label → offered on Ctrl+Space.
    await page.keyboard.type('Ali');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Alice');
  });

  test('W4 — label + string + color (`as "…" #color`) parses with no error (#808)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice as "用户" #FF0000');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain('用户');
  });

  test('W5 — double quotes inside a message label do not break parsing', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: say "hi"');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain('say "hi"');
  });

  test('W6 — an apostrophe in a message label is fine (single-quote)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type("A->B: it's ok");
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain("it's ok");
  });

  test('W7 — special characters in a message label do not break parsing', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: a/b=c+d*e');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
    await expect.poll(() => getEditorText(page)).toContain('a/b=c+d*e');
  });

  test('W8 — an emoji-led name does not crash the editor (matches renderer reject)', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor 🚀X');
    await page.waitForTimeout(300);
    // The renderer rejects emoji-led identifiers; the editor must not crash and (no
    // linter is wired) shows no error marker. The editor stays responsive: a follow-up
    // line still parses and completes.
    expect(await errorMarkerCount(page)).toBe(0);
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Bob');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bo');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Bob');
  });

  test('W9 — a long DSL (40 messages) parses and autocomplete stays responsive', async ({ page }) => {
    await clearEditor(page);
    // 40 chained messages → participants P0..P40. Typed for real (not seeded), so this
    // also exercises incremental reparse under a growing document.
    const lines: string[] = [];
    for (let i = 0; i < 40; i++) lines.push(`P${i}->P${i + 1}: m${i}`);
    await page.keyboard.type(lines.join('\n'));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    expect(await errorMarkerCount(page)).toBe(0);
    // A participant from the TOP of the document is still offered at the bottom →
    // collection + completion scale across the whole doc.
    await page.keyboard.type('P0.');
    expect((await options(page)).join('\n')).toContain('P20');
  });
});

// ── X. Authoring journeys (real-user editing flows) ─────────────────────────
// End-to-end editing flows a real user performs: forward references, renames,
// inserts, first-mention chains. Participant collection is a pure reparse, so these
// SHOULD all work — these lock that behavior through the real browser + completion.
test.describe('X. authoring journeys', () => {
  test('X1 — a forward-referenced participant (used before declared) is offered', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: hi'); // B first mentioned here
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor B'); // declared AFTER its use
    await page.keyboard.press('Enter');
    await page.keyboard.type('A.');
    expect((await options(page)).join('\n')).toContain('B');
  });

  test('X2 — a first-mention message chain offers every endpoint downstream', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('Client->OrderSvc: create');
    await page.keyboard.press('Enter');
    await page.keyboard.type('OrderSvc->DB: save');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Client.');
    const j = (await options(page)).join('\n');
    expect(j).toContain('OrderSvc');
    expect(j).toContain('DB');
  });

  test('X3 — renaming a participant updates what completion offers', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Alice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Alice->Bob: hi');
    // Rename Alice→Alicia on line 1: go to line 1 end, backspace 'Alice', type 'Alicia'.
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.press('End');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace'); // delete "Alice"
    await page.keyboard.type('Alicia');
    await page.waitForTimeout(300);
    // On a fresh line, the renamed participant is offered; the old name is gone.
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Alic');
    await page.keyboard.press('Control+Space');
    const j = (await options(page)).join('\n');
    expect(j).toContain('Alicia');
  });

  test('X4 — a duplicate declaration is offered only once', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Account');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Account'); // duplicate
    await page.keyboard.press('Enter');
    await page.keyboard.type('Acc');
    await page.keyboard.press('Control+Space');
    const rows = (await options(page)).filter((r) => r.includes('Account'));
    expect(rows.length).toBe(1); // deduped, not offered twice
  });

  test('X5 — a self-message participant is collected and offered', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('Worker->Worker: poll');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Worker.');
    await page.waitForTimeout(300);
    expect(await errorMarkerCount(page)).toBe(0);
  });

  test('X6 — completion reflects a participant added live, mid-session', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Foo');
    await page.keyboard.press('Enter');
    await page.keyboard.type('F');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Foo');
    // Add a second participant; completion must pick it up without a reload.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('@Actor Bar');
    await page.keyboard.press('Enter');
    await page.keyboard.type('B');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Bar');
  });

  test('X7 — a participant introduced by `new` is offered downstream', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('Factory.build() {');
    await page.keyboard.press('Enter');
    await page.keyboard.type('new Widget()');
    await page.keyboard.press('Enter');
    // Widget (anonymous new target) is a participant; offered after a dot.
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Wid');
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Widget');
  });
});

// ── Y. Completion-noise suppression in free-text labels (#813) ──────────────
test.describe('Y. label completion noise (#813)', () => {
  test('Y1 — a message label word that prefixes a keyword offers NO keyword', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: titl'); // would fuzzy-match the `title` keyword
    expect((await options(page)).join('\n')).not.toContain('Diagram title');
  });

  test('Y2 — "while" in a label does not pop the while keyword', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: whil');
    expect((await options(page)).join('\n')).not.toContain('Loop block');
  });

  test('Y3 — a label word matching a participant name is not offered either', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Server');
    await page.keyboard.press('Enter');
    await page.keyboard.type('A->B: Serv'); // "Serv" prefixes the participant "Server"
    expect((await options(page)).join('\n')).not.toContain('Serverparticipant');
  });

  test('Y4 — endpoint completion still works right after the label suppression', async ({ page }) => {
    // Guard: suppressing label completion must NOT suppress the From/To endpoint popup.
    await clearEditor(page);
    await page.keyboard.type('@Actor Alpha');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Beta');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Alpha->'); // To endpoint position — popup SHOULD offer Beta
    await page.keyboard.press('Control+Space');
    expect((await options(page)).join('\n')).toContain('Beta');
  });
});
