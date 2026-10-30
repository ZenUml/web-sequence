# Core Editor implementation report

Branch `codex/editor-core-claude`, base `12cf0e4d`. Nothing was committed, merged, pushed or deployed. Figma was read from the provided exports only.
Scope: core Editor (Figma 32:4370 Light, 32:4188 Soft Dark Darcula). Settings / Code appearance not touched.

## Header and navigation refinement (approved, verified 2026-10-20)

References: `editor-header-final-light.png`, `editor-header-final-dark.png`, `editor-header-final-account.png` (Figma Light 32:4370, Dark 32:4188, account board 36:8974).

### What changed

```
before:  [logo ▾ menu] [sidebar] Diagrams / Title · Saved      [Fork] [Share] [■ Present] (theme) [Sign in]
after:   [logo]        [sidebar] Diagrams / Title · Saved  [■ + New] [Fork] [Share] [Present] (theme) [Sign in]

footer:  Custom CSS                 Report a bug   →   Custom CSS   Help        Report a bug
account: name/email | Upgrade or My Plan | Sign out  →  name/email | Pricing | Upgrade or My Plan | Sign out
sign-in dialog (signed out):  providers              →  providers + small "Pricing" link
```

1. **New** (`header-new`): the one primary toolbar button, with the shared plus icon (`web/src/ui/PlusIcon.tsx`, the same glyph as the add-page `+`, which now uses it) and the label "New".
   - It opens a blank diagram: empty DSL and CSS, title "Untitled", a new id in the URL. This is the same `handleNewDiagram` that the hub's New diagram uses. No template picker.
   - Data-loss guard: the existing "Discard unsaved changes?" dialog. It now also triggers on a metadata-only edit (rename), because it reads the same `dirty` flag as the save indicator. Before, a dirty rename with `unsavedCount 0` was discarded without asking (unit test written first, failed before the change).
   - A clean diagram is already stored, so New is immediate and the previous diagram stays in the Diagrams hub (browser test).
   - Below 1180px it collapses to a 36px icon button named "New", like Fork/Share/Present.
   - New drops `?share-token=`, `?code=` and `?title=` from the URL. Without this, New on a shared or `?code=`-seeded diagram kept those params, so a reload would look the new id up as a share or re-seed the old code. The unit test was written first and failed (`code` was still `A.b()`). This is a no-op for the hub, which never has those params.
   - Browser Back after New changes the URL but does not swap the document back, because boot resolves once per mount. The hub's New diagram behaves the same way (existing behaviour, not changed).
2. **Present** is a secondary outline button. Its computed background, text and border colours equal Fork's in light and dark; hover equals Fork's hover; keyboard focus shows the focus outline. Present → full-screen → Exit still works.
3. **Logo** is a static mark (`header-logo`, not a button): no dropdown, no arrow. `AppMenu.tsx` was deleted, and the AppHeader props `onSave`, `onOpenSettings`, `onOpenCreateNew`, `onOpenHelp`, `onOpenCheatSheet`, `onOpenShortcuts` were removed. The `CheatSheetModal` mount and the `'cheatsheet'` modal id were removed because nothing opens them now; the component file stays.
   - Normal shortcuts still work: ⌘S saves, Ctrl/⌘+Shift+? opens Keyboard shortcuts, and the editor keymaps are unchanged.
4. **Help** (`footer-help`) is in the code-column footer between Custom CSS and Report a bug. It opens the existing Help dialog (Docs, Contact, GitHub links). Report a bug is unchanged.
5. **Pricing**:
   - Signed in: `profile-pricing` is in the account menu above Upgrade plan / My Plan. Name, email, avatar, plan actions and Sign out are unchanged. Pricing opens the existing plans dialog only. A browser test checks that no checkout call happens.
   - Signed out: the header still shows only Sign in. The sign-in dialog has a small "Pricing" link (`login-pricing`). It closes sign-in and opens the plans dialog. Provider buttons and copy are unchanged.
   - Both are gated by `paymentEnabled`, like the old menu entry, because the plans dialog only mounts when payments are on.
   - The editor's account menu now uses the editor menu surface (`editor-hifi-menu`, the class the deleted logo menu used). Before, it kept the design-system dark surface in both appearances. Now it is white in light and the editor surface in dark, as on the account board. The unit test was written first and failed.
6. **Expanded Custom CSS row.** Help is rendered in both panel states. In the expanded header it made the row wrap to two rows at 1440 (69px instead of 44px). The browser test was written first and failed. Now, when the panel is expanded, Report a bug is icon-only (its name stays "Report a bug", as at narrow widths already), and Help has no left offset. The row is 44px at 1440 and 1280. At 900 it wraps, as it did before Help.

### Geometry at 1440×960 (measured, light = dark)

| Element | Reference | Build |
|---|---|---|
| New | x874 y10 90×36, fill #217bb3 | x874 y10 90×36, fill rgb(33,123,179) |
| New → Fork gap | 12 (Fork x976) | 12 (Fork x976) |
| New plus ink / label ink | x893–900 / x917–945 | x892–901 / x917–945 |
| Present | x1172 116×36, secondary | x1172 116×36, secondary |
| Logo / sidebar toggle | logo ink x24–49, toggle icon ink x98–117 | logo ink x24–49, toggle box x92 (icon ink x100–115: the existing 20px icon draws 4px narrower) |
| "Diagrams" ink | x145 | x145 |
| Footer Help text | x152 | x152.6 |

To land Fork on x976, Sign in gets `min-width: 76px` (it was 76.6px, which put the whole action group 0.6px left).

### Known differences from the reference (not changed)
- The text inside Fork, Share and Present sits 5–8px right of the reference: the build centres the content and the reference pads it to the left. Fork and Share come from earlier approved work, and Present now matches Fork, as asked.
- The New plus is 1px wider than the reference ink, and the plus is raised 3px to match the reference's position.
- The pixel diff of the New button region against the export is 5.4% (light) / 5.2% (dark), mostly text anti-aliasing.
- Account board, "Payments unavailable" column: it shows Pricing. The build hides Pricing when `paymentEnabled` is false, because the plans dialog does not mount then and the item would do nothing.
- The account menu keeps its existing label style (mono, uppercase name and email) and has no item icons. The board shows a bold name and icons. Kept, because the prompt says to keep the existing account content.

### What the user loses or must find elsewhere (decision needed at integration)
- **Settings has no trigger in this checkout.** Its only entry was in the logo menu. The prompt names the replacement "Code appearance (independent task/bottom control)", which is not in this worktree. `SettingsModal` stays mounted and `openModal('settings')` still works, so the bottom control only has to call it.
  - These root tests now skip with that reason: SET-1…SET-6, SET-8, MOB-4, PRV-6, modals "Settings modal", and cloud SET-7.
- **DSL cheat sheet** is no longer reachable (removed as asked).
- **New from template** left the editor. Templates are still in the Diagrams hub (the empty state's template button and the hub menu's "From template…").
- **Save** menu item removed; ⌘S and auto-save remain.

### Tests (failing first)
- Unit, red before implementation (18 failures), then green:
  - `AppHeader.test.tsx`: New is the one primary button, before Fork; guard; logo static; no menu entries; Present secondary; order New/Fork/Share/Present; Pricing in the account menu and the sign-in dialog.
  - `ProfileMenu.test.tsx`: Pricing order and no checkout.
  - `LoginModal.test.tsx`: Pricing link only when wired.
  - `AppRoot.test.tsx`: New opens a blank diagram with a new URL id; dirty rename asks first; footer Help order and dialog; ⌘S save.
- Browser, new `web/e2e/header-nav.spec.ts` (14 tests):
  - geometry and colours, light and dark
  - Present style, hover and focus
  - logo opens no menu
  - footer Help
  - New on a saved diagram keeps the old one in the hub
  - New with unsaved edits: Keep editing / Discard
  - Present enter and exit
  - signed-out Pricing link
  - ⌘+Shift+? shortcut
  - 900px header and footer fit
