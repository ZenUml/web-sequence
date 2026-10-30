# Library import and Export all feedback — implementation report

## Scope

- **Round 1:** the approved import feedback design **Diagrams · 导入反馈 · Light & Dark** (Figma `FVH4SBtHNJMWZFedkE23H4`, node `36:8435`). It has three states: success, invalid file and save failure.
- **Round 2** (follow-up `FOLLOWUP-REVIEW-CORRECTIONS.md`):
  1. Fix the cold-load misclassification of import counts.
  2. Publish an import/export API for the Diagrams `HomeSidebar`.
  3. Add Export all feedback from `final-export-all.png` (board `36:8517`): preparing, download started, failed + retry, and empty library.
- **Round 3** (independent review P1, identity cancellation): bind import and Export all to the account that started them. See §2d. The frozen round-2 source (`frozen/import-final`) is superseded.
- **Round 4** (acceptance-final IE-F2 P1, IE-F3 P2): keep library read errors as errors, and count only local records that exist. See §2e.
- **Round 5** (acceptance-corrected IE-C1 P1, IE-C2 P2, IE-C3 P2): bind ownership at the File boundary and at every save boundary. See §2f. The frozen `import-corrected` snapshot is now historical.
- **Round 6** (acceptance-latest IE-C2-index): guard the index write nested inside `localItems.add`. See §2g.

Checkout and base:

- Checkout: `/Users/pengxiao/.codex/worktrees/import-feedback-claude/web-sequence`, branch `codex/import-feedback`.
- Base: `HEAD` = BASE.json `sourceSnapshot` `9e5cab59181e63ed39980c833e522cbcecf98257`. That temporary Editor snapshot is not accepted. All diffs below are relative to it.

What was not done:

- Nothing was committed, pushed, merged or deployed.
- No Figma edits, no production or Firebase writes, and no backend or payment changes.
- No Diagrams (`components/home/**`) or Editor sources were edited. No HTML export entry was added.
- The browser checks used signed-out localStorage only.
- The user's server on :4411 was not touched and was still listening at the end. My own servers on :4417 and :4418 were stopped.
- Round 3 started no servers and no browsers. `:4411` was still listening at the end of round 3 (`lsof`, pid 63418).

## 1. Data flow

```
ImportExportBar / HomeSidebar* / panel picker
        │ readImportFile(file, onImport)        (*parent wires HomeSidebar, §4)
        ▼
HomeView onImport(text): void ── AppRoot.handleImport ── runImport(text, deps)
                                                         │ 1 validate (instant invalid feedback)
                                                         │ 2 await library.getExistingIds()   ◄── useLibraryReader
                                                         │ 3 await saveItems(unique-id map)
                                                         ▼
                                              importFeedbackStore ─┐
Export all button ── AppRoot.handleExportAll ── runExportAll ──────┤
                     (getItems: library.getLibraryItems)           ▼
                                              exportFeedbackStore ─► LibraryFeedback
                                                                    (one portal: stacked panels
                                                                     + shared live regions)
```

`useLibraryReader` gives import and export a settled view of the library:

- **Signed out:** it reads the storage index and records directly. This is the source of truth, and it already includes writes that `useItems` has not reloaded yet.
- **Signed in:** it waits until `loading` is false **and** the list has been replaced since the last uid change. `useItems` does not reset `loading` on sign-in, so until the first snapshot arrives it still holds the signed-out list.
- **Timeout:** after 15 s it returns `null`, meaning unknown.

## 2. Round-2 fixes and features

### 2a. Cold-load misclassification (proven issue)

Cause: AppRoot classified imports against `useItems().items`, which is `[]` until the first load. An existing diagram was therefore counted as new: the panel said "1 diagram added." and `itemsImported` fired.

Fix:

- `runImport` validates first, so invalid files are reported at once.
- It then awaits `existingIds()` from `useLibraryReader`, then saves.
- Unique-id merge is unchanged.
- The prepared payload is reused on retry: the same diagram ids and page ids, with counts relative to the library before the first attempt.
- Real committed counts: success is reported only after `saveItems` resolves.
- If existing ids cannot be read (timeout or rejection), the import still saves. The panel then says only "N diagrams imported." with no added/updated split, and no `itemsImported` event is sent, so no fake counts are reported.

### 2b. API for HomeSidebar (parent wires it; I did not edit Diagrams sources)

The Diagrams `HomeSidebar.tsx` lines 76–80 currently call `onImport(await file.text())`. That path gets no filename, no busy state and no read-error feedback, and a read error becomes an unhandled rejection. The integration change needs no new HomeView/HomeSidebar prop types:

```tsx
import { readImportFile, useImportBusy } from '../library/importFeedbackStore';
import { useExportBusy, useExportDisabled } from '../library/exportFeedbackStore';

// handleFile:
const file = e.target.files?.[0];
e.target.value = '';
if (!file || !onImport) return;
await readImportFile(file, onImport);   // filename, busy, read errors; never rejects

// Import button: aria-disabled/aria-busy = useImportBusy()
// Export all:    aria-busy = useExportBusy(); aria-disabled + reason "No diagrams to export" = useExportDisabled()
```

How the API behaves:

- `readImportFile` and `runImport` never reject. A throwing or rejecting handler becomes save-failed feedback.
- A second file is ignored while one is reading or saving.
- `ImportExportBar` uses the same API.
- The contract is covered by the "Public import API (sidebar contract)" tests: filename, busy, duplicate/update counts, a blocked concurrent second file, read failure, and save failure followed by retry.

### 2c. Export all feedback (`final-export-all.png`)

| State | Behaviour |
|---|---|
| Preparing | Shown only if preparation is really slow (>400 ms, e.g. waiting for a signed-in snapshot). There is no artificial delay and no percentage. It reads "Creating a JSON file with N diagrams." (or "with your diagrams." while the count is unknown) and "Keep browsing…". The panel shows "Preparing…" and has no actions. The button gets `aria-busy` + `aria-disabled`, and repeat clicks are ignored. |
| Download started | Shows the real filename `zenuml-diagrams.json`, the real total ("N diagrams included.") and "Check your browser's downloads for the file." It never says "saved" or "complete". Done dismisses it. A second click within 1.5 s (double click) is ignored; a later click downloads again on purpose. |
| Failed | Covers a download that throws and a library that cannot be read. Text: "Couldn't prepare the export" / "The download couldn't be started." / "Your diagrams are still available. Try again." Actions: Cancel and Try again. Focus moves to Try again, and Cancel returns focus to Export all. |
| Empty | Export all is `aria-disabled` with the description "No diagrams to export". It stays focusable, so the reason is reachable. Activating it shows "No diagrams to export / 0 diagrams / There are no saved diagrams in this library. / Create or import a diagram first." with Close. Nothing is downloaded. |

