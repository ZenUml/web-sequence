# Shared-link visitor loading & recoverable-failure states — implementation report

Worktree: `/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence`
Branch: `codex/share-visitor-status` · HEAD = BASE.json snapshot `6b9c2f029fdf0ff4ab3ba90b89aed1293da12c06`
Status: uncommitted working-tree changes only. No commit, push, merge, deploy or Figma edit.

## 1. What changed (behaviour)

```
 /?id=X&share-token=T  (full app, not embed)
          │
          ▼
  useBootItem ── shareStatus ──┬─ loading ─────────► ShareVisitorStatus (spinner + source skeleton)
          │                    ├─ retryable-error ─► ShareVisitorStatus (Couldn't load… + Try again)
          │   retryShare() ◄───┘         │ click / Enter
          │                              ▼ fresh GET /get-shared-item?id=X&share-token=T
          │                    ├─ unavailable ─────► existing ShareErrorNotice (unchanged)
          │                    └─ loaded ──────────► existing read-only Editor (original title)
          ▼
  getSharedItem ── rejects with SharedItemError{status} ── classify:
        400/401/403/404/410 → unavailable ; 5xx, 429, network, bad JSON, untyped → retryable
```

- **Before:** every shared-read failure became `shareError` → "This shared link can't be opened"; while pending, `AppRoot` returned `null` (blank page).
- **After:** a pending read shows a loading view. A temporary or unknown failure shows a retry view. Only an explicit backend refusal (400/403/404, plus 401/410 if they ever appear) shows the existing unavailable-link notice.
- Try again sends a new request with the current id/token. It shows loading again and cannot stack duplicate requests. A late or out-of-order completion is dropped when any of these is true: the hook unmounted, the visitor left the share URL (for example via the Diagrams breadcrumb), a newer attempt exists, or another item is already open.
- Success loads the server item with `isReadOnly: true` through the existing `loadItem`. Source, CSS, mode and pages are kept, and the existing visitor Editor shows the original title with the "Read-only" save state.
- No blank editable diagram is created for a shared visitor on any failure. This includes the outer `.catch`, which used to call `newItem()`.
- Not changed: local/owned `?id=`, `?code=`, last-code, fresh start, embed-by-value (`skip`), shared embed, the auth-ready gate, sign-in behaviour, and the backend.

## 2. Files (exact diff relative to BASE.json snapshot `6b9c2f02`)

`git diff 6b9c2f02 --numstat` (tracked) — 6 files, +646 / −16:

| File | Δ | Purpose |
|---|---|---|
| `web/src/hooks/useBootItem.ts` | +123 / −11 | `ShareStatus` + `retryShare`; request sequencing; `share-error` gains `failure` |
| `web/src/hooks/useBootItem.test.tsx` | +284 / −1 | resolver classification + 17 visitor-status hook tests |
| `web/src/services/cloudFunctions.ts` | +16 / −3 | `getSharedItem` throws `SharedItemError` with HTTP status |
| `web/src/services/cloudFunctions.test.ts` | +40 / −0 | status → classification table, network, non-JSON |
| `web/src/app/AppRoot.tsx` | +42 / −1 | **shared integration hunks (below)** |
| `web/src/app/AppRoot.test.tsx` | +141 / −0 | 8 AppRoot visitor tests |

New, untracked (617 lines):

| File | Purpose |
|---|---|
| `web/src/services/sharedItemError.ts` (36) | `SharedItemError` + `classifySharedItemFailure` (provenance) |
| `web/src/components/share/ShareVisitorStatus.tsx` (273) | loading / retryable-failure view |
| `web/src/components/share/ShareVisitorStatus.css` (202) | scoped `.share-visitor` styles, only `--editor-*` tokens |
| `web/src/components/share/ShareVisitorStatus.test.tsx` (106) | 9 component tests |

Other untracked files: this report and `share-status-screenshots/` (screenshots, `results.json`, and `repro/` holding `browser.mjs`, the wrapper `vitest.config.mts` and `root-e2e.log`). `node_modules` and `web/node_modules` are the pre-existing symlinks from dispatch.

