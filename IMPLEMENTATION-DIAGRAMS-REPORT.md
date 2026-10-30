# Diagrams page — implementation report

Checkout: `/Users/pengxiao/.codex/worktrees/diagrams-claude/web-sequence`
Branch: `codex/diagrams-approved`
Date: 2026-10-20
State: all work is uncommitted in the working tree. No commit, push, merge or deploy was done. Figma was not changed. No other checkout was edited.

This report covers two passes:

- **Pass 1**: the approved Diagrams page (layout, templates, rendered cards, delete confirmation, appearance).
- **Pass 2** (`FOLLOWUP-FOLDERS-AND-REVIEW.md`):
  - fix for review finding R1 (Report a bug covered card actions);
  - the approved folder states (Figma F48 / `final-folders.png`);
  - search no-results;
  - the import integration contract.

## 1. Inherited snapshot (not my work)

| Item | Value |
|---|---|
| Base commit | `9e5cab59` "Temporary isolated base snapshot of authorized core Editor work for Diagrams implementation" |
| Source | `/Users/pengxiao/.codex/worktrees/editor-core-claude/web-sequence` at `12cf0e4d` |
| Record | `/Users/pengxiao/.codex/diagrams-handoff/BASE.json` |
| Status | Unverified snapshot of core Editor work. It is not accepted or merged. |

I did not edit, revert or re-validate any inherited file except the shared files listed in section 2.2. The inherited 29-test Editor validation is separate and was not touched. All diffs are against `9e5cab59`.

`web/node_modules` is a symlink into the editor-core checkout. I installed nothing into it. See section 7 for the cache side effects that did reach shared locations.

## 2. File-ownership diff (my work)

### 2.1 Owned area: `web/src/components/home/**`

Modified (tracked at `9e5cab59`):

| File | Change |
|---|---|
| `HomeView.tsx` | Rewritten in pass 1 (topbar, templates, search + sort, card grid, delete dialog, appearance). Pass 2 adds: folder/move/import/report-bug props; the move controller; the empty-folder and "every diagram is in a folder" states; no-results with the term and a Clear search button. |
| `DiagramCard.tsx` | Pass 1: real preview, pocket, Fork + trash (28×28), no kebab, no Export HTML. Pass 2: the card is draggable when folders exist; a drag never opens the diagram; a third action, Move to folder (Radix DropdownMenu, moves on selection). |
| `HomeView.test.tsx` | Pass 1 behaviour tests. Pass 2: the clear-search test uses `search-clear` because two buttons are now named "Clear search". |

New (untracked):

| File | Purpose |
|---|---|
| `DiagramThumbnail.tsx` | Per-card renderer (pass 1, unchanged in pass 2). |
| `thumbnailLayout.ts` / `.test.ts` | Thumbnail placement math and chrome CSS (pass 1). |
| `ConfirmActionDialog.tsx` | Pass 2. One destructive-confirmation component for diagram delete and folder delete. Cancel gets focus first and Escape cancels. While pending, the dialog cannot be dismissed or submitted twice. A failure keeps the dialog open for retry. |
| `DeleteDiagramDialog.tsx` | Diagram delete (Figma 36:7812). Pass 2 makes it a thin wrapper of `ConfirmActionDialog`; its behaviour and testids are unchanged. |
| `HomeSidebar.tsx` | Pass 2 rewrite: inline create/rename with pending, failure and Try again; visible Rename/Delete folder buttons; folder delete dialog; drop targets; the move status slot; the import contract; the Report a bug slot. |
| `moveController.tsx` | Pass 2. Shared by drag-and-drop and the Move to folder menu. Handles one write per diagram at a time, failure + Try again, Undo of the latest move only (exact previous `folderId`, including `null`), refusal of a stale Undo, and dismiss handling while a write is pending. |
| `icons.tsx` | Pass 2 adds the move-to-folder, pencil, folder-outline and check glyphs. |
| `home.css` | Pass 2 adds styles for folder actions, inline editing, drop highlight, the move status panel, the Move menu, the empty folder, no-results and the Report a bug tool. Light and dark. |
| `HomeFolders.test.tsx` | Pass 2 unit tests (section 4.2). |
| `assets/template-*.svg`, `HomeView.stories.tsx` | Pass 1 (unchanged). |