Other export details:

- Export all exports the whole settled library, not the search- or folder-filtered view.
- The `exportItems` analytics event is sent once per accepted attempt, with category `fn` and no label, as before.
- Starting an export clears any finished import feedback, and the other way round. Both panels sit in one stack, so they never overlap.

### 2d. Round 3 — account switch during import or Export all (P1)

**Root cause.** In round 2, `useLibraryReader.waitForSnapshot` kept one shared waiter set. A waiter checked only "is the library ready?", not "is it still the same account?". So:

1. An import started under account A waited for A's library.
2. The user switched to B (or signed out). B's snapshot arrived.
3. The A waiter woke and answered with **B's** ids.
4. `runImport` then called `itemService.saveItems`, which reads the **live** uid at call time. A's file was written into B (or into local storage after sign-out), and `itemsImported` fired.

A failed import also kept its prepared payload. After a switch, Try again replayed A's file into B. Export all had the same waiter, so it could download B's library for a click made under A. `firestore.rules` lets any signed-in user create `items/*`, so the server does not stop this; the client must.

**Fix: an operation identity token.** Every operation captures `{ uid, generation }` when it starts. The generation increments on every uid change, so A → B → A gives a new A generation and old A tokens stay stale.

```
click/import ─► token = identity.current()          {uid:'A', gen:3}
                 │
                 ├─ reader read(token) ─► waits ─┬─ same gen + ready ─► A's library
                 │                               └─ gen changed / unmount ─► LIBRARY_CANCELLED
                 ├─ check isCurrent(token) ─────── false ─► phase 'cancelled', no write, no download
                 ├─ saveItems(items, { expectedUid: 'A' })
                 │     guard re-reads live uid: before start, before each local write,
                 │     right before batch.commit ─► mismatch ─► IdentityChangedError(writesStarted)
                 └─ check isCurrent(token) after save ─ false ─► 'cancelled', no success, no analytics
```

**Exact guards** (each covered by a discriminating test):

| # | Where | Check | Result on mismatch |
|---|---|---|---|
| G1 | `useLibraryReader` read entry | `isCurrent(token)` | `LIBRARY_CANCELLED` at once |
| G2 | `useLibraryReader` waiter wake (every render) | generation and uid of the token | `LIBRARY_CANCELLED`; never wakes with another account's snapshot |
| G3 | `useLibraryReader` signed-out storage read | `isCurrent(token)` after the async read | `LIBRARY_CANCELLED` |
| G4 | `useLibraryReader` unmount | disposes the binding | pending reads → `LIBRARY_CANCELLED`; `isCurrent` → false |
| G5 | `runImport` before save | reader answer or `isCurrent(token)` | `cancelled`, `writesMayHaveStarted: false`, `saveItems` not called |
| G6 | `runImport` retry | `isCurrent(prepared.token)` | `cancelled`; A's payload is dropped, never replayed |
| G7 | `itemService.saveItems` guard | live `uid === expectedUid` before start, before every signed-out `localStore.set` and `localItems.add`, and right before `batch.commit()` | throws `IdentityChangedError`; nothing written for the new identity |
| G8 | `runImport` after save resolves | `isCurrent(token)` | `cancelled`, `writesMayHaveStarted: true`; no success and no `itemsImported` |
| G9 | `runExportAll` after the library read | reader answer or `isCurrent(token)` | `cancelled`; no download |
| G10 | reader effect on a generation change | `importFeedbackStore.identityChanged()` / `exportFeedbackStore.identityChanged()` | a failed retry → `cancelled` with its payload and text dropped; finished results cleared; attempts in flight left to G5–G9; an "Import interrupted" notice is kept until dismissed |

**User-facing copy** (nonmodal, same panel and tokens):

- Import, before any write: "Import canceled / The account changed before anything was saved. No diagrams were imported. / Choose the file again to import it into the library shown now." Actions: Cancel, Choose another file. No Try again.
- Import, writes may have started (G7 with local writes, G8, or a dropped failed retry): "Import interrupted / The account changed during the import. Some diagrams may have been saved before the change. / Nothing was saved to the library shown now. …". It makes no rollback claim.
- Export: "Export canceled / zenuml-diagrams.json / The account changed before the file was ready. No file was downloaded. / Export again to download the library shown now." Actions: Cancel, Export again.
- Import cancellation uses the alert region. Export cancellation uses the status region. Neither moves focus, because the account change comes from the sign-in UI.

**Minimal integration API** (for other workers):

```ts
// components/library/libraryIdentity.ts
interface OperationIdentity { uid: string | null; generation: number }
interface IdentityBinding { current(): OperationIdentity; isCurrent(t: OperationIdentity): boolean }
const LIBRARY_CANCELLED: unique symbol;            // distinct from null ("could not read")

// components/library/useLibraryReader.ts
const { identity, getExistingIds, getLibraryItems } = useLibraryReader({ items, loading, uid });
getExistingIds(token?)  : Promise<Set<string> | null | LIBRARY_CANCELLED>   // token defaults to identity.current()
getLibraryItems(token?) : Promise<Item[]      | null | LIBRARY_CANCELLED>

// services/itemService.ts (re-exported from services/identityGuard.ts)
saveItems(items, guard?: { expectedUid: string | null }): Promise<void>
class IdentityChangedError extends Error { readonly writesStarted: boolean }

// runImport / runExportAll deps: optional `identity: IdentityBinding`
```

Bound contract:

- Without `guard`, `saveItems` behaves exactly as before (writes under the live identity). All existing callers are unchanged. `useImportOnLogin(itemService.saveItems)` still type-checks.
- With `guard`, `saveItems` never writes for any identity other than `expectedUid`. It does not roll back writes already made for `expectedUid`. `writesStarted` is true only when local per-item writes had begun.
- Without `identity`, `runImport` and `runExportAll` keep their round-2 behaviour. The reader still binds every read to the identity current at call time.
- **Parent wiring for account-local import (`useImportOnLogin`), not done here (hooks and modals are outside my ownership):** capture the uid when the "import local diagrams" offer is accepted and call `saveItems(localItems, { expectedUid: thatUid })`. Treat `IdentityChangedError` as "cancelled: the account changed". Also check the uid again before clearing the local copy.

### 2e. Round 4 — read provenance (IE-F2) and extant local records (IE-F3)