- Root specs moved off the menu:
  - menu Save becomes ⌘S (`saveViaShortcut`)
  - menu New becomes the toolbar button (persistence test now expects a blank diagram)
  - Help comes from the footer
  - Pricing comes from the sign-in dialog or the account menu
  - Create-New comes from the hub
  - cheat-sheet tests deleted
  - embed probes use `header-new`
  - new cloud test SUB-6 for account-menu Pricing

### Validation (after the last change)
| Check | Result |
|---|---|
| `tsc --noEmit` (web) | pass |
| `vite build` | pass |
| vitest (web, full) | 1136 passed, 1 skipped, **but 2 unhandled errors (exit 1)**: missed in this report at the time, found by independent acceptance. Fixed below. |
| web E2E `header-nav` + `editor-geometry` + `gutter` + `report-bug` | 34/34 |
| root chromium, 13 touched specs, `CI=1 --workers=1 --retries=0` | 53 passed, 18 skipped (10 are the Settings skips above; 8 were already skipped) |
| root cloud `cloud.spec.js`, `PW_CLOUD=1 --workers=1 --retries=0` | 37 passed, 1 skipped (SET-7, Settings) |
| root chromium `templates` + `telemetry` (untouched; failed in an earlier broad run at 18:50) | templates 7/7. telemetry: ANL-1 "fires once per editor boot" failed on the first cold run, then 5/5 twice. Templates are reached through the hub, not the header. |
| ESLint | not run: `npx eslint` picked ESLint 10 and found no flat config in `web/`; there is no working lint setup for `web/src` here |

Cloud notes:
- At first the Diagrams agent's emulator (cwd `/private/tmp/diag-emu`) held 8080/9099/4400. I waited until it was gone and did not touch it.
- My own orphaned emulators were stopped after each run, after checking their cwd was this worktree.
- SUB-4 (free user over the cap) failed every time after the Save menu click became ⌘S.
  - Cause: `save()` enforces the cap only after the subscription read resolves. Its race guard fails open while loading, by design. ⌘S lands before that read finishes; the old two menu clicks took long enough.
  - Fix: the test now waits 2s after sign-in before saving. Product behaviour is unchanged.
  - Result: 5 of 6 isolated runs passed and the full run passed. The one failure was a cold first start. This test still depends on timing.

### Acceptance follow-up (2026-10-20)

**1. New, then reload, replaced the blank diagram with the sample.**
- Repro (independent acceptance): open `/?code=…&title=Imported`, click New, wait 1s with preserveLastCode on, reload. The URL kept the blank id, but the editor showed the Alice/Bob sample under another id.
- Cause: a blank New diagram is never saved, so it exists only in the local last-code slot (written on `beforeunload`). Boot looked up `?id=`, missed, and went to `newItem()` (sample). The last-code slot is only read when there is no `?id=`. The hub's New diagram has the same path.
- Fix (`useBootItem.ts`, `resolveBootItem` branch 2): on an `?id=` miss with preserveLastCode on, if the last-code draft has that same id, restore it (`lastcode`), even when blank. Nothing is saved, no cloud write; the save state stays "Local only" (`local-new`).
- Tests, failing first:
  - unit `useBootItem.test.tsx`: draft with the matching id is restored (was `new`); other id still `new`; preserveLastCode off does not read the slot.
  - browser `header-nav.spec.ts` "New from an inline ?code= import stays blank, with the same id, after reload": before the fix it failed with the sample DSL after reload. It checks title, DSL, CSS and id through the app's own last-code write, URL id, `local-new`, and that no item was stored under the id.
- Telemetry: this boot now reports `landed_in_editor{label:"lastcode"}` where it reported `"new"` before. Parent owns telemetry integration.
- The browser test clears the last-code slot before reload, so the app's own `beforeunload` write must restore it.
- Limits: with preserveLastCode off, a reload of an unsaved New diagram still opens the sample (the user opted out of last-code restore). Only the most recent unsaved draft is in the slot.

**2. Vitest exited 1 with an unhandled CodeMirror error.**
- `TypeError: Cannot read properties of undefined (reading 'top')` in `InlineCoordsScan.scan`, from the mousedown of `userEvent.click` in AppRoot "fires 'first_edit' once…" (and "Plus user editing CSS…").
- Baseline: HEAD source in a temp copy had no error. A file-level bisect isolates the inherited `CodeEditor.tsx` changes (the exact hunk was not pinned). Mechanism, proven by the reproducer: jsdom returns no rects on a multi-span line.
- Cause: jsdom returns no client rects. On a multi-span line CodeMirror finds no rect above, below or on the pointer and reads `.top` of undefined. A browser always returns rects for rendered spans, and the browser suites click the editor, so this is test geometry, not a product defect. Product code is unchanged.
- Fix (`src/test/setup.ts`): inside `.cm-content` only, `getClientRects()` on elements and text ranges returns the (zero) bounding box as one rect.
- Test, failing first: `src/test/jsdomGeometry.test.tsx` clicks a highlighted DSL line and asserts no uncaught error (failed with the same TypeError). AppRoot analytics assertions are unchanged.

| Check | Result |
|---|---|
| vitest (web, full) | 1140 passed, 1 skipped, 0 unhandled errors |
| `tsc --noEmit` (web) | pass |
| web E2E `header-nav.spec.ts` (built app, port 4399) | 16/16 |

### Screenshots (`web/.shots/followup/header-nav/`)
- `desktop-{light,dark}.png` (1440×960), `narrow-900-{light,dark}.png`, `mobile-390-{light,dark}.png`
- `present-hover-{light,dark}.png`, `present-focus-{light,dark}.png` (header crop)
- `signin-pricing-link-{light,dark}.png`, `anonymous-pricing-open-{light,dark}.png`
- `footer-help-open-{light,dark}.png`
- `new-unsaved-confirm-{light,dark}.png`, `new-blank-{light,dark}.png`
- `account-{free,pro,nopay}-{light,dark}.png`: the real `AppHeader` account menu with a mock signed-in user (Free, Pro, payments off). These were rendered from a temporary Vite harness, because the emulator was busy at the time; the harness files were deleted. The cloud test SUB-6 later checked the same menu with a real emulator sign-in.
- `css-expanded-{1440,1280,900}-{light,dark}.png`

### Files
- Product:
  - `AppHeader.tsx`, `AppMenu.tsx` (deleted), `ProfileMenu.tsx`, `LoginModal.tsx`
  - `AppRoot.tsx` (New = `handleNewDiagram`, footer Help, CheatSheet mount removed)
  - `uiStore.ts` (`'cheatsheet'` removed), `ui/PlusIcon.tsx` (new), `ui/index.ts`, `PageTabs.tsx` (uses `PlusIcon`)
  - `globals.css` (logo mark, New, footer Help, Sign in width, responsive New, expanded-row Help and icon-only Report a bug), `types.ts` (comment)
- Tests:
  - `AppHeader.test.tsx`, `ProfileMenu.test.tsx`, `LoginModal.test.tsx`, `AppRoot.test.tsx`, `web/e2e/header-nav.spec.ts` (new)
  - root `header`, `persistence`, `library`, `library-actions`, `export`, `multipage`, `modals`, `modals-gap`, `settings`, `mobile`, `preview`, `embed`, `cloud` specs, `helpers/cloud.js`
- Servers: the user preview server on 4411 was left running. My temporary servers (preview 4415, harness 4416) and my emulators were stopped after their cwd was checked.

## Changes