### 2.2 Shared files (documented edits)

**`web/src/app/AppRoot.tsx`**: HomeView prop wiring only. The full patch is in **`IMPLEMENTATION-DIAGRAMS-AppRoot.patch`** (checkout root, 20 insertions, 15 deletions). Changes:

| Change | Reason |
|---|---|
| Pass the folder functions directly: `createFolder` / `renameFolder` / `deleteFolder` / `handleMoveItem` / `handleDeleteItem` (the `void` wrappers are gone) | The Diagrams page needs the persistence Promise to show pending, failure and retry. The functions are the same as before. |
| `appearance` + `onToggleAppearance` | Pass 1: the global appearance toggle uses the existing `handleSettingChange` path. |
| The hub's `<ReportBugButton … />` is no longer a floating button. It is passed as `reportBug={<ReportBugButton placement="inline" … />}` | R1 fix. The same component, the same `view="hub"` and the same analytics callbacks, now rendered as the last Library tool. `ReportBugButton.tsx` itself is not changed. The Editor's inline placement is not touched. |

The onImport wiring is unchanged. The import worker owns `readImportFile` and the controller (section 3).

**`e2e/tests/library-actions.spec.js`** (pass 1): the approved design removes the kebab menu and the sort Select, so these tests now use the direct buttons. LIB-3 (Export HTML from a card) is `test.fixme` (L1).

**New Diagrams-specific tests:**

- `e2e/tests/diagrams-page.spec.js`: DGM-1…9 from pass 1, plus the pass 2 regression DGM-10 ×4.
- `e2e/tests/diagrams-folders-cloud.spec.js`: FDR-1…11. The `cloud.spec.js` suffix keeps it out of the default signed-out suite (`playwright.config.js` testIgnore).

These shared files are not changed: FolderList, ImportExportBar, ReportBugButton, UI primitives, `globals.css`, `useFolders`, `folderService`, `itemService`, `libraryStore`, `firebase.ts`, and the Editor, Settings, login and share code.

## 3. Import integration contract (for the import worker)

The integration wires the central controller **once**, by passing these HomeView props. HomeView passes them to HomeSidebar unchanged.

| Prop | Type | Behaviour |
|---|---|---|
| `onImportFile` | `(file: File) => Promise<void>` | Preferred. Receives the picked `File`; the controller calls `readImportFile`. When it is given, `onImport` is not called. The Import button is pending until the Promise settles. A rejection is caught, so there is no unhandled rejection; the controller owns all feedback. |
| `importPending` | `boolean` | True while an import runs anywhere. The Import button shows "Importing…", has `aria-disabled="true"` and `aria-busy`, and ignores clicks and file picks. |
| `onImport` | `(text: string) => void` | Legacy path, kept for compatibility (current AppRoot uses it). It is used only when `onImportFile` is absent. |
| `onImportError` | `(error: unknown) => void` | Legacy path only. Called when `file.text()` rejects, in place of the old unhandled rejection. **Not wired in AppRoot** (to avoid a conflict with the import worker). With the legacy path, a read failure is caught and reported nowhere. |

Shared rules:

- The picker input is reset after every change, so picking the same file again fires again.
- Cancelling the picker (no file) does nothing and shows nothing.
- A pick while an import is pending (internal or `importPending`) is ignored. There is no overlapping submit.
- No sidebar banner or second feedback system was added.

## 4. Tests and results

All local. Private caches and ports (section 7).

### 4.1 Commands and results (final runs, on the final code)