**IE-F2 root cause.** `itemService.subscribeAllItems` passed `() => cb([])` as the `onSnapshot` error handler. `useItems` then stored a fresh `[]` with `loading: false`. `useLibraryReader` saw a new array after the uid change and treated it as a **known-empty** library. So with existing diagrams and a failed subscription:

- import counted every existing id as "added" and sent an inflated `itemsImported`;
- Export all showed "No diagrams to export" (or the button was disabled) instead of a read failure.

**IE-F3 root cause.** Signed out, `getExistingIds` returned the raw local index keys. The displayed and exported lists skip keys without a record. A dangling key was therefore counted as "updated" although no diagram existed.

**Fix.**

```
onSnapshot error ─► subscribeAllItems(uid, cb, onError?)      no onError: legacy cb([])
                        │ onError(err)
                        ▼
useItems ─► { items, loading, owner, error, attempt, retry() }
                        ▼
useLibraryReader.status():
   loading / owner ≠ uid / attempt from before the uid change ─► pending
   error  ─► retry() once, wait for that newer attempt ─► success: items │ error again: null
   ready  (successful read of this owner) ─► items   ([] only here = known-empty)
                        ▼
import: null ⇒ save, "N diagrams imported.", no itemsImported     export: null ⇒ "failed" + Try again, no download
```

| # | Where | Change |
|---|---|---|
| R1 | `itemService.subscribeAllItems(uid, cb, onError?)` | New optional third parameter. A snapshot error goes to `onError(error)`, not `cb([])`. Without `onError` the legacy `cb([])` stays, so other callers are unchanged. |
| R2 | `useItems()` | Still returns `items` and `loading`. Adds `owner` (uid, or `null` for local; `undefined` before the first read), `error` (set when that read failed; `items` is then `[]` for display only), `attempt` (increases on each subscription or reload) and `retry()` (re-subscribes; returns the attempt to wait for). A signed-out storage exception also becomes `error`. |
| R3 | `useLibraryReader` | Accepts the optional `owner`/`error`/`attempt`/`retry`. When `attempt` is present, only a successful read owned by the current uid, from an attempt newer than the last uid change, is ready. A read that meets an error calls `retry()` **once** and answers that retry's outcome: items on success, `null` on a second error. It never answers `[]` for an error. Without these fields the round-3 behaviour stays. |
| R4 | `useLibraryReader` signed-out reads | `readLocalLibrary()` keeps only index keys whose record exists. Existing ids come from those keys. A missing record is not an existing id, so it is counted as **added**. A record that is not an object (for example, corrupt JSON returned as a string) or a storage exception makes the whole answer `null`: import makes no exact split, and export fails rather than silently omitting the record. |
| R5 | `AppRoot` | `useLibraryReader({ ...useItems(), uid })` passes the provenance. This is a one-hunk change (§4). |

API notes:

- `attempt` is the "generation" asked for in the brief. The word `generation` is already used by the round-3 identity tokens.
- `useItems` has no readiness boolean on purpose. It does not reset its state on a uid change, so the Home list does not flash. During an A→B→A switch, `owner === uid && !loading && error == null` would therefore be true for the old A data. The reader's `staleAttempt` check is what makes readiness correct. Consumers that need readiness should use `useLibraryReader`, not derive it from `useItems`.

What stays separate:

- **Identity cancellation (round 3)** is unchanged: `LIBRARY_CANCELLED` stops every write and download.
- **A same-owner read failure** is `null` (unknown). Import still saves, with the documented unknown-count copy and no `itemsImported`. Export shows **failed + Try again**, never "empty" and never a download.
- Export all stays enabled while the library is unknown, because `libraryCount` is only published for a ready read.

### 2f. Round 5 — ownership at the File and save boundaries (IE-C1, IE-C2, IE-C3)

**IE-C1 root cause.** `readImportFile` awaited `file.text()` without capturing an identity. `runImport` captured `identity.current()` only after the read. A file chosen under A and read while the account switched to B was then imported into B, legitimately guarded for B.

**IE-C2 root cause.** `SaveItemsGuard` had only `expectedUid`. A held first local write that resumed after the owner unmounted, or after null → B → null, still matched `expectedUid: null`. The service then issued the remaining index and record writes. `runImport` noticed the stale generation only after the whole save.

**IE-C3 root cause.** `identityChanged` returns while a save is busy. If A's save then rejected normally after the switch to B, the ordinary `catch` published `saveFailed` with A's text and prepared payload. The panel focused Try again under B.

**Fix.**

```
user chooses a file (ImportExportBar / feedback picker / parent sidebar)
  readImportFile(file, onImport)
    ① binding = activeLibraryIdentity(); token = binding.current()   ◄ synchronous, before any await
    ② await file.text()
         identityChanged() while reading ─► 'cancelled' at once; this read becomes inert
         settles with token stale (switch / A→B→A / unmount) ─► 'cancelled', handler NOT called
    ③ onImport(text, { token })                 (no owner registered: onImport(text), unchanged)
  AppRoot.handleImport(text, context) ─► runImport(text, { identity, token: context?.token, … })
    ④ stale carried token ─► 'cancelled' before any read or save    (never recaptured)
    ⑤ saveItems(items, { expectedUid: token.uid, isCurrent: () => identity.isCurrent(token) })
         both are checked before every not-yet-issued write: each local record, each index add,
         and the cloud batch commit
    ⑥ settles (resolve OR normal reject) with token stale ─► 'cancelled' (writes may have
         started); no saveFailed, no Try again, no replay data, no success, no analytics
```

**Exact API (all optional and backward compatible):**

```ts
// components/library/libraryIdentity.ts
function registerLibraryIdentity(binding: IdentityBinding): () => void; // useLibraryReader registers while mounted
function activeLibraryIdentity(): IdentityBinding | null;

// components/library/importFeedbackStore.ts
interface ImportFileContext { token: OperationIdentity }
type ImportFileHandler = (text: string, context?: ImportFileContext) => void | Promise<void>;
function readImportFile(file: File, onImport: ImportFileHandler): Promise<void>;
interface RunImportDeps { …; identity?: IdentityBinding; token?: OperationIdentity | null }

// services/identityGuard.ts (re-exported by itemService)
interface SaveItemsGuard { expectedUid: string | null; isCurrent?: () => boolean }
```

- `readImportFile` calls `onImport(text)` with **one** argument when no owner is registered, and `onImport(text, { token })` when one is. Existing one-argument handlers keep working.
- `isCurrent` is optional. The parent's account flow (`useImportOnLogin`) may keep passing `{ expectedUid }` alone; that contract is unchanged. The stronger contract is `{ expectedUid, isCurrent }`: the save stops before any write it has not yet issued once the predicate turns false. Writes already issued are never recalled or rolled back.
- `ImportExportBar`, `ImportFeedback` and `LibraryFeedback` widen their `onImport` prop type to `(text, context?)`. In this checkout HomeView passes `onImport` by reference to `ImportExportBar` (`HomeView.tsx:177`, `onImport={onImport}`), so it needs no edit. This base has no `HomeSidebar`; the sidebar lives in the parent's Diagrams lane (see below).