Not touched: `globals.css`, `AppHeader`, `AppMenu`, `CodeEditor`, `CssPanel`, renderer/preview, Settings, login, hub/library/card/import/export, share-creation dialogs, `ShareErrorNotice`, `functions/` backend, `firestore.rules`.

### 2.1 Shared integration hunks in `web/src/app/AppRoot.tsx` (for merge with the core and appearance workers)

1. `@@ -43,0 +44 @@` — import line: `import { ShareVisitorStatus } from '../components/share/ShareVisitorStatus';`
2. `@@ -439 +440 @@` — boot-hook destructuring only:
   `const { shareError, clearShareError, shareStatus, retryShare } = useBootItem({` (arguments unchanged)
3. `@@ -1079,0 +1081,40 @@` — inside the existing `if (!item) {` guard, before `return shareError ? <ShareErrorNotice…/> : null`: when `shareStatus` is `loading` or `retryable-error`, return `<ShareVisitorStatus …/>`. It reuses values that are already in scope (`settings.appearance`/`handleSettingChange`, `goHome`, `user`, `logout`, `login`, `loginModalOpen`, `subscribed`, `planType`, `editorCollapsed`/`toggleEditorCollapsed`/`isMobile`, `ReportBugButton`). Profile billing items are off in this view (`paymentEnabled: false`) because `PricingModal` is mounted only with the editor or hub, so Upgrade/Manage plan would do nothing here. The embed branch, hub branch and editor render are byte-identical to the base.

### 2.2 Error-provenance change (client only)

`getSharedItem` used `throw new Error(msg)`, which dropped the HTTP status. It now throws `SharedItemError(message, status|null)`. `message` is still the server `error` string, so the existing `/Sharing disabled/` assertion passes. The UI never renders it. Network rejection and non-JSON 200 bodies are wrapped with `status: null`, so they are retryable. Token validation stays server-side and is unchanged. Classification uses only the numeric status, never message text.

### 2.3 Changed existing test contracts (equivalent, not weakened)

- `useBootItem.test.tsx` "on share-error: does NOT seed an item and exposes shareError=true": the thrown error changed from an untyped `Error('not found')` to `SharedItemError('Item not found', 404)`. The test still asserts the same thing: a dead link gives `shareError === true` and no seeded item. An untyped error is now retryable by requirement, and a new test covers that case.
- Resolver `share-error` result now has `failure`. The existing `kind === 'share-error'` assertion is unchanged.
- Analytics: `landed_in_editor` still fires once per boot with label `share-error` for any initial failure, as before. A successful retry does not fire it again. A completion that is dropped as stale (unmount or navigation) does not fire it. No new events. Report-a-bug from the status view uses label/view `shared-link`, not `editor`.

## 3. Design mapping (Figma 36:8669 / 36:8736 / 36:8803 / 36:8870)