| Check | Command | Result |
|---|---|---|
| Typecheck | `cd web && npx tsc --noEmit --incremental false -p .` | Clean |
| Build | `cd web && npx vite build -c /tmp/diag-scripts/vite.private.config.ts` | Succeeds (only the existing chunk-size warning) |
| Home unit tests | `cd web && npx vitest run -c /tmp/diag-scripts/vitest.fs.config.ts src/components/home` | 3 files, **47/47 passed** |
| Full Vitest | `cd web && npx vitest run -c /tmp/diag-scripts/vitest.fs.config.ts` | **112 files passed; 1164 passed, 1 skipped**. The private config sets `server.fs.strict=false` (L5) and a private `cacheDir`. |
| Full root E2E, Chromium, dev | `PW_BASE_URL=http://localhost:3517 npx playwright test --project=chromium --retries=0` | **76 passed, 32 skipped, 0 failed** (108). Skips: the existing remote/cloud guards and LIB-3. |
| Diagrams + library + templates + smoke, Chromium, prod build | `PW_BASE_URL=http://localhost:4932 npx playwright test e2e/tests/{diagrams-page,library-actions,library,templates,smoke}.spec.js --project=chromium --retries=0` | **32 passed, 1 skipped** (LIB-3) |
| Diagrams page, WebKit, prod build | `PW_BASE_URL=http://localhost:4932 npx playwright test -c /tmp/diag-scripts/pw-webkit.config.mjs e2e/tests/diagrams-page.spec.js` | **13/13 passed** (includes DGM-10 ×4) |
| Signed-in folders, Chromium, emulators | `npx playwright test -c /tmp/diag-scripts/pw-cloud-all.config.mjs -g "FDR-\|FLD-" --retries=0` (dev 3518 with `VITE_USE_EMULATOR=1`; Auth + Firestore emulators) | Re-run on the final code at session end: **17/17 passed** = FDR-1…11 (13) + existing FLD-1, 3, 4, 5. |
| Signed-in folders, WebKit, emulators | `npx playwright test -c /tmp/diag-scripts/pw-cloud-webkit.config.mjs -g "FDR-\|FLD-" --retries=0` (the config matches only `diagrams-folders-cloud.spec.js`, so FLD tests are not in this run) | Final-code run: **7 passed, 6 failed** (13). Passed: FDR-5, 6, 7, 8, FDR-9 dark, FDR-10 ×2. Failed: FDR-1, 2, 3, 11 (create/rename), plus FDR-4 and FDR-9 light. The failure traces show `FirebaseError: Failed to get document because the client is offline`, `[code=unavailable]`, and WebKit "Fetch API cannot load …Firestore/Listen/channel… due to access control checks". FDR-4 and both FDR-9 then **passed when re-run alone** (3/3). A separate earlier WebKit run of the existing FLD-1 and FLD-3 (`pw-cloud-webkit-fld.config.mjs`) **failed with the same offline error**. So Firestore's WebKit channel to the emulator is unreliable. Create/rename on WebKit stays **unverified** (L16). |

### 4.2 Failing regression first (pass 2)

Each bug fix in pass 2 started with a test that failed, then passed after the fix.

| Bug | Test | Failing evidence |
|---|---|---|
| R1: Report a bug covers card actions | DGM-10 (1440/390 × light/dark). Scrolls the real scroll container in 60 px steps; `elementFromPoint` at each action centre must hit that action. | All 4 failed before the fix, e.g. `home-action-delete-fx-hit-8 @scroll 240 covered by report-bug-fab`. The first draft scrolled `window` and passed wrongly; I corrected it to scroll the hub container. All 4 pass after the fix, on Chromium and WebKit. |
| Import: unhandled `file.text()` rejection, no pending guard, no `onImportFile` | Import contract tests in `HomeFolders.test.tsx` | They fail against the pass 1 sidebar (6 failures in that run, together with the folder rows below). |
| Folder create/rename failure lost the typed name, no retry, no pending guard | Create/rename failure tests | Same run against the pass 1 sidebar |
| Drop highlight lost: Chromium sent only `dragenter` for the final pointer position, then a bubbling `dragleave` | Unit "highlights on dragenter alone…"; FDR-5 | The unit test failed at the highlight assertion without `onDragEnter`. FDR-5 failed before. Fix: accept on `dragenter`/`dragover`; clear only on a `dragenter` outside any drop row. |
| Dismissing the status while Undo is pending lets "Move undone" reappear | Unit "dismissing while a move is pending…"; FDR-9 | The unit test failed (line 330) before the fix. Found by FDR-9. A failure is still shown after dismiss. |
| A single tap at 390 sometimes opened rename (touch double-tap → `dblclick`) | Unit "a touch double-tap…"; FDR-11 | The unit test failed without the pointer-type guard. Touch users rename with the visible Rename button. |