**Exact AppRoot hunks (round 5):**

```diff
-import { runImport } from '../components/library/importFeedbackStore';
+import { runImport, type ImportFileContext } from '../components/library/importFeedbackStore';
-  async function handleImport(text: string) {
+  async function handleImport(text: string, context?: ImportFileContext) {
       identity: library.identity,
+      // Ownership captured by readImportFile before the file was read (IE-C1).
+      token: context?.token,
       saveItems: (items, guard) => itemService.saveItems(items, guard),
-          onImport={(text) => void handleImport(text)}
+          onImport={(text, context?: ImportFileContext) => void handleImport(text, context)}
```

`<LibraryFeedback onImport={handleImport} … />` already passes the function by reference.

**Parent sidebar wiring:** `await readImportFile(file, onImport)`, where `onImport` is the HomeView prop forwarded unchanged. It must not be wrapped in a one-argument lambda such as `(text) => onImport(text)`. If it is, the context is dropped: `readImportFile`'s stale check still blocks the handler, so no write is redirected, but `runImport` then captures the token at handler time instead of carrying the original one. Ownership is captured inside `readImportFile`, so the sidebar needs no identity of its own.

**Copy (ABA).** "Import interrupted" no longer says "Nothing was saved to the library shown now". After A → B → A, an A commit that was already issued may have reached the A library shown now. The panel now reads: "The account changed during the import. Some diagrams may have been saved before the change. / Check your diagrams before importing this file again." The pre-write copy "Import canceled … No diagrams were imported." is unchanged. A cancellation notice of either kind now survives later account switches until it is dismissed.

### 2g. Round 6 — nested index-write boundary (IE-C2-index)

**Root cause.** `saveItems` checked the guard and then awaited `localItems.add(id)`. `add` first awaits a read of the index (`localStore.get(items)`), then issues `localStore.set(items)` with no further check. If the attempt was invalidated during that read (owner unmounted, or null → B → null while the uid is null again), the index write was still issued. That write had not been issued yet when the attempt became stale.

**Fix (two lines of behaviour, backward compatible):**

```ts
// services/localItems.ts
export async function add(id: string, beforeWrite?: () => void): Promise<void>
//   read index ─► (id missing) beforeWrite?.()  ◄ synchronous, throws to stop ─► localStore.set(index)

// services/itemService.ts, signed-out loop
await localItems.add(id, guard ? assertIdentity : undefined);
```

```
record write (issued) ─► assertIdentity ─► add: await index read ─► assertIdentity ─► index write
                                                     ▲ invalidated here ─────────┘ throws IdentityChangedError(writesStarted: true)
```

- `assertIdentity` is the same check as before: live `uid === expectedUid` and `guard.isCurrent?.() !== false`. It throws `IdentityChangedError` with `writesStarted: true`, because the record had already been issued. The record is not rolled back. It stays unindexed, so it is not listed, and IE-F3 treats it as non-existent.
- `add(id)` with no second argument behaves exactly as before. Its other callers are unchanged: `setItem` and `useImportOnLogin`, and unguarded `saveItems` passes `undefined`.

## 3. Files (relative to 9e5cab59)

New files, all import/export-specific and owned by this task (line counts are current):

| File | Lines | Purpose |
|---|---|---|
| `web/src/services/importDiagrams.ts` | 45 | `analyzeImport`: invalid JSON vs no diagrams vs ready; unique-id merge |
| `web/src/services/importDiagrams.test.ts` | 83 | |
| `web/src/components/library/importFeedbackStore.ts` | 332 | Import store, `readImportFile`, `runImport` (settled ids, retry payload, identity-bound, never rejects), `useImportBusy`, `identityChanged` |
| `web/src/components/library/importFeedbackStore.test.ts` | 550 | |
| `web/src/components/library/exportFeedbackStore.ts` | 130 | Export store, `runExportAll` (identity-bound), `useExportBusy`, `useExportDisabled`, `EXPORT_FILE_NAME`, `identityChanged` |
| `web/src/components/library/exportFeedbackStore.test.ts` | 154 | |
| `web/src/components/library/libraryIdentity.ts` | 43 | Round 3: `OperationIdentity`, `IdentityBinding`, `LIBRARY_CANCELLED`. Round 5: `registerLibraryIdentity`, `activeLibraryIdentity` |
| `web/src/components/library/useLibraryReader.ts` | 204 | Settled library for ids and items, bound to an identity generation; read provenance and one retry (round 4); extant local records only (round 4); publishes the library size; notifies the stores on an account change |
| `web/src/components/library/useLibraryReader.test.tsx` | 251 | |
| `web/src/components/library/ImportFeedback.tsx` | 290 | Import panel, copy (incl. cancelled), announcement, `LiveRegions` |
| `web/src/components/library/ImportFeedback.test.tsx` | 358 | Includes the sidebar contract tests |
| `web/src/components/library/ExportFeedback.tsx` | 217 | Export panel: five states and outlined status icons |
| `web/src/components/library/ExportFeedback.test.tsx` | 164 | |
| `web/src/services/identityGuard.ts` | 26 | Round 3: `SaveItemsGuard`, `IdentityChangedError` (no Firebase imports, so stores and mocks stay light) |
| `web/src/components/library/LibraryFeedback.tsx` | 30 | App-level host: one portal, stacked panels, shared live regions |
| `web/src/components/library/importFeedback.css` | 246 | Scoped `.library-feedback-stack` / `.import-feedback*`; only shared `--editor-*` tokens |

Modified files:

| File | Change |
|---|---|
| `web/src/components/library/ImportExportBar.tsx` | Import uses `readImportFile` and `useImportBusy`. Export all gets busy, empty-disabled and reason states. The props `onImport(text)` / `onExportAll()` are unchanged, and the original 4 tests pass unmodified. |
| `web/src/app/AppRoot.tsx` | Integration hunks only (§4) |
| `web/src/app/AppRoot.test.tsx` | Import/export tests and a store reset (§4) |
| `web/src/services/itemService.ts` | Round 3: optional `guard` parameter on `saveItems` (G7) and the re-export of `IdentityChangedError` / `SaveItemsGuard`. Round 4: optional `onError` on `subscribeAllItems` (R1). No other function changed. |
| `web/src/services/itemService.test.ts` | Round 3: 6 guard tests appended. Round 4: 2 `subscribeAllItems` error-channel tests. |
| `web/src/hooks/useItems.ts` | Round 4: `owner`, `error`, `attempt`, `retry()` added to the return value (R2). `items`/`loading` keep their meaning. |
| `web/src/hooks/useItems.test.tsx` | Round 4: 4 provenance tests appended |