- Geometry measured in the browser at 1440: header 56px; source content x24–368 (same split as the Editor: `26.8% − 6px` plus a 12px gutter); floating panel x392–1428, y68–948, radius 14; content block starts about 35% down the panel. Heading 20/24 semibold, guidance 14/17, 36px icon, Try again 36px primary.
- Light: page `--editor-bg` #EFF6FB, panel #FFFFFF. Dark: page #303944, **panel #343F4B** (measured `rgb(52, 63, 75)` in the browser), plus a 1px `--editor-border` ring as in the dark frames. All text and icons use `--editor-text` / `--editor-text-secondary`. No white block in dark.
- Header reuses the Editor header classes with the current accepted style (not the older Figma header): brand logo, code-pane toggle (desktop), `Diagrams /` breadcrumb, static title (`Loading diagram…` → `Shared link` on failure → the real title after success), appearance toggle, Sign in / profile menu. There is no Fork/Share/Present, editable title, save state, page tabs or zoom while pending.
- The brand logo is static, with no ▾ app menu: `AppMenu` always offers New/Save, which would suggest editable data exists. `AppMenu` is shared header code and outside this scope.
- Mobile (<768): single column; the source column is hidden, the panel goes full-bleed (the Editor's mobile rules), and the dark ring is removed. No horizontal overflow at 390.
- Spinner: CSS rotation, stopped under `prefers-reduced-motion`. No percent and no forced delay.

## 4. Accessibility

- Loading: `role="status"` region ("Loading diagram… Fetching the shared diagram and its source."), and `aria-busy` on `<main>`. The skeleton is `aria-hidden`.
- Failure: `role="alert"` ("Couldn't load this diagram. Check your connection and try again.").
- Try again is a native `<button>` that works with Enter and Space. On click, focus moves to the status panel (`tabIndex=-1`) before the button unmounts. If the retry fails again, focus returns to Try again. The first failure does not move focus.
- No raw errors, HTTP codes, ids or tokens appear in the UI (checked in the browser).

## 5. Validation actually run

| Check | Command | Result |
|---|---|---|
| Baseline before edits | `vitest run` hook/AppRoot/editorWiring/cloudFunctions | 4 files, 105 passed |
| New tests red first | same + new tests before implementation | cloudFunctions 8 failed; hook 22 failed; AppRoot 6 failed (2 base-behaviour tests passed) |
| Focused after | hook + AppRoot + editorWiring + cloudFunctions + `components/share` | 7 files, **170 passed** |
| Full unit suite | `vitest run` (all of `web/src`) | **111 files, 1167 passed, 1 skipped** |
| Typecheck | `tsc --noEmit` | clean (no output) |
| Build | `vite build` | built OK (existing >500 kB chunk warning only) |
| Lint | `eslint <changed files>` | **not run successfully**: ESLint 10.4.1 reports "ESLint couldn't find an eslint.config.(js\|mjs\|cjs) file". `git ls-files web \| grep -i eslint` returns nothing, so no flat config is tracked at this commit |
| Browser, production build | `node share-status-screenshots/repro/browser.mjs` vs `vite preview` :4398 (rerun after the final edit) | **81/81 checks passed** |
| Browser, dev (React StrictMode) | same script vs `vite` dev :4397 | **81/81 checks passed** |
| Root E2E gate regression | `PW_BASE_URL=http://localhost:4397 PW_PREVIEW_PORT=4398 npx playwright test --workers=4` | **63 passed, 32 skipped, 0 failed** (§5.2) |
| Emulator cloud E2E | `yarn test:e2e:cloud` | **NOT run** (needs the Firebase emulator). Its share contract (`cloud.spec.js:304–338` expects `[data-testid="share-error"]` for revoked and nonexistent links) is covered by the 403/404 → unavailable mapping, the `cloudFunctions.test.ts` status table, and the hook/AppRoot `unavailable` tests |

Vitest was run with an out-of-tree wrapper config (copy: `share-status-screenshots/repro/vitest.config.mts`, run as `npx vitest run --config <it>` from `web/`) that only widens `server.fs.allow`. Reason: this worktree's `node_modules` and `web/node_modules` are symlinks into the `editor-core-claude` worktree, so Vite's fs guard rejects `@zenuml/core …worker.js?url` ("Denied ID"). With the plain config, `AppRoot.test.tsx` fails at base for that reason alone. Replacing the symlink with a local install needed an approval that was not available in this run.

### 5.1 Browser evidence (all failures SIMULATED with `page.route` fixtures)

Every non-localhost request was aborted (fonts.googleapis.com and cdn.paddle.com were blocked; text uses the fallback font). `/track` was answered locally. No production calls or writes were made. Fixture: id `fixture-item`, token `fixture-token`, title `Checkout flow (fixture)`, two pages.

Per viewport (desktop 1440×960, narrow 390×844) × appearance (light, dark, set as the persisted `appearance` localStorage value):
- Loading (request held open): `<html data-appearance>` matches; title `Loading diagram…`; no Fork/Present/title input/editor; status announced; panel colour measured; no horizontal overflow.
- Failure (**SIMULATED HTTP 503**): alert text; title `Shared link`; not the dead-link dialog; no token/id/503 in page text; no overflow.
- Retry with the keyboard (focus Try again, press Enter): **request #2 issued with the same `id=fixture-item` / `share-token=fixture-token`**; loading shown; focus on the status panel; a second Enter while loading → still 2 requests.
- Success: header title `Checkout flow (fixture)`, title input `readOnly`, save state `readonly`.
- Also: **SIMULATED network drop → retry → SIMULATED 403** → existing unavailable notice and no editor; **SIMULATED 404** → existing notice; leaving via Diagrams while loading, then fulfilling the request → the hub stays and the shared item does not open.

Screenshots (`share-status-screenshots/`, untracked; raw results in `results.json`):

| State | Light | Dark |
|---|---|---|
| Loading 1440 | `loading-desktop1440-light.png` | `loading-desktop1440-dark.png` |
| Failure 1440 (SIMULATED 503) | `failure-desktop1440-light-SIMULATED-503.png` | `failure-desktop1440-dark-SIMULATED-503.png` |
| Loading 390 | `loading-narrow390-light.png` | `loading-narrow390-dark.png` |
| Failure 390 (SIMULATED 503) | `failure-narrow390-light-SIMULATED-503.png` | `failure-narrow390-dark-SIMULATED-503.png` |
| Success after retry | `success-after-retry-desktop1440-light.png`, `…narrow390-light.png` | `success-after-retry-desktop1440-dark.png`, `…narrow390-dark.png` |
| Unavailable (existing notice) | `unavailable-revoked403-after-retry-SIMULATED.png`, `unavailable-initial404-SIMULATED.png` | — |

### 5.2 Root E2E gate

Run against this worktree's own servers: dev with the fs-allow wrapper on :4397 and `vite preview` of this build on :4398. Port 3000 was occupied by another process, so the default `reuseExistingServer` would have tested someone else's server. Result: **63 passed, 32 skipped, 0 failed, 0 flaky** (1.8 min). Several specs (css-editor, export, connectivity) skip themselves when `PW_BASE_URL` is set. The run did not break the 32 skips down by reason. Log: `share-status-screenshots/repro/root-e2e.log`. This run happened before the final one-line `paymentEnabled: false` change. After that change, unit (111 files / 1167 passed), `tsc`, build and the 81-check browser script were rerun and all passed. The root E2E suite was not rerun.

## 6. Remaining limitations

1. **Shared embed** (`?embed&id=&share-token=`) is out of scope and unchanged. While its read is pending it still shows the existing "Diagram unavailable" embed card, and it does not offer retry.
2. After a successful retry, the status view unmounts and focus goes to `<body>`. The next Tab enters the Editor header. Moving focus into the Editor would need an Editor/AppHeader change, which is out of scope.
3. While pending there is no ▾ app menu (Settings/Help/Shortcuts), because `AppMenu` always includes New/Save. Navigation (Diagrams), appearance and account stay available.
4. 401 and 410 count as explicit "unavailable" even though the current backend never sends them. A Firebase Hosting 404 for a missing function would also count as unavailable. That would be a deployment fault, and the status code is the only provenance the client has.
5. Retry outcomes are not tracked in analytics (no new events were added).
6. The dark inset ring and the 35% content offset follow the Figma frames by measurement. Pixel diffs against the Figma PNGs were not automated.
7. (Fixed in Phase 2, see section 7.) Previously, browser Back to a share URL could show a blank page.
8. If the Hosting rewrite for `/get-shared-item` were missing, the SPA fallback would answer 200 with HTML. That is now classified retryable (Try again loops) rather than the dead-link notice. This would be a deployment fault, and it fails safe (no content shown).
9. Background dev and preview servers (:4397, :4398) were started for validation and stopped at the end (exit 143 from SIGTERM).

---

# Phase 2 — browser Back regression fix + share panel states

## 7. Route-navigation bug (shared URL → own/library route → browser Back)

**Cause** (`web/src/hooks/useBootItem.ts`, base version):
- `shareTarget` was read only at mount.
- Navigation cleared it.
- The `booted` ref blocked any new boot.

Back to the same share URL therefore rendered nothing.

**Fix:**
- The shared visit is keyed by `id + share-token` (`shareTargetKey`).
- A lifecycle effect on `[authReady, targetKey]` makes a new read on every entry. It invalidates the pending request (sequence number) on leave or on a target switch.
- Status is reset to `loading` in the same render as the key change, so no frame shows the previous item.
- A response is applied only when it is the current request AND the editor store still holds the item that was there at request start. A late response therefore never replaces an item the user opened meanwhile.
- The non-shared boot path still runs once (`[authReady]`), unchanged.
- `retryShare` works only from `retryable-error`. It re-reads the same id/token.

**AppRoot:** the status, retry and unavailable views render before the null-item guard. When the store still holds an owner diagram (Back from an owned diagram), the share URL shows loading, retry or the unavailable notice, never the owner document.

**Regression tests** (written first; they failed on the old hook):
- `useBootItem.test.tsx` "shared target re-entry (browser Back)", 8 tests:
  - loaded → hub → Back refetches;
  - pending → hub → Back drops the stale response;
  - share → own → Back replaces the owner item;
  - revoked on Back gives `unavailable` and leaves the owner item untouched;
  - offline on Back gives retry with the same id/token;
  - non-shared boot then share;
  - analytics fire once;
  - no duplicate request on rerender.
- `AppRoot.test.tsx` "shared URL re-entry via browser Back", 4 tests. They cover the same cases at app level: no owner content under the share URL, and no blank seed.

## 8. Share panel (Figma F18/F19/F26 light, F29/F30/F31 dark)

- `useShare`:
  - adds `stopping`, `failure: 'create'|'stop'|null` and `copyFailed`;
  - per-item busy guards (a double click sends one request);
  - item switch resets all states;
  - `copy` never throws.
- `SharePopover`:
  - compact menu-like panel, eyebrow "Share link", sentence "Anyone with the link can view this diagram.";
  - one action and one feedback line at a time;
  - `data-state`: create, creating, create-failed, created, copied, copy-failed, stopping, stop-failed.
  - The link appears only after the backend confirms it, and is removed only after Stop is confirmed.
  - Busy buttons are truly `disabled` with `aria-busy`.
  - Focus moves to Copy or Create when the link appears or disappears. On copy failure, the link text is selected for manual copy.
- `SharePopover.css`: scoped styles on `--editor-*` tokens via `.editor-hifi-menu`, so the panel follows the app theme. No global CSS.
- `ShareButton.tsx` is unchanged. The new props are optional, so callers that do not pass them (for example the active core branch) still compile.
- `AppRoot.tsx`: one added hunk passes `stopping`, `failure` and `copyFailed` to `ShareButton`. AppHeader and layout were not edited.
- Read-only public link semantics, auth gating and link persistence are unchanged. There are no new roles and no backend change. A visitor's Share button stays disabled, and the header keeps the diagram title.

## 9. Phase 2 validation actually run

| Check | Result |
|---|---|
| Full unit suite, `--maxWorkers=2`, final run | 111 files, 1200 passed, 1 skipped, 0 failed |
| Earlier full run under heavy machine load | 2 failures: a CodeMirror composition timing test and one other timing test in unrelated files. The rerun passed fully (log `/tmp/share-status-cfg/unit-full.log`) |
| Focused: useBootItem + AppRoot | 134 pass |
| Focused: useShare / SharePopover / ShareButton | 27 / all / 9 pass |
| `tsc --noEmit` | exit 0 |
| `vite build` (wrapper config, task cacheDir) | OK |
| Browser `browser-panel.mjs` | 101/101 checks PASS (against the Phase 2 `useShare`; predates the Phase 3 correction and was NOT re-run) |

Browser checks:
- **Panel:** harness at :4432 (real ShareButton + useShare, deferred fake backend).
  - 1440 and 390, light and dark, every state.
  - Create, copy and stop failures are SIMULATED by the fake backend or by clipboard denial.
  - Double-click sends a single request, and no link shows before confirmation.
  - The clipboard holds the link, and the panel background follows the theme.
- **Back navigation:** production preview at :4431, real app, `getSharedItem` fixtures via `page.route`.
  - Re-read uses the same id/token, with loading view, title and read-only state.
  - pending → hub → Back drops the stale response.
  - Offline on Back (SIMULATED) gives retry with the same id/token.
  - A 403 (SIMULATED) gives the unavailable notice with no editor.

Screenshots: `share-status-screenshots/round2/` (`panel-*` 32 files, `back-*` 10 files, `results.json`). Repro: `share-status-screenshots/repro/browser-panel.mjs`, `repro/harness/`, `repro/vitest.config.mts`.

**Phase 2 limitations:**
- The panel was validated in a harness. A real signed-in share needs Firebase auth plus a backend write, which is out of scope (no production data).
- The `vite` dependency cache: Phase 2 runs use `/tmp/share-status-cfg/vite-cache`. The Phase 1 dev run used the sibling worktree's pre-existing `.vite` cache.
- Lint was not run: `web/` has no ESLint 10 flat config (pre-existing).
- Pixel diffs against the Figma reference PNGs were not automated. The comparison was visual only.

## 10. Exact feature file manifest (vs `6b9c2f02`)

Modified (`git diff --numstat`, added/removed):
```
339  0  web/src/app/AppRoot.test.tsx
 48  2  web/src/app/AppRoot.tsx
 15  0  web/src/components/share/ShareButton.test.tsx
 95  0  web/src/components/share/SharePopover.test.tsx
148 64  web/src/components/share/SharePopover.tsx
682  1  web/src/hooks/useBootItem.test.tsx  (updated in Phase 4)
191 18  web/src/hooks/useBootItem.ts       (updated in Phase 4)
401  1  web/src/hooks/useShare.test.tsx   (updated in Phase 3)
137 43  web/src/hooks/useShare.ts        (updated in Phase 3)
 40  0  web/src/services/cloudFunctions.test.ts
 16  3  web/src/services/cloudFunctions.ts
```
New:
```
web/src/components/share/SharePopover.css
web/src/components/share/ShareVisitorStatus.css
web/src/components/share/ShareVisitorStatus.test.tsx
web/src/components/share/ShareVisitorStatus.tsx
web/src/services/sharedItemError.ts
```
Artifacts (not product code): `IMPLEMENTATION-SHARE-STATUS-REPORT.md`, `share-status-screenshots/`.
Not touched: AppHeader, layout, backend, functions, global CSS. Nothing was committed, pushed, merged or deployed.

---

# Phase 3 — share operations across diagram switches (correction)

This supersedes the Phase 2 share snapshot, which is unaccepted. This section does not claim final acceptance.

## 11. Blockers and causes (`web/src/hooks/useShare.ts`)

1. **Copy status was not tied to an item.**
   - The item-change effect reset `failure` and `copyFailed`, but not `copied` or the Copied timer.
   - `copy()` awaited `clipboard.writeText` with no identity check.
   - Result: after copying A and switching to shared B, B could show "Copied". A late rejected copy for A set `copyFailed`, so the panel focused and selected B's link.
2. **Create and stop guards held a single id each.**
   - `creatingFor` and `stoppingFor` were each one mutable id, despite the comment.
   - Start A, then B, then return to A: A could submit again. A's `finally` cleared B's guard.
   - On returning to A, the panel showed A idle while its request was still pending.

## 12. Fix

- **Per-item locks with owners:** `pendingOps: Map<itemId, {op, owner}>`.
  - Each outstanding diagram keeps its own lock.
  - Only the attempt that took a lock can release it.
  - A create and a stop on the same diagram conflict, so the second one is rejected. In the panel this conflict cannot happen: the link view hides Create and the no-link view hides Stop. The test drives the hook directly for that case.
  - The backend call always targets the captured id. UI success and error apply only if that item is shown when the result arrives.
- **Busy state restored on return:** the item-change effect sets `sharing` and `stopping` from the item's lock, so the control is really disabled.
- **Copy belongs to item, generation and link:**
  - `generation` increases on every item change and on unmount.
  - `copySeq` makes the latest copy win.
  - A completion applies only if the generation, the sequence and the shown link all still match. Otherwise it is inert: no Copied, no copy failure, no focus or selection, no timer.
  - The item-change effect clears `copied` and the timer. A successful stop also clears the timer.
  - The manual-copy fallback is unchanged for the current link.
- **Deliberate behaviour change, `confirmedLinks`:** a session map `itemId -> url | null` of backend-confirmed creates and stops.
  - On return to a diagram, it overrides the stored `isShared`/`shareToken`. The editor store does not mirror these operations.
  - Without it, a diagram stopped while the user was elsewhere showed its dead link again on return. A link created while away did not appear.
  - This replaces the earlier documented limitation that an in-session share did not re-hydrate until reload.

## 13. Phase 3 tests

12 new tests in `useShare.test.tsx`, describe "useShare operations across diagram switches". They drive the real hook through the real `SharePopover` and assert the visible `data-state`, link value, disabled controls, focus and messages. All promises are deferred.

- Copy:
  - A copy, then switch to B, then the copy resolves: B never shows Copied.
  - Same, but the copy rejects: B shows no copy error, and B's link is not focused.
  - A confirmed copy on A does not carry over to B.
  - A, then B, then back to A, then the copy resolves: inert. A second copy that rejects after another round trip: also inert.
  - A copy for the current link still confirms, and the manual fallback still selects the current link.
  - No Copied revert timer is scheduled after a switch, or after unmount.
- Create:
  - Overlapping A and B creates. Returning to A shows `creating` and a disabled button, with no second request. A finishes first and B stays locked (no double submit). Each item shows its own link afterwards.
  - A's create fails while B is shown: no link and no error on B.
- Stop:
  - Overlapping A and B stops. Return to A shows `stopping` with the link kept. A finishes first and B stays locked. A stopped A stays stopped on return.
  - A's stop completes while B is shown: B's link is kept.
- Conflict: a create while a stop is pending on the same diagram is rejected.

**Red phase:** 9 of these failed on the previous hook. The other 3 (A's create failure, A's stop success while B is shown, and the current-link copy and fallback) already passed and stay as guards. The existing same-item double-click tests and the public API are unchanged.

| Check | Result |
|---|---|
| `useShare.test.tsx` | 39/39 pass |
| `useShare` + `components/share/*` + `AppRoot.test.tsx` (`--maxWorkers=2`) | 5 files, 159/159 pass |
| `tsc --noEmit` (unpiped exit code) | 0 |
| `vite build` (wrapper config, outDir `/tmp/share-status-cfg/dist-ops`) | OK |
| Full unit suite | not run (other workers active, as instructed) |
| Browser harness and screenshots | not re-run. The Phase 2 browser evidence predates this correction |

## 14. Phase 3 limitations

1. `confirmedLinks` lives only for the session. If another tab or device changes a diagram's share state, this session keeps showing what it last confirmed until reload. The earlier code reflected a store re-read instead.
2. Locks and `confirmedLinks` live in the hook instance. If the component that owns `useShare` unmounts, they are lost. AppRoot keeps the hook mounted for the editor session.
3. A create or stop failure that happens while another diagram is shown is not surfaced on return; the panel shows the plain current state. This matches "error UI belongs to the current item" and was already the behaviour before.
4. The timer tests detect the Copied timer by its 1500 ms delay (`COPIED_RESET_MS`). If that constant changes, the tests need the same change.
5. Visitor read-only enforcement and unavailable-page navigation belong to the parent task and were not changed here.

No commit, push, merge or deploy. Preview 4411 was left running.

---

# Phase 4 — cancel the old owned boot when entering a shared target

This keeps all Phase 2 and Phase 3 fixes. This section does not claim final acceptance.

## 15. Blocker and cause (`web/src/hooks/useBootItem.ts`, non-shared boot effect)

The once-per-mount owned boot (`?id=` `getItem`, `?code=`, last-code or new) had no ownership check after its `await`. If the route entered a shared target before the boot settled, the late result could still run `loadItem(A)` or `newItem()`:

- **S settles first, then A:** the owner diagram or a blank diagram replaced the loaded shared diagram S.
- **A settles first, while S is pending:** `loadItem(A)` changed the editor item. The shared read then saw a different `startItem`, set status `idle`, and exposed owner A under the shared URL.

The existing test for a non-shared boot followed by a share waited for the owned boot to finish, so it missed this race.

## 16. Fix

- **Owned boot ownership:** `ownedSeq` plus `ownedBoot {route, state}`.
  - A completion applies only if it is still the latest owned boot, the hook is still mounted, and the current route is not a shared target.
  - `targetKeyNow` is updated during render, so a completion that lands before the effects run still sees the new route.
- **Cancellation on entry:** entering a shared target while the owned boot is pending marks it cancelled and bumps the sequence, in that same render. The rejection path (`newItem` fallback) is guarded the same way.
- **Shared routes fail closed:** a cancelled owned boot can no longer change the editor item, so the shared read's opened-item protection (`startItem`) only reacts to real user opens.
- **Leaving and returning:**
  - A cancelled owned boot re-runs (fresh request, same resolver contract) only when the route returns to the same non-shared target it was booting.
  - The hub, a different diagram, or a boot that already finished never re-run. Deliberate New/Open stays as the user made it.
  - The non-shared effect now depends on `[authReady, targetKey]`, but the guard keeps the old once-per-mount contract.
- **Analytics (`onResolved`, landed_in_editor):** now fires once per mount, for the first boot read that actually lands. A cancelled owned boot does not count. Retries never report. Previously the cancelled boot claimed the report, so S's landing was lost.
- **Unchanged:** embed (`skip`), inline `?code=` and last-code contracts.

## 17. Phase 4 tests

9 new tests in `useBootItem.test.tsx`, describe "owned boot cancelled by entering a shared target". All use deferred promises, and a store subscription records every editor item that appears after navigation.

- Owned A pending, then S, then S resolves, then A resolves: S stays loaded and A never appears.
- Same, but A rejects: no blank `newItem` replaces S.
- Reverse order: A resolves while S is pending, then S resolves. The store stays empty during loading, then S loads read-only. A never appears.
- Reverse order with a revoked S (SIMULATED 403): `unavailable`, with no owner content and no blank seed.
- Last-code boot pending, then S, then a late `new` result: no blank diagram.
- Unmount while the owned boot is pending: the late result is dropped.
- A pending, then S, then hub, then S again: S loads both times, and the stale A never lands.
- A pending, then S, then Back to A: a fresh owned boot loads A, the cancelled first read stays inert, and analytics fires once.
- Guard: an owned boot that finished before S does not re-run when leaving S. A deliberate `newItem` is kept.

**Red phase:** 8 of these failed on the previous hook. The guard test passed before and after.

| Check | Result |
|---|---|
| `useBootItem.test.tsx` | 62/62 pass |
| `useBootItem` + `useShare` + `components/share/*` + `src/app/*` (`--maxWorkers=2`) | 10 files, 247/247 pass |
| `tsc --noEmit` (unpiped exit code) | 0 |
| `vite build` (wrapper config, outDir `/tmp/share-status-cfg/dist-boot`) | exit 0 |
| Full unit suite, browser harness, screenshots | not run (other workers active, as instructed). Earlier browser evidence predates Phases 3 and 4 |

## 18. Phase 4 limitations

1. Cancellation is decided during render, which is a ref write in render. A render that React throws away (concurrent mode) after entering a shared target could cancel the owned boot without committing. This fails closed. If the route then returns to the same owned target, the boot re-runs.
2. The owned boot still does not check whether the user opened another item while it was pending on a non-shared route. That behaviour was not changed here. Parent wiring owns deliberate New/Open from the header.
3. Final read-only source enforcement in AppRoot, Go to Diagrams on the unavailable page, and cross-module wiring belong to the parent task.

No commit, push, merge or deploy. Preview 4411 was left running.