### 4.3 What the folder tests check

Unit tests (`HomeFolders.test.tsx`, 26 tests):

- **Create**: Enter commits, Esc cancels, blank does nothing. While pending, the input is read-only and a second Enter does nothing (no duplicate write). A failure shows "Couldn’t create this folder / Check your connection and try again. / Your folder name is kept." with the name kept. Try again retries. Cancel closes. Clicking away cancels. Not offered when signed out.
- **Rename**: opens from the Rename button, a double-click or F2. Enter renames, Esc cancels, blank does nothing. Blur commits (the existing behaviour). A failure keeps the name and Try again retries.
- **Delete folder**: shows `Delete “Checkout”?` and "The folder contains 2 diagrams. Your diagrams will be kept and moved to Not in a folder." An empty folder shows "The folder is empty." Cancel gets focus first and focus returns to the trigger. While pending, double submit and Escape are blocked. A failure allows retry. On success, the view switches to Not in a folder.
- **Empty states**: empty folder, no search results (the term is kept in the input and in the message; Clear search clears it and focuses the input) and empty library are three distinct states.
- **Move**:
  - The menu moves at once, with no "Move here" and no second confirmation; the counts update.
  - Undo restores `null`.
  - A stale Undo (the diagram moved again elsewhere) is refused.
  - A failed move keeps the counts unchanged, and Try again retries.
  - While a move is pending, a second move of the same diagram is ignored.
  - Drag: highlight and "+1", the drop moves it, the drag never opens the diagram, the diagram's current place is not a drop target, and Esc/cancel moves nothing.
- **Import contract** (section 3). **Report a bug** is the last Library tool and is not in the grid.

Signed-in emulator tests (`diagrams-folders-cloud.spec.js`). Every write is checked in Firestore over the emulator REST API, not only on screen. Failures are real `permission-denied` rejections: the test swaps the emulator rules for a deny variant at runtime and restores the repo rules after each test. `firestore.rules` is not edited.

| Test | Checks |
|---|---|
| FDR-1 | Create inline: blank, Esc (focus returns to New folder), Enter. `users/{uid}.folders` holds exactly `Backend`, and it survives a reload. |
| FDR-2 | Create with users writes denied: the error state keeps the name and nothing is written. Rules restored, then Try again: exactly one folder. |
| FDR-3 | Rename by button, Esc, F2, Enter; persisted. |
| FDR-4 | Delete folder: real name and count, Cancel/Escape (focus returns), confirm. The folder is removed; both item docs still exist (title kept); the view switches to Not in a folder (count 2, both cards visible). |
| FDR-5 | 1440: natural mouse drag (down, stepped moves, up). Mid-drag: highlight, "+1", hint "Drop to move · Esc to cancel". After the drop: `folderId` set in Firestore; status "Diagram moved / Checkout flow → Authentication / Diagram content is unchanged."; no Move here. Undo: Firestore `folderId` back to `null`; diagram content unchanged. |
| FDR-6 | Escape during a natural drag: no highlight, no status, `folderId` still `null`, the diagram is not opened. |
| FDR-7 | Keyboard: Enter opens the menu (the current folder is disabled), Arrow, Enter. The move completes at once and focus returns to the trigger. Undo restores `fd-checkout`. |
| FDR-8 | Item updates denied: "Couldn’t move this diagram" (role alert); Firestore unchanged; the sidebar shows the diagram where it was. Rules restored, then Try again: moved. |
| FDR-9 ×2 | 390 touch (`hasTouch`, `isMobile`), light and dark: tap Move to folder, tap the destination; persisted. With the status docked at the bottom, every card action can still be reached by scrolling (pointer hit-test). Undo, then Dismiss. |
| FDR-10 ×2 | Empty folder vs no results, light and dark. |
| FDR-11 | 390 touch: tap a folder; its Rename/Delete scroll into view; rename persists; delete shows "The folder contains 1 diagram."; the item doc is kept. |