## 4. Integration hunks

The AppRoot, itemService and useItems hunks are exported to `/Users/pengxiao/.codex/import-feedback-handoff/import-integration.patch` (920 lines, round 4; includes the test hunks). Earlier versions are kept as `import-integration.round2.patch` and `import-integration.round3.patch`.

Round-4 AppRoot hunk: `const itemsState = useItems(); const { items } = itemsState; const library = useLibraryReader({ ...itemsState, uid: user?.uid ?? null });`. The parent integrates the AppRoot unions and the narrow-screen sidebar.

`web/src/app/AppRoot.tsx` has 8 hunks, all import/export-only. No HomeView appearance/delete props changed, and no Editor UI was added.

| Hunk | Change |
|---|---|
| `@@ -44` | `exportImport` import drops `parseImportJson` and `exportAllItemsJson` (now inside the stores) |
| `@@ -45,0 +46,4` | Imports `runImport`, `runExportAll`, `LibraryFeedback`, `useLibraryReader` |
| `@@ -214` | Round 4: `const itemsState = useItems(); const { items } = itemsState;` plus `const library = useLibraryReader({ ...itemsState, uid: user?.uid ?? null });` |
| `@@ -382,2` | Removes the `importError` state |
| `@@ -830,6` | `handleExportAll` → `return runExportAll({ identity: library.identity, getItems: library.getLibraryItems, download: downloadText(…), onStart: track('exportItems', { category: 'fn' }) })` |
| `@@ -845,25` | Round 5: `async function handleImport(text: string, context?: ImportFileContext)` → `await runImport(text, { existingIds: library.getExistingIds, identity: library.identity, token: context?.token, saveItems: (items, guard) => itemService.saveItems(items, guard), onItemsAdded: track('itemsImported', …) })`. The import line adds `type ImportFileContext`. |
| `@@ -990,9 +989` | Home branch: raw-error "Import failed" `ConfirmDialog` → `<LibraryFeedback onImport={handleImport} onExportAll={handleExportAll} />` |
| `@@ -1122,10` | Editor branch: removes the raw-error "Import failed" `ConfirmDialog` |

The HomeView prop is now `onImport={(text, context?: ImportFileContext) => void handleImport(text, context)}`; `onExportAll={handleExportAll}` is unchanged. HomeView's own prop type `onImport?(text: string): void` is not edited. The exact round-5 diff is in §2f.

Changes to `web/src/app/AppRoot.test.tsx`:

- **Existing test updated:** the raw `'Bad JSON at line 1'` modal test now asserts the nonmodal invalid-file feedback.
- **New import/export tests:**
  - success only after save
  - save failure
  - `itemsImported` counts unique ids
  - cold-load import (round 2)
  - cold-load Export all (round 2)
  - round 3: account switch while an import waits (no `saveItems`, `cancelled`, no `itemsImported`); import passes `{ expectedUid }`; Export all started under A never downloads B's library (`URL.createObjectURL` not called)
- **Top-level `beforeEach`:** resets both feedback stores.
- **Imports:** the two store imports.

## 5. Validation (actual results)

### Round 6 (nested index write) — tests, typecheck

No browsers, full suites or emulators were run. Cache: `/tmp/import-feedback-vt/vite-cache-r3`.

1. **Failing first.** In `itemService.test.ts`, describe "nested index-write boundary (IE-C2-index)": 3 tests failed against the round-5 source with `expected 1 to be +0`, meaning one index write was issued after invalidation:
   - **service:** first record written, index read held, `isCurrent` turns false while uid stays null (owner unmounted), read released. Expected: `IdentityChangedError` with `writesStarted: true`, 0 index writes, record `b` never written, `localItems.list()` empty.
   - **`runImport` + real `saveItems`:** null → B → null during the held index read. Expected: 0 index writes, no `b`, phase `cancelled` with `writesMayHaveStarted: true` and `prepared: null`, `onItemsAdded` not called.
   - **`runImport` + real `saveItems` + a real `useLibraryReader`** that unmounts during the held index read: 0 index writes, `cancelled`, no analytics.
2. **Compatibility guard** (passed before and after): "matching attempt and legacy callers still index every record". It covers a guarded matching save, an unguarded save, and a direct `localItems.add('p')`.
3. **Test hygiene:** spies are restored in `afterEach`. My first run left spies in place after a failed assertion, which caused a `Maximum call stack size exceeded` in the next test.
4. **Results:**

   | Suite | Passed |
   |---|---|
   | `src/services` | 100 |
   | `src/components/library` | 157 |
   | `useItems.test.tsx` | 11 |
   | `useImportOnLogin.test.tsx` | 7 |
   | `AppRoot.test.tsx` | 82 |

   `npx tsc --noEmit -p .` reported 0 errors. No build was run this round (not requested).
5. **Processes:** `:4411` (pid 63418) and `:4442` (pid 85038) were still listening. No process was started or stopped.
6. **Patch:** `import-integration.patch` (1211 lines) now also includes `localItems.ts`. The round-5 patch is kept as `import-integration.round5.patch`.

### Round 5 (File and save boundaries) — tests, typecheck, build

Browser, E2E and full suites were not run, and no servers were started, as instructed. The cache was private: `/tmp/import-feedback-vt/vite-cache-r3`.

1. **Failing first.**
   - `importFeedbackStore.test.ts`: the new suite failed to load before `registerLibraryIdentity` and `ImportFileContext` existed.
   - `itemService.test.ts`: 3 new tests failed: held first write → invalidated → settled; batch built → invalidated; the real-seam `runImport` + `saveItems` with null → B → null.
   - `ImportFeedback.test.tsx`: the ABA copy assertion failed.
   - **Pre-fix proof.** I copied the frozen `import-corrected` `importFeedbackStore.ts` back temporarily. Then **13** IE-C1/IE-C3 controller tests failed, and the AppRoot "file chosen under A, account switches to B while the file is read" test failed. Each time I restored the fixed file and verified it with `cmp`. The 2 tests that passed on the old file are the deliberate compatibility guards: the legacy one-argument handler call, and the same-generation retry with identical prepared item/page ids.
   - The AppRoot "A cloud commit already issued, A → B → A" service-seam test passed before the change: the post-save generation check already blocked success. It stays as a regression guard; the copy fix is covered by the `ImportFeedback` test.
