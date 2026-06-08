// End-to-end acceptance for the ZenUML DSL editor LANGUAGE features, driven at
// KEYSTROKE level against the real preview build. Each test asserts the
// OBSERVABLE end state (final editor text, option lists, marker counts, snippet
// field counts) — never an internal/unit signal. This is the final acceptance
// gate the project requires: the whole user journey, not the first step.
//
// Preconditions: a vite PREVIEW server is already serving web/dist at the
// config baseURL (http://localhost:4173). After any SOURCE change, `yarn build`
// then re-run — the preview serves the built bundle, not live source.

import { test, expect } from '@playwright/test';
import {
  seedAndOpen,
  clearEditor,
  getEditorText,
  editorContent,
  editorRoot,
  openSlashPopup,
  completionOptionTexts,
  acceptCompletion,
  errorMarkerCount,
  snippetFieldCount,
  openBlockWithoutAutoClose,
} from './helpers/editor';

test.beforeEach(async ({ page }) => {
  await seedAndOpen(page);
});

// ---------------------------------------------------------------------------
// Journey 1 — slash insert + MULTI-FIELD Tab / Shift-Tab navigation.
// This is the regression that shipped: a per-keystroke reconfigure wiped the
// snippet state so Tab fell through to acceptCompletion and every field's text
// piled into field 1. The assertions below are on FINAL EDITOR TEXT — if any
// fail, the Phase-1 fix is INCOMPLETE; do NOT weaken them.
// ---------------------------------------------------------------------------
test.describe('slash snippet multi-field navigation', () => {
  test('/sync: field 1 (target) then Tab to field 2 (method) land in the right slots', async ({
    page,
  }) => {
    await openSlashPopup(page, 'block'); // cursor inside A.run() { ... }
    await page.keyboard.type('sync'); // narrow popup to /sync
    await acceptCompletion(page); // insert the snippet template

    // Snippet is live: the two ${n} fields must be present (the regression made
    // this 0 before the user could Tab).
    await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);

    await page.keyboard.type('Svc'); // -> field 1 (the `A` target placeholder)
    await page.keyboard.press('Tab'); // advance to field 2
    await page.keyboard.type('doWork'); // -> field 2 (the `method` placeholder)

    // OBSERVABLE END STATE: target + method landed in their OWN slots, nested
    // inside the outer block. If Tab had fallen through, this would read
    // `SvcdoWork.method()` (everything in field 1).
    await expect.poll(() => getEditorText(page)).toContain('Svc.doWork() {');
  });

  test('/sync: Shift-Tab returns to field 1 (method already typed in field 2 survives)', async ({
    page,
  }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('sync');
    await acceptCompletion(page);
    await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(2);

    await page.keyboard.type('Svc'); // field 1
    await page.keyboard.press('Tab'); // -> field 2
    await page.keyboard.type('doIt'); // field 2 method
    await page.keyboard.press('Shift+Tab'); // <- back to field 1
    await page.keyboard.type('XX'); // replaces field-1 content

    // Shift-Tab proven: field-1 target is now `XX` while field-2 `doIt` SURVIVED.
    await expect.poll(() => getEditorText(page)).toContain('XX.doIt() {');
  });

  test('/if: condition lands in the predicate, Tab moves to the body', async ({ page }) => {
    await openSlashPopup(page, 'block');
    await page.keyboard.type('if');
    await acceptCompletion(page);

    // /if has one numbered field (${1:condition}) then the final ${0} body stop.
    await expect(editorRoot(page).locator('.cm-snippetField')).toHaveCount(1);

    await page.keyboard.type('x > 0'); // -> the condition predicate
    await page.keyboard.press('Tab'); // -> the body (final cursor)
    await page.keyboard.type('A->B: yes'); // body statement

    // OBSERVABLE END STATE: predicate inside if(...), message inside the braces.
    await expect
      .poll(() => getEditorText(page))
      .toContain('if(x > 0) {');
    await expect.poll(() => getEditorText(page)).toContain('A->B: yes');
  });
});

// ---------------------------------------------------------------------------
// Journey 2 — zone gating: which slash commands are offered depends on the
// cursor's parse zone (Head vs StatementBraceBlock).
// ---------------------------------------------------------------------------
test.describe('slash zone gating', () => {
  test("'/' at document head offers only /participant and /group", async ({ page }) => {
    await openSlashPopup(page, 'head');
    const opts = await completionOptionTexts(page);
    const joined = opts.join('\n');

    expect(joined).toContain('/participant');
    expect(joined).toContain('/group');
    // Block-only commands must NOT leak into the head.
    expect(joined).not.toContain('/if');
    expect(joined).not.toContain('/sync');
    expect(opts).toHaveLength(2);
  });

  test("'/' inside a block offers control-flow commands (and not head-only ones)", async ({
    page,
  }) => {
    await openSlashPopup(page, 'block');
    const joined = (await completionOptionTexts(page)).join('\n');

    expect(joined).toContain('/if');
    expect(joined).toContain('/sync');
    expect(joined).toContain('/while');
    // /participant is head-only — must not appear inside a block.
    expect(joined).not.toContain('/participant');
  });
});