## 5. Screenshots

All in `diagrams-validation/` (untracked). They use local fixtures or seeded emulator accounts only.

**Pass 2, signed-in folder states** (`diagrams-validation/folders/`, 32 files). For each of `1440-light`, `1440-dark`, `390-light` and `390-dark`:

| File | State |
|---|---|
| `01-folder-selected` | Selected folder with visible Rename/Delete |
| `02-empty-folder` | "No diagrams in this folder" |
| `03-create-inline` | Inline create with "Enter to create · Esc to cancel" |
| `04-rename-inline` | Inline rename |
| `05-drag-to-folder` (1440) / `05-move-menu` (390) | Drop highlight "+1" with the hint / the touch fallback menu |
| `06-moved-undo` | "Diagram moved" with Undo (sidebar at 1440, docked at 390) |
| `07-delete-folder` | `Delete “Checkout”?` with the count |
| `08-no-results` | No matches with the term and Clear search |

The create-failure and move-failure states are in the Playwright output (`/tmp/diag-pw-cloud-results/**/fdr2-create-failed.png`, `fdr8-move-failed.png`). They are not copied into the checkout.

**R1 fix, signed out, prod build, refreshed in pass 2:**

- `desktop-1440-{light,dark}{,-scrolled,-keyboard-focus,-delete-dialog}.png`
- `narrow-390-{light,dark}{,-scrolled,-tools-strip}.png`: no floating button; Report a bug is at the end of the tools strip.
- `mid-1024-light.png` and `webkit-prod-1440-light.png`.

**Stale (pass 1, before the folder work):** `storybook-*.png` and `template-payload-cards.png`. The Storybook sidebar shots show the pass 1 folder rows (hover-only delete). The `folders/` set supersedes them.

## 6. Performance (pass 1, prod build, Chromium)

| Cards | Grid visible | All previews ready | JS heap |
|---|---|---|---|
| 6 | 93 ms | 807 ms | 36.5 MB |
| 24 | 176 ms | 2383 ms | 107 MB |
| 48 | 235 ms | 4689 ms | 179 MB |

Every card mounts its own iframe at once (no cache, queue or backend, as briefed). Pass 2 did not change the renderer, so these numbers were not re-measured.

## 7. Environment, ports, caches and side effects

| Item | Detail |
|---|---|
| Ports (pass 2) | Dev 3517; emulator-wired dev 3518; prod preview 4932. The emulators use 8080 (Firestore) and 9099 (Auth), plus hub 4400, logging 4500 and websocket 9150. **8080 and 9099 are not unique**: `firebase.ts` (shared, not edited) hard-codes them. I checked they were free before each start. The user preview on 4411 was not touched. |
| Session end | Servers on 3517, 3518 and 4932 and the emulators (8080, 9099, 4400, 4500, 9150) were stopped. All of those ports are free, and the hub locator file is removed. The user preview on 4411 is still running. |
| Private caches (pass 2) | Vite `cacheDir=/tmp/diag-vite-cache`; Vitest `/tmp/diag-vitest-cache`; Playwright output in `/tmp/diag-pw-*`; emulator project dir `/tmp/diag-emu` (copy of the repo `firestore.rules`, UI off); emulator jars in `FIREBASE_EMULATORS_PATH=/tmp/diag-emu/cache`. |
| **Side effect, pass 1: shared Vite cache** | Pass 1 ran `vite` and `vite preview` with the default `cacheDir`. That is `web/node_modules/.vite`, which resolves into the editor-core checkout's `node_modules`. The directory exists there (last modified 16:45). It is a regenerable dependency cache; I did not delete it. Pass 2 used private caches only. |
| **Side effect, pass 2: shared emulator jar cache** | My first emulator start used the default `~/.cache/firebase/emulators`. The global `firebase` CLI 13.35.1 downloaded `cloud-firestore-emulator-v1.18.2.jar` and **removed `v1.19.8.jar`** from that shared cache. At 18:57 another process (a newer firebase-tools) downloaded v1.19.8 again. My running emulator was then terminated (exit 143) during a run. I restarted it with a private jar cache. The shared cache now holds v1.19.8 again. Any test run that lost its jar between those times would have had to re-download it. |
| **Side effect, pass 2: emulator hub locator** | At start the emulator printed "It seems that you are running multiple instances of the emulator suite for project staging-zenuml-27954". The CLI keeps one hub locator per project ID: `$TMPDIR/hub-staging-zenuml-27954.json`. My start overwrote it (now points to my hub, 127.0.0.1:4400), and stopping my emulator removes it. At session end no other hub was listening on 4400–4402. Another agent that uses `emulators:exec` or hub discovery for this project ID could read my locator while mine ran. |
| WebKit browser | Pass 1 installed Playwright WebKit into the global browser cache (`npx playwright install webkit`). |
| Emulator data | `globalSetup` wipes the local Auth and Firestore emulators before each run. Only seeded `e2e-*` test accounts were used. No real user data and no production access. |