### Header (`AppHeader.tsx`)
- Height is 56px and the buttons are 36px. Logo and the sidebar toggle are grouped (the logo app menu was removed later, see "Header and navigation refinement"), followed by `Diagrams / <editable title>` and the save state.
- Title menu arrow (Rename/Duplicate) removed. Rename = edit the title field. Duplicate = new **Fork** button (same `forkCurrent`).
- Actions in order (superseded by "Header and navigation refinement": New is now the primary, Present is secondary): Fork, Share, Present (filled primary), then the appearance toggle and the account. Gaps 12 / 12, Present→theme 24, theme→account 8 (measured).
- Sidebar toggle (rectangle + left split, no arrow) collapses/expands the code pane and restores the dragged split width. Desktop only; mobile keeps its Edit|Preview tabs.
- Account: existing `ProfileMenu` for signed-in users is unchanged. Signed out: "Sign in" (secondary outline). The header "Pricing" link was removed. Pricing later moved to the account menu and the sign-in dialog (see "Header and navigation refinement").
- Save state is truthful:
  - read-only → "Read-only"
  - while saving → "Saving…"
  - dirty → "Unsaved"
  - signed in, clean → "Saved"
  - signed out, clean, item stored on this device → "Saved locally"
  - signed out, never saved yet → "Local only"
  - The browser check found that a fresh diagram is not stored until its first save, so the "never saved" state was added. Its test was written first and failed before the fix.

### Appearance (global light/dark)
- New Settings key `appearance: 'light' | 'dark'` (default `'light'`). It persists through the existing `handleSettingChange` path (syncStore + cloud user settings). Existing defaults are unchanged. The Settings modal is unchanged and has no Follow-app option.
- `src/app/appearance.ts`: mirrors the value to `<html data-appearance>`. `main.tsx` applies the stored value before first paint.
- `settingsStore` starts `appearance` from the same stored value, so AppRoot's appearance effect does not reset a dark user to light during boot. A MutationObserver check on reload logged `["dark","light","dark"]` before this fix and `["dark","dark"]` after. Its test was written first and failed before the fix.
- Semantic tokens in `globals.css` (`--editor-*`, `--code-*`) replace the old teal palette with the prompt's blue light/dark colors. Button states (hover, pressed, focus, disabled) come from the Figma state board. Menus and selects opened from the editor follow the appearance.
- The `ink` CodeMirror theme now reads `--code-*` variables, so the code area sits on the same base surface in both appearances. Other code themes (Monokai, Dracula, GitHub Light, Solarized) and users' saved theme choice are unchanged.
- Dark appearance passes `theme-darcula` to the existing inherited `PreviewFrame theme` prop. Export reads the same theme through the inherited snapshot.

### Code column
- DSL heading removed.
- Bottom row: chevron + "Custom CSS" on the left, "Report a bug" on the right. The "empty · click to expand" filler is removed.
- Expanded CSS keeps the CSS mode select, the Atomic CSS config button and the CSS editor.
- `ReportBugButton` gained `placement="inline"`. The hub keeps the floating button.

### Preview card
- Floating rectangle at x392 y68, 1036×880, with a subtle shadow. No header rule and no permanent split rule.
- Split gutter is 12px with a grip that shows on hover/focus. Arrow keys still resize.
- Document controls are no longer portaled into the card (the old 64px slot is removed).
- Page tab: the active underline is drawn on the label wrapper, so label and underline share the same center also when the tab holds a delete ×. Measured offset 0px for PAGE 1 (no ×) and PAGE 2 (with ×); before this change PAGE 2 was off by 15px. Add, rename, delete and scrolling still work.
- Toolbar controls:
  - Download (labelled) and Refresh (only when auto-preview is off) are kept.
  - New zoom group: fit width, fit height, fit diagram, zoom out, zoom % (click resets to 100%), zoom in.
  - The duplicate Present button is removed.
- Zoom is applied in the app, not the renderer: `previewZoom.ts` plus `PreviewFrame zoom/onZoomChange`. The iframe is sized to wrapper/scale and scaled from the top-left corner, so scrolling and clicks still work. Fit modes keep fitting as the content or the card resizes.
- Console: count, expand, Clear and error lines are kept. The red error badge shows only when errors exist; the green "No issues" badge is removed.

## Repair of the 29 web E2E failures (verified 2026-10-20)

The user asked for all 29 failures (present at base 12cf0e4d too) to be fixed. Result: **219/219 web E2E pass.**

Failure groups (from the artifacts of the earlier 219-test run):

| Group | Tests | Symptom |
|---|---|---|
| Snippet fields | 26: catalog B6, B7, F6; catalog-extended L (8), M (9), T4, T5; editor-language (4) | Right after a slash command inserts a snippet, `.cm-snippetField` count is 0 (18 tests), or Tab/Shift-Tab do not move between fields so all typing lands in field 1 (e.g. B7 got `SvcdoWorkX.method() {`, expected `X.doWork() {`) |
| Lint markers | 3: catalog J2, catalog-extended U4, W8 | Expected 0 error markers on invalid input, received 2 (one inline range + one gutter marker = one diagnostic) |

### Cause 1, snippet fields: product bug (present at base)
- `AppRoot` passes `onChange={handleDslChange}`, a plain function that gets a new identity on every render.
- `@uiw/react-codemirror` (`useCodeMirror.js`, line 165) lists `onChange` in the dependencies of its `StateEffect.reconfigure` effect. So every keystroke reconfigured the whole editor config.
- `snippet()` appends its field state lazily with `StateEffect.appendConfig`, and a reconfigure drops it. The tab stops therefore vanished immediately after insertion. This is the same failure mode the existing `BASIC_SETUP_*` comment in `CodeEditor.tsx` describes for `basicSetup`.

**Fix 1:** `CodeEditor` passes CodeMirror a stable `useCallback` handler that forwards to the latest `onChange` through the existing `onChangeRef`. This covers every caller (DSL and CSS editors).

Regression test, `CodeEditor.test.tsx` "keeps active snippet fields when the parent re-renders with a new onChange":
- It inserts a snippet, re-renders with a new `onChange`, then asserts that the snippet field is still active, the view was not remounted, and only the new handler receives edits.
- **Red without the fix (run):** I temporarily restored `onChange={onChange}`. Result: 1 failed / 12 passed, `expected false to be true` at `hasNextSnippetField(view.state)` after the re-render.
- **Green with the fix:** 13/13 passed.

### Cause 2, lint markers: stale tests, with the actual diagnostics captured
These three tests were written on 2026-06-10, when no DSL linter was wired. W8's comment said so: "(no linter is wired)". Commit `edae7b6e` (2026-06-13) wired the @zenuml/core language server's diagnostics into the editor.

Actual diagnostics, captured in Chromium on the dev server by hovering each lint range (`.lintprobe.mjs`):

| Input | Lint ranges / gutter markers | Tooltip (diagnostic message, source) |
|---|---|---|
| J2 `!!!@@@###` | 1 / 1, range = first `!` | `Expecting end of file but found `!`.` — `zenuml` |
| U4 `!!!###` / `@@@ <<>> ::` / `}}} ))) ...` | 1 / 1, range = first `!` | `Expecting end of file but found `!`.` — `zenuml` |
| W8 `@Actor 🚀X` | 1 / 1, range = first half of the emoji | `Expecting end of file but found `\ud83d`.` — `zenuml` |
| Control: J1 valid declarations + message | 0 / 0 | — |
| Control: J4 dangling `A->` | 0 / 0 | — |

To check that these are the intended parser errors, independent of the LSP, I ran the same inputs through the renderer's own ANTLR parser, `validate()` from `@zenuml/core/parser` (`web/tmp/antlr-validate.mjs`):