// ---------------------------------------------------------------------------
// Journey 3 — participant autocomplete: declared participants are offered.
// ---------------------------------------------------------------------------
test.describe('participant autocomplete', () => {
  test("declared participants are offered ('Al' + Ctrl+Space -> Alice)", async ({ page }) => {
    await clearEditor(page);
    // Declare two participants in the head.
    await page.keyboard.type('@Actor Alice');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Actor Bob');
    await page.keyboard.press('Enter');

    // Type a partial name and explicitly invoke completion.
    await page.keyboard.type('Al');
    await page.keyboard.press('Control+Space');
    await page.locator('.cm-tooltip-autocomplete').first().waitFor({ timeout: 5000 });

    const joined = (await completionOptionTexts(page)).join('\n');
    // 'Al' prefix-matches the DECLARED participant Alice (Bob is filtered out by
    // the prefix). The option row carries the 'participant' detail.
    expect(joined).toContain('Alice');
    expect(joined).toContain('participant');
  });
});

// ---------------------------------------------------------------------------
// Journey 4 — NO false error markers on renderer-valid DSL.
// NOTE: the DSL editor wires no linter (the Lezer linter is intentionally
// disabled because the editor grammar under-accepts vs the renderer's ANTLR
// grammar). So this PASSES TRIVIALLY today — it is a GUARD that a future linter
// must not false-positive on these renderer-valid shapes, not a grammar test.
// ---------------------------------------------------------------------------
test.describe('no false error markers on valid DSL', () => {
  test('declare-then-message + annotation + #color shows zero error markers', async ({ page }) => {
    await clearEditor(page);
    await page.keyboard.type('@Actor Client #FFEBE6');
    await page.keyboard.press('Enter');
    await page.keyboard.type('@Database DB');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Client->DB: query');
    await page.keyboard.press('Enter');

    // Give any linter a chance to run before asserting absence.
    await page.waitForTimeout(400);
    expect(await errorMarkerCount(page)).toBe(0);
    // Sanity: the text we typed is actually in the editor (not a no-op pass).
    await expect.poll(() => getEditorText(page)).toContain('Client->DB: query');
  });
});

// ---------------------------------------------------------------------------
// Journey 5 — syntax highlighting: key tokens carry a non-default color.
// ---------------------------------------------------------------------------
test.describe('syntax highlighting', () => {
  test('an async-message content span is colored differently from the base foreground', async ({
    page,
  }) => {
    await clearEditor(page);
    await page.keyboard.type('A->B: Hello');
    await page.waitForTimeout(300); // let the Lezer tree + highlight settle

    const content = editorContent(page);
    const baseColor = await content.evaluate((e) => getComputedStyle(e).color);

    // Collect (text, color) for every styled span on the line.
    const spans = await content
      .locator('.cm-line span')
      .evaluateAll((els) =>
        els.map((e) => ({ text: e.textContent ?? '', color: getComputedStyle(e).color })),
      );

    // The message content "Hello" (LineContent -> t.string -> green in ink) must
    // carry a color DISTINCT from the editor's base foreground.
    const helloSpan = spans.find((s) => s.text === 'Hello');
    expect(helloSpan, 'expected a span for the message content "Hello"').toBeTruthy();
    expect(helloSpan!.color).not.toBe(baseColor);

    // And at least one other token (the arrow) is also non-default — proving the
    // highlight is structural, not a one-off.
    const arrowSpan = spans.find((s) => s.text === '->');
    expect(arrowSpan, 'expected a span for the arrow "->"').toBeTruthy();
    expect(arrowSpan!.color).not.toBe(baseColor);
  });
});

// ---------------------------------------------------------------------------
// Journey 6 — AUTO-INDENTATION inside a brace block.
// closeBrackets auto-pairs `{` -> `{}`, so to test the literal "type `}` to
// dedent" behaviour we open WITHOUT the autopair (openBlockWithoutAutoClose
// Deletes the inserted closer), then drive Enter + `}` by hand.
// ---------------------------------------------------------------------------
test.describe('auto-indentation', () => {
  test('Enter inside a block indents one unit; typing `}` dedents to the opener column', async ({
    page,
  }) => {
    await clearEditor(page);
    await openBlockWithoutAutoClose(page); // -> "A.run() {" (bare opener)
    await page.keyboard.press('Enter'); // new body line, indented one unit

    // After Enter the body line is indented exactly two spaces.
    await expect
      .poll(() => getEditorText(page))
      .toMatch(/A\.run\(\) \{\n {2}$/);

    await page.keyboard.type('B->C: hi'); // statement on the indented body line
    await page.keyboard.press('Enter'); // next body line, still indented
    await page.keyboard.type('}'); // typing `}` dedents to column 0

    // OBSERVABLE END STATE: opener at col 0, body indented 2 spaces, closing `}`
    // dedented back to col 0.
    await expect
      .poll(() => getEditorText(page))
      .toBe('A.run() {\n  B->C: hi\n}');
  });
});