## 8. Limitations and open items

Numbering below is new for pass 2. Pass-1 mapping: pass-1 L7 (Report a bug FAB covers cards) is **fixed** (R1, DGM-10). Pass-1 L4 (folders not verified signed in) is **replaced** by the emulator tests. Pass-1 L12 (delete copy) and L13 (no-results state) are **resolved**. The other pass-1 items keep their content here under new numbers.

| # | Item |
|---|---|
| L1 | **No UI entry for HTML export.** The approved card removes it, and the Editor ExportDialog offers only PNG and SVG. The capability stays (`handleExportHtml`, the `onExportHtml` prop). LIB-3 is `fixme`. Needs a product decision. |
| L2 | **Template corner radius.** Real renders keep core's 4 px participant radius; the Figma art shows square corners for Black & White and Classic UML. |
| L3 | **Template art and icons are hand-drawn.** Figma `get_screenshot` was not allowed and `design.json` has no paths. This includes the pass 2 folder, pencil and move glyphs. |
| L4 | **Move status at 390 docks over the bottom of the page.** It is fixed at the bottom, the surface reserves 200 px, and Dismiss is always available. Success states other than "moved" close after 5 s. While it is shown, it covers part of the grid; FDR-9 proves every action can still be reached by scrolling. On wide screens it sits in the sticky sidebar and covers nothing. |
| L5 | **4 Vitest files fail to load with the repo config** in this checkout (`Denied ID …zenuml-server.worker.js?url`), because `web/node_modules` is a symlink outside Vite's fs allow-list. Inherited and environmental. They pass with the private config. |
| L6 | **No ESLint run.** `web/` has no ESLint config (pre-existing). |
| L7 | **Firestore latency compensation.** When a signed-in move is rejected, the Firestore SDK first shows the move locally, then rolls it back. The diagram can appear in the target folder for the length of the server round trip. `itemService.setItem` also writes the local copy before the cloud write, so after a failed move the local copy holds the new `folderId` until the next save. The signed-in list reads Firestore, so the screen is correct (FDR-8). |
| L8 | **Offline writes queue instead of failing.** Writes made while Firestore is offline are queued: `createFolder`/`renameFolder` stay pending, and a move resolves as queued (`itemService` does not wait for the server when offline). The failure UI appears only for real rejections. There is no timeout. |
| L9 | **Create retry can duplicate.** `useFolders.createFolder` writes the folder and then reloads. If the write succeeds but the reload fails, Try again creates a second folder. `useFolders.ts` is outside my ownership; not changed. |
| L10 | **A move changes "Last modified".** `itemService.setItem` stamps `updatedOn` on every signed-in write, so a moved diagram jumps to the top of the Last modified sort. Existing behaviour. The diagram content is unchanged. |
| L11 | **Folder delete keeps an orphaned `folderId`.** This is the existing `folderService` behaviour: the folder is removed and items keep the old id. The page counts and filters them as Not in a folder. No bulk item rewrite was added. |
| L12 | **Signed out: no folders and no move.** Folders are cloud-only today, so these controls are hidden. No cloud support was invented. |
| L13 | **Drag uses HTML5 drag-and-drop.** It needs a mouse or pen. Touch and keyboard users use the Move to folder menu (FDR-7, FDR-9). The drag image is static ("Drag onto a folder"); the target row shows "+1" and the sidebar shows "Drop to move · Esc to cancel". |
| L14 | **Mid-width grid** (pass 1): between 640 and 1439 px the cards flex (min 300 px). From about 1100 to 1270 px they grow past the 352 px design width. |
| L15 | **Intermittent LIB-1 under parallel load.** LIB-1 (Fork waits for autosave, about 25 s) failed once in a parallel run and passed alone. In the final full run it passed. Existing slow test. |
| L16 | **WebKit + emulator: create and rename not verified.** Firestore reads go "offline" in Playwright WebKit against the emulator. This affects both the new FDR tests and the existing FLD tests. Real Safari against production Firestore was not tested (no production writes allowed). |
| L17 | **Folder rows are not reorderable and folders do not nest.** As designed. |
| L18 | **Empty library** shows the templates row with the existing empty-state CTA (pass 1). |