2. **Required scenarios.**

   | Scenario | Test(s) |
   |---|---|
   | `readImportFile` with a deferred `File.text`: A→B, A→signed out, A→B→A, each resolving and rejecting | store "{switch}, then the read {resolves/rejects}: no handler, cancelled, nothing replayable, not busy" (6 tests) |
   | Owner unmount before resolve/reject | store "owner unmount before the read settles" (real `useLibraryReader`, both outcomes) |
   | A fresh current-owner choice works; the stale read stays inert | store "a fresh choice for the new owner works…" (handler receives `{ token: { uid: 'B', generation: 2 } }`) |
   | The original token reaches the save | store "carries the ORIGINAL token through the controller contract…" (`expectedUid: 'A'`; `isCurrent` follows the token: false after A → A' generation); store "runImport never recaptures"; AppRoot file-entry test (deferred `File.prototype.text`, A→B, no `saveItems`, no `itemsImported`) |
   | IE-C2: held first local write, then unmount or null→B→null | itemService "first local write held, attempt invalidated…" (no index add, no b/c records); itemService real-seam `runImport` + real `saveItems` (`cancelled`, `writesMayHaveStarted: true`, no analytics) |
   | IE-C2: cloud | itemService "attempt invalidated while the batch is built → no commit"; "A cloud commit already issued, A → B → A" (no success or analytics; interrupted) |
   | IE-C2: compatible callers | itemService "expectedUid alone keeps the round-3 behaviour"; the existing unguarded and matching-owner tests |
   | IE-C3: late normal rejection after A→B, A→B→A, unmount | store "late ordinary rejection stays inert" (3 tests: `cancelled`, `prepared`/`text` null, no analytics; `cancelled` panels never focus and have no Try again) |
   | Same-generation retry keeps exact ids and counts | store "same generation: a normal rejection still offers Try again with the same prepared payload" |
   | IE-F2/IE-F3 regressions | all round-4 tests, unchanged and green |

3. **Test changes to existing assertions.**
   - Round-3 "passes the starting identity to saveItems as the bound guard" and the AppRoot guard assertion now also require `isCurrent: Function`. They are stricter, not weaker.
   - The round-3 `ImportFeedback` "after writes may have started" test now asserts the **absence** of the false ABA claim and the new detail line.
4. **Results** (sequential):
   - `src/components/library`: 157 passed;
   - `src/services`: 96 passed;
   - `useItems.test.tsx`: 11 passed;
   - `AppRoot.test.tsx`: 82 passed.
5. **Typecheck:** `npx tsc --noEmit -p .` exited 0.
6. **Build:** `npx vite build --outDir /tmp/import-feedback-vt/build-r5` exited 0 (`BUILD=0`, rerun with the exit code captured).
7. `:4411` was still listening (pid 63418). No other process was touched.
8. **Patch:** `import-integration.patch` (1082 lines). The round-4 patch is kept as `import-integration.round4.patch`.

### Round 4 (read provenance) — tests, typecheck, build

Browser and E2E were not run, as instructed.

1. **Failing first:**
   - `itemService.test.ts`: "with onError: a snapshot error reaches onError…" failed (the legacy `cb([])` ran).
   - `useItems.test.tsx`: 4 provenance tests failed (no `owner`/`error`/`retry`).
   - `useLibraryReader.test.tsx`: 5 failed. Errors were answered as `[]`, there was no retry, a dangling key counted as existing, and an unreadable record was not reported.
   - `AppRoot.test.tsx`, at the real seam (the mocked service calls the `onError` argument): all 4 failed.
     - The import with a known existing id never finished: the read waited, because the error reached nothing.
     - Export all was `aria-disabled` as an empty library.
     - The retry import got no truthful counts.
     - The signed-out case showed "2 diagrams updated." for one valid record plus one dangling key.
2. **Spec change to one existing test.** The round-2 test "reads existing ids from the local storage index" seeded index keys **without records**, which is exactly the IE-F3 defect. It now also seeds the two records; its assertion is unchanged. The dangling-key and unreadable-record cases have their own tests.
3. **Required scenarios:**

   | Scenario | Test(s) |
   |---|---|
   | Known existing ids + subscription failure: no exact counts, no added analytics | AppRoot "subscription failure: importing a known existing id…" (panel "1 diagram imported.", no added/updated, `itemsImported` undefined); reader "subscription error for the owner: ids and items are null" |
   | Export failure + retry, no download | AppRoot "subscription failure: Export all fails with Try again…" (not disabled, `failed`, `URL.createObjectURL` not called; Try again leads to a successful snapshot, `started`, "2 diagrams included.", one download) |
   | Successful empty snapshot alone gives empty | reader "only a successful snapshot establishes known-empty"; useItems "a successful empty snapshot is known-empty" |
   | Later successful retry gives truthful counts | AppRoot "subscription failure then a successful retry…" ("1 diagram added. 1 diagram updated.", label `'1'`); reader "a read during an error retries once…"; useItems "retry() re-subscribes…" |
   | Retry fails again | reader "the retried subscription fails again: unknown (null), no further retry loop" |
   | Local valid record + dangling key gives 1 updated + 1 added | AppRoot "signed out: one valid record + one dangling key…" (label `'1'`); reader "a dangling index key is not an existing id" |
   | Unreadable local record | reader "an unreadable record makes ids unknown (null) and export unreadable (null)" |
   | Identity cancellation still holds (A→B, sign-out, A→B→A, unmount, multi-item save) | all round-3 tests, unchanged and green |

4. **Results**, each run sequentially through the wrapper config with private cache `/tmp/import-feedback-vt/vite-cache-r3`:
   - `src/hooks`: 104 passed;
   - `src/components/library`: 142 passed;
   - `src/services`: 91 passed;
   - `AppRoot.test.tsx`: 81 passed;
   - `components/home` + `AppRoot.editorWiring` + `AskToImportModal`: 7 passed.
   - An earlier single run of hooks + library + services together had 6 failures at about 5 s. All were 5 s timeouts under parallel load, in tests unrelated to the change (useItems reactivity, LibraryPanel, FolderList, ImportFeedback). All passed in the sequential runs above.
5. **Typecheck:** `npx tsc --noEmit -p .` exited 0.
6. **Build:** `npx vite build --outDir /tmp/import-feedback-vt/build-r4` exited 0.
7. `:4411` was still listening (pid 63418). Round 4 started no servers or browsers.

### Round 3 (identity cancellation) — tests, typecheck, build

Browser and E2E suites were **not** run in round 3, as instructed. The parent runs the combined UI checks after the freeze. Round-2 screenshots do not show the new `cancelled` panels.

1. **Failing first:**
   - `useLibraryReader.test.tsx`: the suite failed to load (`Failed to resolve import "./libraryIdentity"`) before the implementation.
   - `itemService.test.ts`: 3 guard tests failed before the guard existed.
   - `ImportFeedback.test.tsx` / `ExportFeedback.test.tsx`: the 3 cancelled-panel tests failed before the copy existed.
   - AppRoot switch tests: I temporarily copied the frozen round-2 `useLibraryReader.ts` back. The import-switch and export-switch tests then **failed** (A's import saved; B's library downloaded). I restored the fixed file and verified it with `cmp`. With the fix both pass.
   - The `importFeedbackStore` / `exportFeedbackStore` identity tests were written before the implementation; they could not load until `libraryIdentity.ts` existed.
2. **Discriminating coverage** for the review's list:

   | Required scenario | Test(s) |
   |---|---|
   | deferred A read → B ready | reader "deferred A read → B becomes ready"; store "A read pending → switch to B"; AppRoot "account switch while an import waits"; export store "library arrives after switching to B" |
   | A → sign out | reader "deferred A read → sign out"; itemService "A → signed out: never falls into the local signed-out path" (no local record, empty index) |
   | A → B → A generation | reader "A → B → A: a read from the first A generation stays cancelled" |
   | unmount | reader "unmount mid-read" |
   | failed prepared retry → switch | store "failed prepared retry → account switch → Try again cannot replay"; store `identityChanged()` test; reader "account switch drops a failed import retry" |
   | switch during a multi-item save | itemService "signed-out multi-item save stops at the first write after sign-in" (b, c not written; no batch); itemService "switch while the batch is being built → no commit"; store "switch during a multi-item save (guard throws)"; store "save resolves but identity changed meanwhile" |
   | no B/local writes for an A operation, no false success analytics | the itemService guard tests; `onItemsAdded` not called in every store switch test; AppRoot `itemsImported` undefined |
   | Export all current-identity contract | export store tests (token passed, `LIBRARY_CANCELLED`, switch); AppRoot "Export all started under A never downloads B's library"; `ExportFeedback` cancelled panel |

3. **Results** (wrapper config with a unique cache dir, `cacheDir: /tmp/import-feedback-vt/vite-cache-r3`):
   - `src/components/library` + `src/services`: **20 files, 224 tests passed**.
   - `AppRoot.test.tsx`: **77 passed**, run twice on its own.
   - Related suites from the round-2 baseline (library, services, `AppRoot.editorWiring`, `src/hooks` incl. `useImportOnLogin` and `useItems`, `components/home`): 33 files, 327 passed and 1 failed. The failure was the editorWiring test "threads settings-driven themeId/fontSize/keymap/fontFamily into BOTH editors" at 5.09 s, just over the 5 s timeout under parallel load. Run alone with `AskToImportModal.test.tsx`: **2 files, 5 passed**.
   - An earlier combined run (library + services + AppRoot + `components/home`) had one similar timeout: "resumes the deferred Paddle checkout once the anonymous user signs in" (6.97 s). It passed in both isolated `AppRoot.test.tsx` runs. Neither timed-out test touches import/export code.
4. **Typecheck:** `npx tsc --noEmit -p .` exited 0.
5. **Build:** `npx vite build --outDir /tmp/import-feedback-vt/build-r3` exited 0. The only output was the existing chunk-size warning.
6. **Not run:** browser/E2E (deferred to the parent), ESLint (no config for `web/`), the full Editor suite.
7. **Cache note:** round-3 runs before the `cacheDir` change used Vite's default `node_modules/.vite`, which resolves into the symlinked editor-core checkout's `node_modules`. That is a test-result cache only; no source files there were touched.

### Unit and integration tests (Vitest), round 2

1. **Failing first:**
   - **Round 1:** 4 AppRoot tests failed against the base `AppRoot.tsx`: malformed-file feedback, success-after-save, save failure, and unique-id label (`expected '2' to be '1'`).
   - **Round 2, cold-load import:** I put back the first-round wiring (`existingIds: items.map(i => i.id)`). The test then failed with `Received: Import complete existing.json 1 diagram added.`. It also fails against base. With the fix it passes.
   - **Round 2, cold-load Export all:** fails against base and passes now.
   - **Round 2, new unit tests:** 6 failed before the implementation (async ids, unknown counts, rejecting lookup, throwing analytics, throwing/rejecting handler). Three new suites failed to load because their modules did not exist yet.
   - Every swap of `AppRoot.tsx` was restored and verified with `cmp`.
2. **Owned suites, with the default config:** `npx vitest run src/components/library src/services/importDiagrams.test.ts src/services/exportImport.test.ts src/services/itemService.test.ts`. Result: **12 files, 143 tests passed**.
3. **Related suites:** library, services, `AppRoot.test.tsx`, `AppRoot.editorWiring.test.tsx`, `components/home`, `useImportOnLogin`, `useItems`, `AskToImportModal`. Result: **26 files, 288 tests passed**, with no unhandled-rejection reports.
   - Environment note: `web/node_modules` is a symlink into the editor-core checkout, so `AppRoot.test.tsx` cannot load under the repo config (`Denied ID …zenuml-server.worker.js?url`).
   - These suites were run with the out-of-repo wrapper `/tmp/import-feedback-vt/vitest.local.config.ts`, which only widens `server.fs.allow`. Nothing was added to the repo.
4. **Typecheck:** `npx tsc --noEmit` exited 0.
5. **Build:** `npx vite build --outDir /tmp/import-feedback-vt/dist` exited 0. The only output was the existing chunk-size warning.
6. **Not run:**
   - ESLint: `web/` has no ESLint config.
   - The full Editor unit suite.
   - The web/e2e and root e2e Playwright suites.
   - WebKit/Safari.

### Real browser (Playwright Chromium; desktop 1440×900 and narrow 390×844, light and dark)

Setup:

- Round-2 runs used my dev server on :4418, started with the wrapper config. It served the current source.
- Dark mode was set through the real Editor header toggle.
- Fixtures were local, in `/tmp/import-feedback-vt/fixtures/`.

**Import** (`/tmp/import-feedback-vt/browser-check.mjs`):

- Each run passed through success ("2 diagrams added. 1 diagram updated."), invalid JSON, empty file, save failure followed by Try again, read failure, and Choose another file.
- All states fit the viewport: no overflow, no overlap with the "Report a bug" button, and 36 px actions.
- Minimum text contrast was 4.62:1, which is the design's own white-on-blue button.
- The live regions held the expected text.
- There were 0 page errors in all four runs.

**Export** (`/tmp/import-feedback-vt/export-check.mjs`):

- **Empty library:** Export all has `aria-disabled="true"` with the description "No diagrams to export". Clicking it shows the empty panel. After an import, the button is enabled again.
- **Download:** a real browser download event, `suggestedFilename = zenuml-diagrams.json`. The saved file contains exactly `["fx-a","fx-b"]`. The panel says "2 diagrams included."
- **Double click** right after the download started: **0 extra downloads**.
- **Failure, then Try again:** a second real download.
- **Preparing:** the button had `aria-busy` + `aria-disabled`.
- All panels fit the viewport, with no overflow, no overlap with "Report a bug", and 36 px actions.
- Minimum text contrast was 4.62:1, and there were 0 page errors.

**Labelled mocks:**

- Save failure: `Storage.setItem` throws `QuotaExceededError` for ids `savefail-*`.
- Read failure: `Blob.prototype.text` rejects.
- Download failure: `URL.createObjectURL` throws.
- **Preparing screenshot:** the store state was injected through the dev-server module (`setState({ phase: 'preparing', total: 2 })`). Real local preparation finishes in under 400 ms, so that panel correctly never appears.
- At 390 px the base HomeView hides the toolbar. The hidden input was driven with `setInputFiles`, and the hidden Export all button was clicked through `element.click()`.

**Screenshots** (`/Users/pengxiao/.codex/import-feedback-handoff/screenshots/`, 32 PNG + 2 JSON metric files):

- Import: `desktop1440-{light,dark}-{success,invalid,save-failed,read-failed}.png`, `narrow390-{light,dark}-{success,invalid,save-failed}.png`, `desktop1440-light-{invalid-empty,retry-success}.png`
- Export: `export-{desktop1440,narrow390}-{light,dark}-{empty,started,failed,preparing}.png`
- Metrics: `browser-check-results.json`, `export-check-results.json`

## 6. Remaining limitations

1. **Base Home view:** on this base, the Home view is still the dark "Drafting Table" chrome. In light appearance, the light panels therefore sit on a dark page. The panels follow `data-appearance` as the design requires.
2. **Narrow screens and HomeSidebar:**
   - At 390 px the current HomeView hides the toolbar. Reachable controls there depend on the Diagrams layout.
   - Until the parent wires `HomeSidebar` to `readImportFile` (§2b), sidebar imports run through `runImport` without a filename, with no busy styling on the sidebar button, and an unhandled rejection is still possible on a file-read error inside the sidebar's own `file.text()`.
3. **Signed-in waits:**
   - If the Firestore snapshot never arrives within 15 s, an import reports "N diagrams imported." with no split and no analytics, and an export fails with Try again.
   - The ready check relies on `useItems` replacing the array once the snapshot arrives. It does not detect a snapshot that never comes.
4. **Partial saves:** a failed signed-out save may be partial. The panel makes no count claim. Retry counts stay relative to the library before the first attempt.
5. **Download truth:** "Download started" means the browser accepted the file. The app cannot confirm it reached disk, and the copy does not claim that.
6. **Escape scope:** Escape dismisses a panel only while focus is inside it. Success panels never take focus. The panels come last in the tab order.
7. **Not run:** ESLint (no config), the e2e suites, the full Editor suite, and Safari/WebKit.
8. **Identity cancellation limits (round 3):**
   - A Firestore `batch.commit()` that was already sent when the account changes cannot be recalled. It completes for the bound account A (its documents carry `createdBy: A` and `users/A`), never for B. The panel then says "Some diagrams may have been saved before the change"; it never claims a rollback.
   - Signed-out per-item writes made before the switch stay in local storage. Nothing is removed.
   - The `exportItems` analytics event is still sent when an export **starts** (legacy "attempt" semantics). A cancelled export has already sent it. `itemsImported` (the success event) is never sent for a cancelled import.
   - The reader sees the new uid on the next React render. `saveItems`' guard reads the live auth store, so a switch between that store update and the render is still caught by G7.
   - A failed attempt prepared without an identity binding cannot be retried once a binding is passed; it is cancelled instead. AppRoot always passes the binding, so this does not happen in the app.
   - `useImportOnLogin` is not guarded yet (parent wiring, §2d).
   - ~~`readImportFile` is not identity-bound during `await file.text()`.~~ Fixed in round 5 (§2f).
   - The AppRoot export-switch test passes through the reader's default token, so it would also pass if `identity: library.identity` were removed from `handleExportAll`. That wiring is pinned by the store tests, not by the AppRoot test. The import wiring is pinned by the AppRoot `{ expectedUid }` assertion.
9. **Read provenance limits (round 4):**
   - The Home grid and other `useItems` consumers still receive `items: []` on a read error. Showing an error state there is a Home/layout change and is outside this task. The new `error` field is available to them.
   - Each read retries a failed subscription **once**. Firestore keeps no listener after an error; the next re-subscription happens on the next import, Export all, Try again, or uid change.
   - Export all fails when any local record is unreadable, so it never produces a silently incomplete backup. A corrupt record therefore blocks Export all until it is removed.
   - The 15 s wait still answers `null` (unknown) if no read settles.
   - `useItems`' signed-out display list still keeps any non-null record, including a corrupt string; only the reader rejects it.
   - `useImportOnLogin` (account-flow hook, parent-owned, not edited) still counts raw index keys for its "N local diagrams" offer (`useImportOnLogin.ts:32–36`). A dangling key inflates that count. Its `doImport` already skips missing records.
10. **File and save boundary limits (round 5):**
   - Ownership is captured from the binding that `useLibraryReader` registers while it is mounted. A `readImportFile` call made while no owner is mounted keeps the legacy, unbound behaviour (one-argument handler call).
   - Only one owner can be registered. A second mounted `useLibraryReader` takes over the registration; AppRoot mounts exactly one.
   - A held local record write that was already issued still completes. Its index entry is never written, so the record stays unindexed: it is not listed, and IE-F3 treats it as non-existent. Nothing is rolled back.
   - An A cloud commit that was already sent completes for A. After A → B → A it may appear in the A library shown now; the copy states only that some diagrams may have been saved.
   - While a save is in flight, an account switch leaves the panel busy ("Importing…") until that save settles, then shows "Import interrupted". New imports are blocked during that window, so attempts never overlap.
11. **Nested index boundary (round 6):** a record write that was already issued completes and stays unindexed (not listed). An index write that was already issued when the attempt goes stale also completes. Only writes not yet issued are stopped. No other `localItems` helper (`remove`) takes a guard; the import save path does not use it.