| Input | Renderer parser result |
|---|---|
| J2 | `pass: false`, 1:0 `mismatched input '!' expecting {<EOF>, TITLE, …}` |
| U4 | `pass: false`, 1:0 `mismatched input '!' expecting {<EOF>, …}` (single error) |
| W8 | `pass: false`, 1:7 `no viable alternative at input '@Actor \ud83d'` |
| J1, J4 controls | `pass: true` |

So the editor marks exactly the token that the renderer's parser rejects, with one diagnostic per input, and shows nothing for renderer-valid or incomplete DSL. The markers are correct parser errors, not false positives.

**Fix 2:**
- J2, U4 and W8 now assert exactly one diagnostic (`errorMarkerCount` = 2: one inline range plus one gutter marker).
- They also assert its message, `Expecting end of file but found …`, read from the lint tooltip by a new helper, `errorMessages()` in `web/e2e/helpers/editor.ts`.
- Their no-crash, text-retained and (W8) follow-up completion checks are unchanged.
- No-false-positive coverage stays in the existing zero-marker tests (J1, J4, U, W).
- J2 and U4 were renamed to match. The `errorMarkerCount` doc comment, which claimed "the DSL editor wires NO linter", now describes the LSP source.

**Observation (renderer package, not changed):** for an emoji the LSP message and range cover only the first UTF-16 half of the emoji (`\ud83d`), not the whole character. The error is correct; its rendering in the tooltip is a cosmetic issue in @zenuml/core.

### Results (all run in this checkout after the repair)

| Check | Result |
|---|---|
| Regression unit test without the fix | 1 failed (expected) |
| Regression unit test with the fix | 13/13 passed |
| 3 previously failing spec files (`catalog`, `catalog-extended`, `editor-language`) | **206 passed, 0 failed** (7.1m). Log: `/tmp/fix29-3specs.log` |
| Full web E2E (`web/playwright.config.ts`) | **219 passed, 0 failed** (7.1m). Log: `/tmp/fix29-full.log` |
| Root CI suite (`playwright test --project=chromium`, repo root) | **87 passed, 0 failed, 8 skipped** (2.0m). Log: `/tmp/fix29-root.log` |
| `tsc --noEmit -p .` (web) | exit 0 |
| `vite build` (web) | succeeded (built in 2.68s) |
| `vitest run` (web, full, 3 runs) | Run A: 2 failed / 1117 passed / 1 skipped. Run B: 1119 passed / 1 skipped. Run C: 1 failed / 1118 passed / 1 skipped. See the flaky note below. |

**Flaky unit tests (not fixed, not caused by this work):**
- `participantManager.test.ts` "scales to a large diagram — collects all 100 message-introduced participants" (`expected 79 to be 101`) failed in runs A and C.
- `zenumlAutocomplete.test.ts` "resolveZone › returns 'block' inside a StatementBraceBlock" (`expected 'top' to be 'block'`) failed in run A.
- Both files pass alone (71/71). Neither the test files nor `participantManager.ts` / `zenumlAutocomplete.ts` were changed by this work.
- The pattern is a partially parsed tree: both read `syntaxTree(state)`, which CodeMirror builds within a time budget. Under full-suite parallel CPU load the parse is not finished when the tests read it.
- The earlier core-Editor pass also recorded one non-reproducing unit failure. Fixing this flakiness was out of scope for this task.

Files changed in this pass:
- `web/src/editor/CodeEditor.tsx` (stable `onChange`)
- `web/src/editor/CodeEditor.test.tsx` (regression test)
- `web/e2e/helpers/editor.ts` (`errorMessages()`, corrected comment)
- `web/e2e/catalog.spec.ts` (J2)
- `web/e2e/catalog-extended.spec.ts` (U4, W8)

Probes kept as reproducible evidence (not product code): `.lintprobe.mjs` (needs the dev server on port 4411) and `web/tmp/antlr-validate.mjs`. The unused scratch file `web/tmp/failsum.py` was deleted.

## Final gutter and row refinements (approved Figma, verified 2026-10-20)

This section supersedes the gutter geometry in the follow-up below (§1 and §1a). There, code started at x73.3 with a separate 16px lint column. The Custom CSS, auth gating and test-readiness fixes in §2 and §3 are unchanged and were re-verified.

References: `editor-gutter-final-{light,dark}.png` (Figma Light 32:4370, Dark 32:4188). They were used only for geometry; the right-hand diagram is real rendering of the editor's own content.

### Result at 1440×960 (measured, light and dark identical)

| Item | Approved | Measured |
|---|---|---|
| Code workspace | x16, y68, w352, to y948 | `.cm-editor` x16, y68, w352, bottom 904; footer 904–948 |
| Preview card | x392, y68, to y948 | x392, y68, bottom 948 |
| First row / first line number | at the code area's top (y68) | both at y68, zero top padding |
| Row height | 24px | code line 24px, line number 24px |
| Fonts | 15px monospace, 13px numbers | 15px (`"Fira Code", ui-monospace, …, Menlo`; Fira Code is not bundled, so the rendered font is the system monospace, 9.03px advance), numbers 13px |
| Number lane | 32px, 3 digits right-aligned | `.cm-gutters` x16, w32 for 2, 12 and 120 lines; every number's right edge is at the same x |
| Code origin | x56 | x56 for 1, 2 and 3 digits; unchanged from 99 to 100 lines |
| Current row | 24px, lane + code, square, theme colour | lane cell x16 w32 h24 and line x48–368 h24, radius 0, same colour on both (light `#e6edf5`, dark `#414d5d`); both move to y92 after ArrowDown |
| Divider | y904, x16–368 | footer top border 1px at y904, x16–368 |

**Pixel comparison** (my screenshot against the export, same sample `Alice->Bob: Hello / Bob->Alice: Hi back`):

- **Light:** all 18 sampled points match exactly. That covers lane `#e5f1fa` x16–48, code background, active row y68–92 across x16–368, the lane down to y903, and the divider `#d9dde3` from x16 to x367.
- **Dark:** the lane `#343f4b`, active row `#414d5d` and divider `#505967` match. The base background is `#303944` (the existing `--editor-bg` token), against `#303640` in the export; this was not changed.
- **Glyph ink, row 2 (both themes):** identical to the export. Number at x37–42, code from x57, y97–109.
- **Footer ink:** chevron x29–36 (export 28–37), label x50–122 (export 50–122), "Report a bug" ending at x344 (export 344).
- **Remaining footer difference:** footer glyphs sit 2–3px higher than in the export (y919–933 against y921–937).

### Fit constraint: three lanes in 40px

The approved design shows one 32px lane and code at x56, which leaves 40px from the editor edge. Separate number (32px), fold (≥12px) and lint (≥16px) lanes need 60px. Instead of shifting code or hiding anything, I resolved it in the native gutter structure:

```
x16                              x44  x48  x56
| lint marker: 32 x 24 hit target |    |    |
| ▌3px severity bar               |    |    |
|          line numbers (32px, right-aligned, 4px right pad) | gap | code
|                                 [fold toggle 12 x 24]
```

- **Lint:** the lint gutter takes no width; its marker overlays the lane cell.
  - `@codemirror/lint` binds its hover handler on the marker element, so the hit target is the whole 32×24 lane cell.
  - The glyph is a 3px bar in the severity colour (`--code-invalid`, new `--code-warning`, `--code-function`) at the lane's left edge. It ends left of the first digit of 3-digit numbers, so it never covers a number.
  - Vertical centring: the marker's top/bottom padding is `(row − 16) / 2` px, set in `fontTheme` (which knows the row height), with horizontal padding set as longhands in the gutter theme.
    - A first version used `padding` shorthand there, which overrode `fontTheme` and left the marker 32×16 at the top of the row.
    - Measured after the fix: marker box x16, w32, h24, padding 4/29/4/0, glyph 3×16.
    - `gutter.spec.ts` now asserts the marker spans the full row height.
    - An intermediate `1lh` version was replaced by this, to avoid a CSS-unit browser floor.
  - This replaces the 10px circle from §1a. The hit target grows from 16×16 to 32×24.