## 9. Not done (out of scope)

Editor, Settings, login and share redesign; import feedback UI (owned by the import worker); new backend or cache; production writes; deploy; merge; commit.

## 10. Pass 3: review corrections DG-F1, DG-F2, DG-F3

Source: `/Users/pengxiao/.codex/diagrams-handoff/acceptance-final/REPORT.md` and `source-findings.json`. These edits change files covered by that review's 22 source hashes (`HomeSidebar.tsx`, `moveController.tsx`, `DiagramThumbnail.tsx`, `HomeView.tsx`, `home.css`, `HomeFolders.test.tsx`), so the hashes no longer match. One file is new: `DiagramThumbnail.test.tsx`. `AppRoot.tsx` and other parent-owned code were not changed. DG-I1, DG-I2 and DG-I3 (parent integration) were not touched.

### 10.1 Changes

| Finding | Fix |
|---|---|
| DG-F1: New folder replaced a pending rename | `HomeSidebar.startCreate` now returns while a create/rename write is pending (`pendingRef`), like `startRename`. The New folder button gets `aria-disabled` while pending. The blur-then-click race is covered: the blur starts the rename and sets `pendingRef` synchronously, so the click that follows is ignored. After the write settles, New folder works normally. **Additional fix found by the new test:** `close()` returns focus in a `requestAnimationFrame`. That delayed focus could take focus away from a New folder input opened right after a rename, and the blur then closed the new input (intermittent: 1 failure in 3 runs). It now returns focus only when focus was lost (`document.activeElement` is `body`). |
| DG-F2: an older move overwrote the newer status and Undo | `moveController.settle` publishes only for the latest operation (`op === opRef.current`). An older **success** is dropped (the library already shows where the diagram is). An older **failure** is not dropped: it goes to a new `earlier` state, shown as a second row in the same status panel: "Couldn’t move {title}. It stays where it was." with its own Try again (`move-earlier-failure`, `move-earlier-retry`). For an older failed Undo the row says "Couldn’t undo the move of {title}." and Try again repeats the Undo. If no status is on screen (dismissed), the older failure is shown as the main status. A new move or Undo of the same diagram clears its earlier failure. Dismiss clears both. While an earlier failure is shown, "Move undone" and "Can’t undo" do not close themselves. Per-item locks, `lastSeqRef` stale-Undo checks and dismiss-during-pending are unchanged. |
| DG-F3: thumbnail compiled `item.css` for ACSS | `DiagramThumbnail.pushCss` uses the Editor's inputs (`AppRoot.tsx` CSS effect): `item.html` for `acss`, `item.css` for other preprocessed modes, always with `item.cssSettings`. Plain CSS passes through unchanged. The effect dependencies and the iframe `key` are now one `frameKey` built from `js`, `cssMode`, `css`, `html` and `JSON.stringify(cssSettings)`. An html-only or settings-only change therefore remounts the frame and compiles again. A compile that finishes after the inputs changed is dropped by the existing `disposed` guard. A compiler rejection now posts empty CSS (Editor behaviour) instead of an unhandled rejection. Placement (70%, crop, chrome CSS) is not changed. |

New UI: the earlier-failure row (DG-F2) is an addition to the approved "Moved · undo" panel. It reuses the panel's error text and small secondary button styles (`.dh-status-earlier` in `home.css`). It has no Figma frame.

### 10.2 Failing regressions first

Added before any fix. Log: `/tmp/diag-dgf/before-fix.log` — **10 failed, 48 passed (58)**.

| Test (file › describe › name) | Failure before the fix |
|---|---|
| `HomeFolders.test.tsx` › DG-F1 › Enter, then New folder while pending: the rename keeps its name, error and retry | `folder-new-input` appeared (expected null) |
| › DG-F1 › blur then New folder click (rejection): one rename write, labelled as rename, retry once | same |
| › DG-F1 › blur then New folder click (success): the rename completes and New folder works afterwards | same |
| › DG-F2 › an older success while the newer move is pending keeps the newer status; Undo targets the newer move (null) | `data-kind` was not `pending` after the older move resolved |
| › DG-F2 › an older success after the newer result keeps the newer result and Undo | route text replaced by the older move |
| › DG-F2 › an older failure does not replace the newer status; it is shown separately with its own retry | `data-kind` was not `pending` |
| › DG-F2 › an older failure after the newer result keeps that result and its Undo | `data-kind` was not `moved` |
| `DiagramThumbnail.test.tsx` › ACSS compiles item.html with cssSettings, not item.css | `computeCss` not called with the html |
| › an html-only change, then a cssSettings-only change, refreshes the same mounted item | no new compile after the html-only change |
| › a stale compilation finishing late cannot overwrite the newer rules | posts were `['new-rules', 'old-rules']` |

The fourth thumbnail test (SCSS/LESS compile `item.css`; plain CSS passes through) passed before and after; it guards the existing behaviour.

### 10.3 Results after the fixes

| Check | Command (in `web/`) | Result |
|---|---|---|
| Focused unit tests | `npx vitest run -c /tmp/diag-scripts/vitest.fs.config.ts src/components/home` | **4 files, 58/58 passed** (log `/tmp/diag-dgf/after-fix.log`). Includes the 10 new tests and all earlier folder, move, dismiss, stale-Undo, same-item, import and layout tests. |
| Repeat of the 7 DG-F1/DG-F2 tests | same, `HomeFolders.test.tsx -t "DG-F"`, 8 runs | 8/8 runs: 7 passed |
| Typecheck | `npx tsc --noEmit --incremental false -p .` | Clean, exit 0 (log `/tmp/diag-dgf/tsc.log`) |

Not run in this pass, as instructed: full Vitest, build, E2E, emulator and browser runs.

### 10.4 Remaining gaps

- **No browser proof for these three fixes.** They are verified in jsdom only:
  - The thumbnail tests mock `computeCss` and simulate the frame's `ready` message. No real ACSS diagram was rendered and compared with the Editor in a browser.
  - The earlier-failure row has no screenshot. Its layout at 390 px in the docked panel was not checked.
- **The DG-F1 blur-then-click race was tested with user-event**, which runs mousedown (blur), then click. Real touch and WebKit event order were not tested.
- **The earlier emulator and E2E results (sections 4 and 5) predate this pass.** FDR-5/7/8/9 (moves) and FDR-1/3/11 (create and rename) were not re-run after these changes.
- **Parent-owned items stay open:**
  - DG-I1: mobile Folders drawer, account menu, `useFolders` initial error state.
  - DG-I2: AppRoot still passes the legacy `onImport`, not `onImportFile` / `importPending`.
  - DG-I3: create retry can duplicate after a failed reload (also L9).