- **Fold:** the fold gutter takes no width; its toggle (CodeMirror's own `span[title="Fold line"]`) is a 12×24 target at x44–56, between the numbers' right padding and code. The gutter's click handler still receives the click.
- **Lane width:** a minimum, not a clamp. Up to 999 lines the lane stays 32px and code stays at x56. At 1000+ lines a 4-digit number needs ~35px, so the lane widens and code shifts. Known limit, reported, not hidden.
- **Theme borders:** the gutter's 1px right border is removed, so themes with a border do not move code by 1px.

### Other changes in this pass

- **`CodeEditor.tsx`:**
  - Row height is `round(fontSize × 1.6)` px (15 → 24), and numbers are `13/15 em`. Both scale with the font-size setting.
  - `.cm-content` top padding is 0, and `.cm-line` left padding is 8px (the gap; it is covered by the active-row band).
  - `className="h-full"` on `CodeMirror`: the `@uiw` wrapper had no height, so `.cm-editor` and the lane stopped at the last line instead of running to y904.
- **Font size default 16 → 15** (`DEFAULT_SETTINGS.fontSize`, `CodeEditor` default). Users who stored a font size keep it.
- **`themes.ts`:** ink lane uses the new `--code-gutter-bg` (light `#e5f1fa`, dark `#343f4b`). Other themes keep their own gutter colours.
- **`globals.css`:**
  - Source pane padding is `12px 12px 0 16px` (was `32px 12px 0 24px`).
  - The footer keeps the design insets inside the flush divider (`padding: 0 18px 0 8px`).
  - New tokens: `--code-gutter-bg` and `--code-warning`.
- **Default split 26.8 → 26.8056%** (`editorStore.ts` `DEFAULT_STARTER.mainSizes` and the `Layout.tsx` fallback):
  - split.js sizes the pane as `pct% − 6px`; 26.8% gave 379.92px and a 351.9px code area. 26.8056% gives exactly 380px and 352px.
  - Diagrams that already stored 26.8 keep their stored split, which is 0.08px narrower.
  - `editorStore.test.ts` expects the new default.
- **Narrow collapsed footer:** at 900×700 the code pane is ~207px wide, and the toggle plus the full "Report a bug" label plus the insets did not fit; the capture showed "Report a bu…" clipped.
  - New geometry assertion: no clipping, no overlap, button inside the footer. It failed first (button right 244.6 > footer right 223.3).
  - Fix: the footer is a size container, and below 280px the button is icon-only. It keeps `aria-label="Report a bug"`. At 1440 the full label stays and the footer insets are unchanged.
- **Expanded Custom CSS header now wraps** instead of overlapping.
  - The root test CSS-4 failed after the footer insets: "Report a bug" intercepted the click on "Atomic CSS config" at 1280×720.
  - The probe showed the header needs ~472px but had 309px. The overflow already existed before this change; the insets moved the overlap onto the button.
  - With `flex-wrap`, CSS-4 passes. Screenshot: `acss-expanded-1280-light.png`.

### Tests

- **New `web/e2e/editor-geometry.spec.ts` (12 tests):** 4 per appearance (workspace/preview/footer edges and insets; first row and type metrics; lane and x56 at 1/2/3 digits; current-row band following the cursor), plus:
  - light = dark geometry
  - 99 → 100 lines
  - long wrapped line: the band covers the wrapped height in lane and code, a multiple of 24
  - narrow 900×700: lane 32px, code 40px from the editor edge, footer not clipped
- **Red before the implementation:** 11 failed. Examples:
  - first row at y92 instead of y88
  - code x81.1 → 88.9 between 99 and 100 lines
  - a 9.5px row remainder on wrapped lines
  - a 51.1px lane in the narrow view
- **Red after the implementation:**
  - 351.9px width (fixed by the split default)
  - footer row bottom at y120 (fixed by `h-full`)
  - footer insets off by 8px (fixed by footer padding)
- **`gutter.spec.ts`:** the fold test now measures the toggle element itself (≥12×12), because the fold cell is 0px wide by design. The other gutter tests pass unchanged:
  - the code-offset bounds (now 40px against ≤50/58/66)
  - lint marker ≥12×12 with a glyph ≤10px wide (3px), plus a pointer at the marker corner opening the message
  - keyboard F8 and Mod-Shift-M
  - the dark tooltip

### Validation (after the final change)

| Check | Result |
|---|---|
| `tsc --noEmit` / `vite build` | pass / pass |
| vitest full, 2 runs (after the TypeScript changes) | 1129 passed, 1 skipped each |
| vitest `src/editor` (after the last `CodeEditor.tsx` change) | 365 passed, 1 skipped |
| web E2E (built app, final code) | **237/237** (225 + 12 geometry) |
| root `--project=chromium` (final code) | 88 passed, 8 skipped |
| root cloud CSS tests (emulator, final code) | 4/4 (CSS-5, CSS-P1, CSS-P2, CSS-P3) |
| root cloud suite (emulator, before the marker-padding and narrow-footer CSS changes) | 37 passed, 1 skipped |

**Runs disturbed by the shared machine (not counted above):**

- **Root suite failures under contention:** two root runs failed while other Playwright runs were active at the same time. One came from the `editor-appearance-claude` worktree, the other from the Diagrams checkout's emulator config.
  - The first run hit my 590s cap (exit 124) with 24 listed timeouts.
  - The second failed ANL-1 and TPL-1/2 with 30s timeouts.
  - TPL-1 failed the same way in one isolated rerun while a Diagrams-checkout run was still active.
  - With no other runs active, `telemetry.spec.js` + `templates.spec.js` passed 12/12, and the full root suite passed 88/8.
  - One web E2E run hit the 590s cap with S9 failing; the uncapped rerun passed 237/237.
- **Shared dev-server port:** the root Playwright config reuses an existing dev server on port 3000 (`reuseExistingServer: !CI`). When agents run root suites at the same time, one checkout's tests can run against another checkout's server.
- **Emulator incident (my error):** one cleanup command stopped a Firestore emulator on port 8080 without checking its owner first. It belonged to the Diagrams agent (cwd `/private/tmp/diag-emu`), so that agent's emulator-backed run may have failed at about 18:55. Later cleanups stop the emulator only when its cwd is this worktree.

### Screenshots (`web/.shots/followup/final-gutter/`)

- `desktop-light.png`, `desktop-dark.png`: full frame at 1440×960, same sample as the export.
- `narrow-900-light.png`, `narrow-900-dark.png`, `mobile-390-light.png`, `mobile-390-dark.png` (fresh page). An earlier narrow capture showed "Console (1)": that entry came from the deliberately broken DSL typed earlier in the same capture run, since the console keeps entries until Clear. A clean resize from 1440 to 900 logs 0 entries.
- `lines-99.png`, `lines-100.png`: no horizontal shift.
- `longline-lint-hover-light.png`: wrapped line band, lint bar, tooltip from the marker corner.
- `folded-light.png`, `folded-dark.png`
- `acss-expanded-1280-light.png`, `acss-expanded-1440-light.png`

## Follow-up: gutter, Custom CSS, timing-sensitive unit tests (verified 2026-10-20)

Every product defect below has a test that failed before the fix and passes after it. Nothing was skipped or deleted, and no assertion was weakened. Code Appearance (theme/font-size controls), Settings and CodeAppearanceBar files were not touched.

### 1. Gutter width

Measured in Chromium at 1440×960, light appearance. "Code x" is the left edge of the first character on the page. The Figma reference is x56.

| Doc | Before: line numbers / fold / lint (px) | Before: code x | After: line numbers / fold / lint (px) | After: code x |
|---|---|---|---|---|
| 1-digit | 20 / 11.6 / 22.4 | 85 | 14.3 / 12 / 16 | 73.3 |
| 2-digit | — | 92.2 | 22.1 / 12 / 16 | 81.1 |
| 3-digit | — | 101.8 | 29.9 / 12 / 16 | 88.9 |

(After values include the acceptance correction in §1a; the first follow-up pass had a 14px lint column and code x 71.3 / 79.1 / 86.9.)

- **Change** (`CodeEditor.tsx`, `compactGutterTheme`):
  - The gutter font is 0.8125em, with the line height compensated so rows stay aligned.
  - Line-number padding is 0 0.3em 0 0.2em, and the 20px minimum is removed.
  - The fold cell is 12px wide and centred.
  - The lint column is 16px. The marker element is 16×16 (10px glyph plus 3px padding); see §1a.
- **Line numbers:** the right edge of "1" is now at x34.4 (Figma ≈ x34). The remaining 15px gap to x56 is the fold and lint columns. They were kept on purpose, so code start was not forced to x56.
- **Fold column:** it was dead space, because DSL folding never worked. `zenumlLanguage.ts` now adds `foldNodeProp` for `StatementBraceBlock` and `GroupBraceBlock`.
  - Unit tests (`zenumlLanguage.test.ts`): red first, then 41/41.
- **E2E `web/e2e/gutter.spec.ts`** (new, 6 tests):
  - Code offset at 1, 2 and 3 digits (bounds 50 / 58 / 66px from the editor edge, which include the 16px lint column).
  - Numbers ≥12px, inside the gutter and not clipped.
  - The fold cell is ≥12px and clicking it folds.
  - The lint marker element itself is ≥12×12, the glyph stays ≤10px, and a pointer at the marker's corner opens the message.
  - Keyboard: F8 selects the diagnostic and Mod-Shift-M opens the lint panel with the message.
  - The dark lint tooltip is readable (see 2e).
  - Before the fix it failed with offsets 61 and 68.2 and no fold marker. After the fix and the §1a correction, 6/6 pass.
- **Screenshots:**
  - `web/.shots/followup/before/gutter-light-{1,2,3}-digit.png`
  - `web/.shots/followup/after/gutter-{light,dark}-{1,2,3}-digit.png`
  - `web/.shots/followup/after/lint-target-hover-light.png` (tooltip opened by a pointer at the marker's corner)

### 1a. Acceptance correction: lint marker hit target

**Finding (independent acceptance):** the first pass sized `.cm-lint-marker` to 10×10px, while the test only checked the parent `.cm-gutterElement` (≥12px). `@codemirror/lint` binds the hover handler on the marker element itself (`elt.onmouseover = () => gutterMarkerMouseOver(...)` in `GutterMarker.toDOM`), so the real hover target shrank from 16px (stock 1em) to 10px.

**Red:** the new test measures `marker.getBoundingClientRect()`. Before the fix it failed with `Expected: >= 12, Received: 10`.

**Fix** (`CodeEditor.tsx`, `compactGutterTheme`):
- The marker is `display:block`, 10×10 content (the error glyph image) plus 3px padding, so its box is 16×16 and the glyph stays 10px.
- `box-sizing: content-box` is needed: the app's preflight sets `border-box` globally, which first put the padding inside the 10px (the box stayed 10×10).
- The lint column is 16px with no cell padding. `margin-top: calc((1.7231em - 16px) / 2)` centres the box in the row; this follows the font-size setting.

**Measured after the fix** (1440×960, light):

| Doc | Marker box | Glyph | Marker top in row (row height) | Code x |
|---|---|---|---|---|
| 1-digit | 16×16 | 10px | 3.2px (22.4px) | 73.3 |
| 2-digit | 16×16 | 10px | 3.2px (22.4px) | 81.1 |
| 3-digit | 16×16 | 10px | 3.2px (22.4px) | 88.9 |

**Trade-off:** code starts 2px further right than in the first pass, because the lint column is 16px instead of 14px. Line-number and fold widths are unchanged (14.3 / 22.1 / 29.9px and 12px). The code-offset bounds in `gutter.spec.ts` moved from 48/56/64 to 50/58/66px to match this.

**Pointer check:** the test moves the mouse to the marker's top-left corner plus 1px. That point is outside the 10px glyph but inside the 16px target, and the tooltip "Expecting end of file but found `!`." opens. Before the fix this point was outside the hover target.

**Keyboard check** (new test; `lintKeymap` comes from `@uiw` basicSetup): F8 (`nextDiagnostic`) selects the diagnostic range, and Mod-Shift-M (`openLintPanel`) opens `.cm-panel-lint` with the same message.

**Results after the correction:**

| Check | Result |
|---|---|
| `gutter.spec.ts` | 6/6 |
| vitest `src/editor` | 365 passed, 1 skipped |
| `tsc --noEmit` | pass |
| full web E2E (built app) | 225/225 |
| root `--project=chromium` | 88 passed, 8 skipped |
| cloud CSS (`-g "CSS-"`, emulator) | 4/4 (CSS-5, CSS-P1, CSS-P2, CSS-P3) |

The CSS guard fixes from §2 are unchanged.

### 2. Custom CSS

These checks ran on the Firebase emulator with seeded test users (`user_subscriptions` plus-monthly for Plus). No production data was used.

| Defect | Cause | Fix | Red → green |
|---|---|---|---|
| a. A gated keystroke left text in the buffer (signed-out user typed `.`, got the sign-in dialog, and the `.` stayed) | The gate ran after CodeMirror had applied the edit | New `editGuard` prop on `CodeEditor`, applied as a `transactionFilter`. It drops user edits when the guard returns false; external value syncs (`ExternalChange`) bypass it. `AppRoot` passes `cssEditAllowed` | `CodeEditor.test.tsx` 2 new tests; root E2E CSS-7 (received "." before the fix) |
| b. User CSS did not reach the diagram (`#zenumlstyle` held the rule, but the participant stayed rgb(34,34,34)) | @zenuml/core injects its own `<style>` after the user rail at equal specificity, so core rules won | `keepUserCssLast()` in `previewBootstrap.runtime.js` moves `#zenumlstyle` to the end of `<head>` after construction, after each render and after `updateCss` | `previewBootstrap.test.ts` new test (9/9); cloud CSS-P1/P2 |
| c. A free user could apply Plus-only CSS while the plan was loading | `cssGated()` allowed edits while `subLoading` | While loading, the edit is held back (the buffer does not change) and remembered. When the plan resolves to free, pricing opens | `AppRoot.test.tsx` 2 new tests (71/71); cloud CSS-5 |
| d. The SCSS error tooltip showed raw ANSI codes and a code frame (`[34m │ [0m …`) | `transpilers.ts` used sass `e.message`, which appends a terminal-coloured code frame | Use `e.sassMessage` (for example "Expected expression."); fall back to `message` | `transpilers.test.ts` new test: red, then 6/6 |
| e. In dark appearance the lint and autocomplete tooltips were light-on-light (bg #f5f5f5, text #edf0f5) | The `ink` theme declares `light`, so CodeMirror's base tooltip colour stayed light while the text followed `--code-fg` | `themes.ts`: ink = syntax theme plus `.cm-tooltip` using `--editor-surface`, `--code-fg` and `--editor-border` (other themes unchanged) | `gutter.spec.ts` dark tooltip test: received bg rgb(245,245,245), then rgb(52,63,75) |

**Emulator-backed cloud tests** (`e2e/tests/cloud.spec.js` §1b, new):

- **CSS-P1 (Plus user):**
  - No gate appears.
  - The rule is in `#zenumlstyle` and the participant colour becomes rgb(200,0,0).
  - Collapsing and reopening keeps the content.
  - Save writes the CSS to the Firestore item.
  - After reload, the panel is expanded and both the CSS and the preview colour are restored.
- **CSS-P2 (Plus user, SCSS mode):**
  - `$var` and nesting compile into the preview.
  - Broken SCSS shows a lint marker and a message.
  - Fixing it clears the marker and applies the CSS again.
- **CSS-P3 (free signed-in user):** typing opens pricing, and the buffer and style rail stay empty.
- **CSS-5** (existing test): passes again after fix c.

**Layout (measured at 1440×960; same in both appearances):**

- **Collapsed:** the DSL editor is 816px tall, and the "Custom CSS" strip (32px) sits at the bottom.
- **Expanded:** the DSL editor is 430px and the CSS panel 442px (y518 to the bottom). The space splits about evenly.

**Behaviour kept as is:** while SCSS has an error, the preview has no user CSS until the error is fixed. The legacy app did the same (`src/computes.js` resolves to `result.text`, which is empty on error).

**Screenshots** (`web/.shots/followup/css/`):

- `light-1-collapsed`, `light-2-expanded-empty`, `light-3-css-applied`, `light-4-scss-error`
- `dark-1-collapsed`, `dark-2-expanded-retained`, `dark-3-scss-applied`, `dark-4-scss-error`
- `web/.shots/followup/css-signed-out-gate.png`
- `web/.shots/followup/after/autocomplete-dark.png` (autocomplete popup with the new tooltip surface: bg rgb(52,63,75), items white, selection #17c)

### 3. Timing-sensitive unit tests

Three tests failed sometimes under full parallel load and passed alone. Each now has a proven mechanism and a deterministic fix.

| Test | Observed failure | Mechanism | Fix |
|---|---|---|---|
| `participantManager` "scales to … 100 participants" | `expected 43 to be 101` | `EditorState.create` parses at most 3000 chars and 20ms (`@codemirror/language` `LanguageState.init`, `Work.InitViewport`/`Work.Apply`). Under load the 20ms ran out | **Product defect, also fixed:** `zenumlParticipantField` recomputed only on `docChanged`. When the background parser later delivered the rest of the tree (a transaction that changes the tree but not the doc), the field ignored it, so participants declared beyond the first parse stayed missing until the next edit. It now also recomputes when `syntaxTree` changes. This means the participant walk also runs on background-parse transactions, not only on edits; the existing reference-stability guard still returns the prior `Set` when the names are unchanged, so subscribers do not re-fire. New deterministic test with a 300-line doc (precondition: the initial tree is shorter than the doc): red `expected 197 to be 301` without load, green with the fix. The 100-line test now completes the parse first (`ensureSyntaxTree` plus an empty transaction, as the editor does). `toBe(101)` is unchanged |
| `zenumlAutocomplete` "resolveZone … block" | wrong zone (partial tree) | Same 20ms initial-parse budget; `resolveZone` reads `syntaxTree(state)` | Test only: `stateAt` completes the parse the same way. Assertions unchanged |
| `cjkAutocorrect` D1 "compose-flagged input … commit applies the correction" (file not otherwise changed on this branch) | `expected 'Order。' to be 'Order.'` | The test's `waitFor` stopped after 1s of `Date.now()`. After an event-loop stall, it can time out before the product's 60ms `compositionend` flush timer runs | Test only: `waitFor` is capped by timer ticks (100 × 10ms), not by wall-clock time. Shown with a temporary `Date.now` stall injection: red ("Order。") with the old `waitFor`, green with the new one. The injection was then removed |

Full unit suite:

- **Before these fixes:** 3 runs, with 1 failure in run 3 (participantManager). An earlier run of this session failed resolveZone. After the participant and resolveZone fixes, another run failed cjk D1.
- **After all fixes:** 5 consecutive runs, each **1129 passed, 1 skipped**.

### Validation after the follow-up

| Check | Result |
|---|---|
| `tsc --noEmit` (web) | pass |
| `vite build` (web) | pass |
| vitest full, 5 runs | 1129 passed / 1 skipped each time |
| web E2E (`web/playwright.config.ts`, built app) | **224/224** (219 + 5 gutter); after §1a: **225/225** (219 + 6 gutter) |
| root CI suite `--project=chromium` | 88 passed, 8 skipped |
| root cloud suite (`PW_CLOUD=1 --project=cloud`, emulator) | 37 passed, 1 skipped |

**Emulator note:** after each cloud run, the Firestore emulator Java process outlived Playwright's webServer and kept port 8080 busy, so the next run fails to start. The leftover processes (cwd = this worktree, parent = launchd) were stopped after each run.

### Follow-up diff (files touched in this pass)

**Product:**

- `CodeEditor.tsx`: compact gutter theme, `editGuard`
- `zenumlLanguage.ts`: fold props
- `themes.ts`: ink tooltip surface
- `participantManager.ts`: recompute on tree change
- `transpilers.ts`: `sassMessage`
- `previewBootstrap.runtime.js`: `keepUserCssLast`
- `AppRoot.tsx`: `cssEditAllowed`, held-while-loading prompt

**Tests:**

- `CodeEditor.test.tsx`, `zenumlLanguage.test.ts`, `participantManager.test.ts`, `zenumlAutocomplete.test.ts`, `cjkAutocorrect.test.ts`
- `transpilers.test.ts`, `previewBootstrap.test.ts`, `AppRoot.test.tsx`
- `web/e2e/gutter.spec.ts` (new)
- `e2e/tests/css-editor.spec.js` (CSS-7), `e2e/tests/cloud.spec.js` (§1b)

**Removed:** the disposable probe scripts (`.lintprobe/.gutterprobe/.foldprobe/.cssgateprobe/.iframeprobe/.cascadeprobe/.acprobe.mjs`, `web/tmp/antlr-validate.mjs`) and the temporary screenshot spec.

**Overlap:** `themes.ts` may also be edited by the parallel Code-appearance branch. This pass only wrapped `ink` with a tooltip theme.

## Validation (run before the E2E repair pass above)

| Check | Result |
|---|---|
| `vitest run` (web) | 110 files, 1118 passed, 1 skipped (3 full runs after the last change: 1 run had 1 failure that did not reproduce in the next 2 runs; the failing test name was not captured) |
| `tsc --noEmit` | exit 0 |
| `vite build` | succeeded (existing chunk-size warning) |
| `eslint` | **Could not run.** ESLint 10 finds no `eslint.config.*` in `web/`. This was already the case at the base commit; the lint script is broken there too. |
| Playwright web E2E (`web/playwright.config.ts`, full suite, 219 tests) | Rerun on the final code (after the follow-up edits): 190 passed, **29 failed**. The failing set is identical to the earlier 14:01 run. The 29 tests are in `catalog-extended.spec.ts` (21), `catalog.spec.ts` (4) and `editor-language.spec.ts` (4): slash-snippet fields and lint markers. Baseline: a clean worktree (12cf0e4d + `baseline.patch` + the inherited untracked files) ran **only those 3 spec files** (206 tests) and failed the **same 29 tests** (sorted lists compared with `diff`: identical). The 13 tests outside those files (12 in `typing-mechanics.spec.ts`, 1 in `report-bug.spec.ts`) were not run on the baseline; all 13 pass on the final code. Logs: `/tmp/editor-core-e2e-final.log`, `/tmp/editor-core-e2e.log`, `/tmp/editor-core-e2e-baseline.log`. |
| Root Playwright suite `e2e/tests` (CI gate: `playwright test --project=chromium`) | First run: 82 passed, **5 failed**, 8 skipped. All 5 asserted the old design: `renderer-present` (PRV-1, PRV-8), the "No issues" badge (PRV-2), the old Present label class (MOB-3) and the old teal code background (SET-1). Specs updated to the new design. Final run: **87 passed, 0 failed**, 8 skipped. Log: `/tmp/root-e2e2.log`. |
| Root cloud specs (Firebase emulator, `PW_CLOUD=1 --project=cloud`) | SHR-6 and PST-3 used the removed title menu (`filemenu-trigger`/`filemenu-duplicate`). Updated to `header-fork`; both pass (2 passed). Other cloud specs were not run. `functions/node_modules` was installed with yarn for the emulator (the lockfile is pnpm; node_modules is gitignored). |
| Real-browser journey (`.journey.mjs`, Chromium) | 45/45 checks passed (details below) |

Journey checks:
- **Geometry:** header 56, card [392,68,1036,880], header gaps 12/12/24/8.
- **Removed items:** no horizontal overflow at 1440, 1024 or 390 in either appearance. The DSL heading, the filler text, "No issues", the renderer Present and the title arrow are all gone.
- **Save state:** "Local only" → "Unsaved" → ⌘S → "Saved locally", with the item present in localStorage.
- **Zoom:** in/out, fit width, fit height and fit diagram each change the zoom and the iframe transform. Clicking the % label resets to 100%.
- **Split:** keyboard and drag resizing work. Collapsing then expanding the code pane restores the dragged width.
- **Pages:** add (to tab overflow), rename and delete work.
- **Custom CSS:** expanding shows the mode select and the editor. For an anonymous user, typing CSS opens the existing sign-in gate (this behavior is unchanged).
- **Console:** an error shows the badge, and Clear works.
- **Download and document:** Download → export dialog → PNG file downloaded. Title edit, Present and Exit work.
- **Appearance:** dark applies immediately and persists after reload. The dark iframe canvas is rgb(43,43,43).
- **Errors:** the page threw no errors.

## Screenshots

`web/.shots/final/` (journey output; diagram text may include journey edits):
- `desktop-light-1440.png`, `desktop-dark-1440.png`: compare to `editor-light.png` / `editor-dark.png`
- `desktop-light-fit-diagram.png`, `desktop-light-collapsed.png`, `desktop-light-gutter-hover.png`, `desktop-light-pages.png`
- `desktop-light-css-expanded.png`, `desktop-dark-css-expanded.png`, `desktop-light-console-error.png`, `desktop-dark-app-menu.png`
- `1024-light.png`, `1024-dark.png`, `390-light.png`, `390-dark.png`, `390-light-preview.png`, `390-dark-preview.png`
- `desktop-dark-present.png` (dark Present mode), `desktop-light-page2-tab.png`, `desktop-dark-page2-tab.png` (non-default tab with ×; the dark crop was taken before the underline fix)

Baseline (before): `web/.shots/baseline-1440.png`, `web/.shots/baseline-390.png`. Intermediate: `web/.shots/v1-*`, `v2-*`, `v3-*`.

Comparison with Figma at 1440×960:
- The card, header and button geometry match the reference.
- The diagram origin is x432 y148 in both the design and the build.
- Remaining visual differences:
  - Superseded by "Final gutter and row refinements" above: code now starts at x56 (it was x85, then x73.3 after the first gutter follow-up), with fold and lint kept as zero-width overlay gutters.
  - The code font default is now 15px (it was 16px). Users who stored a font size keep it; 15 is an existing option in Settings (12–18).
  - The logo is the existing `BrandLogo` asset, not the simplified Figma "Z" mark.

## Limitations / decisions

1. **Renderer zoom API:** @zenuml/core 4.7.2 exposes only `render/getPng/getSvg`. Its `zoomIn/zoomOut` are on an internal React ref. Zoom is therefore done in the app by scaling the iframe; the renderer package was not modified.
2. **Darcula canvas:** core 4.7.2 leaves the page and the `.bg-skin-canvas` wrapper white around a darcula diagram (the Figma dark frame masks this with an "Export edge mask"). Fix: an app-side base style in `previewBootstrap.runtime.js`, `html,body{background:#2b2b2b}.zenuml .bg-skin-canvas{--color-bg-canvas:#2b2b2b}`. This matches the inherited export background handling. A test was written first and failed before the fix.
3. **Mobile dark preview:** the mobile SVG renderer (`renderToSvg`) has no darcula theme, and the inherited work kept SVG on `theme-default`. In dark appearance, the mobile preview therefore shows a light diagram on the dark card. This was left as is to avoid overwriting the inherited integration.
4. **Zoom controls:** hidden on mobile, because the SVG preview already fits to width.
5. **Sidebar collapse:** session UI state; it is not persisted.
6. **Signed-in account:** the avatar/menu was verified by unit tests only. No authenticated browser session was available.
7. **Dark Present mode:** the diagram and backdrop are dark (#2b2b2b), but the existing Exit button keeps its light paper style. Not changed.
8. **Narrow page tabs:** at 1024 and below, tabs scroll horizontally behind the tools, and the last visible tab is clipped without a fade.
9. **Leftover files:**
   - `web/tmp/declare-then-message-highlight.png` was written by an existing E2E spec.
   - `web/test-results/` is gitignored.
   - `firebase-debug.log` and `firestore-debug.log` (repo root) are emulator logs written by the cloud E2E runs.
   - `.shot.mjs`, `.journey.mjs` and `web/.shots/` are my verification helpers, not product code.
   - Root `node_modules` was installed with `--ignore-engines` (local Node 20) so Playwright could run.

## Git diff summary

Inherited (from `baseline.patch` / copied untracked files, preserved):
- Tracked, inherited only, not edited by me: `web/src/preview/previewProtocol.ts`, `web/src/services/download.ts`.
- Untracked, not edited by me: `web/dark-theme-preview.html`, `web/src/preview/darkThemePreview.ts`, `web/src/components/preview/ExportDialog.tsx`, `ExportDialog.test.tsx`, `web/src/services/diagramOutput.ts`, `web/src/services/renderExport.ts`.
- Inherited and then edited by me (my delta over the inherited state): `AppRoot.tsx` +61/−43, `RendererHeader.tsx` +112/−90, `PreviewFrame.tsx` +55/−5, `PreviewFrame.test.tsx` +55/−0, `previewBootstrap.runtime.js` +5/−1, `previewBootstrap.test.ts` +8/−0.

Mine only:
- Modified:
  - `globals.css` +739/−391
  - `AppHeader.tsx` +241/−338 and `AppHeader.test.tsx` +83/−76
  - `RendererHeader.test.tsx` +52/−38
  - `AppRoot.test.tsx` +42/−8
  - `themes.ts` +36/−41
  - `CssPanel.tsx` +32/−34 and `CssPanel.test.tsx` +8/−4
  - `Console.tsx` +31/−35 and `Console.test.tsx` +3/−5
  - `ReportBugButton.tsx` +27/−6
  - `Layout.tsx` +24/−14
  - `PageTabs.tsx` +13/−11
  - `uiStore.ts` +5
  - `types.ts` +4
  - `ShareButton.tsx` +4/−4
  - `main.tsx` +3
  - `editorStore.ts` +1/−1 and `editorStore.test.ts` +1/−1 (default split 26.8/73.2)
- `settingsStore.ts` (initial appearance) and `settingsStore.test.ts`.
- Root E2E specs updated to the new design: `e2e/tests/preview.spec.js` (PRV-1, PRV-2, PRV-8), `mobile.spec.js` (MOB-3), `settings.spec.js` (SET-1), `cloud.spec.js` (SHR-6, PST-3).
- New: `web/src/app/appearance.ts` (+test), `web/src/preview/previewZoom.ts` (+test), `HANDOFF-PROGRESS.md`, `IMPLEMENTATION-REPORT.md`.

## Next actions (not done)
- Review, then commit to `codex/editor-core-claude` (not done: committing was not requested).
- Optional follow-up: a darcula-like SVG theme for the mobile dark preview (needs a renderer decision).
