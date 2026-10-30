# Account flows — implementation report

- Date: 2026-10-20
- Base: `6b9c2f02` (inherited core Editor snapshot; preserved, not modified)
- Checkout: `/Users/pengxiao/.codex/worktrees/account-flows/web-sequence`
- Worker: Claude Opus 5.5, existing Claude Max session (pid 74618). No provider, billing or auth configuration changed. No paid API.
- No commit, push, merge or deploy. No production or real OAuth calls. No production data writes.
- Preview on 4411 (`editor-core-claude` `vite preview`) was not touched. This work used private port 4517.

## 00. Round 3 correction (2026-10-20) — AC-C1, supersedes the account-corrected snapshot

Finding AC-C1 (P2, `acceptance-corrected/source-findings.json`): when the initial check failed, a failed "Don't ask again" (or close) flag write set `error`, but `AskToImportModal` rendered `error` only when `!checkError`. The user kept seeing the old check failure and was not told that the choice was not saved.

Red first: new combined test `web/src/components/modals/AskToImportModal.flow.test.tsx` drives the real `useImportOnLogin` with the real modal (wired as in the AppRoot patch). On the round-2 source: 5 failed / 0 passed. Four failed on the defect (`Unable to find an element by: [data-testid="import-error"]` ×3, and the normal-state label/copy assertion). One failed because the test reused a spy call count; the test was corrected with `mockClear()` and no product change was made for that.

Fix:
- Modal: the `error` alert (`id="import-error"`, `role="alert"`) renders in both states and joins the dialog's `aria-describedby`. In the check-failure state the check error stays, with no count and no Import control.
- Hook: new `failedAction: 'import' | 'dismiss' | null`, set with each `error` and cleared with it and on identity change. Dismissal copy now names the choice and the retry: "Couldn't save \"Don't ask again\". Your local diagrams were not changed. Select Don't ask again to try again."
- Modal: new optional `failedAction` prop. With `'dismiss'`, the primary button keeps its normal action and label ("Try again" re-check in the check-failure state, "Import N diagrams" in the normal state), so a failed dismissal is no longer offered as an import retry. The dismissal is retried with "Don't ask again".
- Kept: identity/generation guards, the busy lock, re-check without upload, no fabricated count.

Regressions (all pass):
1. Check fails, then "Don't ask again" fails → the alert reads "Couldn't save "Don't ask again"…", the check error is still shown, the dialog description includes the failure, there is no count or "Import N", the flag stays unset, `saveItems` is not called, the record is kept.
2. Storage recovers, then "Don't ask again" again → the flag is `true` and the dialog closes; the record is kept.
3. After a failed dismissal, "Try again" re-checks → "Import 1 diagram", no upload.
4. Flag write held → dismiss disabled; a second dismissal and a re-check during it cause exactly 1 flag write and 0 index reads.
5. Normal state: a failed dismissal keeps "Import 1 diagram" (not "Try again") and does not upload.

Host wiring (deferred, in `APPROOT-INTEGRATION.patch`, both mounts): destructure `failedAction: importFailedAction` and pass `failedAction={importFailedAction}`. Without it, the alert is still visible (the copy names the choice), but in the normal state the primary label falls back to "Try again" (an import).

Parent-owned requirements (not implemented here; parent files untouched):
- Save guard adapter: the hook calls `saveItems(records, { uid })`. The parent's `itemService` `SaveItemsGuard` takes `{ expectedUid }`. The parent must adapt `{ uid }` to `{ expectedUid: uid }` at the `useImportOnLogin(...)` call site (for example `useImportOnLogin((items, g) => itemService.saveItems(items, g && { expectedUid: g.uid }))`). The service must refuse or target `expectedUid` and resolve the owner once at call entry.
- Central OAuth wiring (`pendingProvider` / `loginError` / `cancelLogin` across the Editor, hub and visitor hosts) and the Pricing link (`onOpenPricing`) on LoginModal/AppHeader.

Commands (from `web/`, private harness config, `--testTimeout=30000`):

| Check | Result |
|---|---|
| `AskToImportModal.flow.test.tsx` on the round-2 source (red) | 5 failed (4 on the defect, 1 test-only spy count) |
| `useImportOnLogin.test.tsx` + `AskToImportModal.test.tsx` + `AskToImportModal.flow.test.tsx` | 32 + 16 + 5 = 53 pass |
| owned 7 files (adds `useAuth`, `Dialog`, `LoginModal`, `SavedOnDeviceModal`) | PASS 116/116 (17 / 32 / 11 / 29 / 5 / 16 / 6) |
| `yarn typecheck` | PASS (exit 0) |
| `vite build --config .account-flows-harness/vite.config.ts` | PASS (exit 0) |
| `git apply --check APPROOT-INTEGRATION.patch` + tsc on patched temp copy | PASS / PASS (exit 0) |
| Full suite, E2E, ESLint, real OAuth, new screenshots | UNRUN (focused checks only, by instruction) |

Hashes (sha256) after round 3: changed files only. Other files are unchanged from the round-2 list below.

```
e509a26284923ef955e9f044fa5c64643f4e7f93228e68dfda91b13efb7017c5  web/src/hooks/useImportOnLogin.ts
ba1c4424a09f8cd80faf6901b89255316f2e7856b084962ddf3e180567fe66be  web/src/components/modals/AskToImportModal.tsx
f65b16b85b4b511ac42a9d9e59cf8816ec23a7910020fb3d4be2667c43fc6854  web/src/components/modals/AskToImportModal.flow.test.tsx (new)
9107a0d889acda18cb93df3b9056a60f9fda03839ef8d7d5e5b7e0bd7d25bdcc  account-flows-handoff/APPROOT-INTEGRATION.patch
```

Hook API now: `{ pending, count, doImport, dismiss, busy, error, failedAction, clearError, checkError, retryCheck }`. Final acceptance still needs a new capture and the combined UI proof.

## 0. Round 2 correction (2026-10-20) — supersedes the frozen account-final snapshot

Independent review found 3 `useImportOnLogin` defects that the round-1 tests did not cover. Each got a failing regression first (run against the round-1 hook), then a fix. Final acceptance still needs a new capture and an independent combined UI proof; the round-1 screenshots do not show the check-failure state.

| # | Defect (round-1 hook) | Red evidence (round-1 hook) | Fix |
|---|---|---|---|
| P1 | An obsolete A save resolving after A→B→A set `savedForUid=A`; the new A Import skipped uploading `new`, marked asked and closed | `expected "vi.fn()" to be called 2 times, but got 1 times` | Upload memo is `{uid, generation, payloadKey}` and is written only after the current-attempt check; retry skips the upload only for the same uid + generation + exact payload |
| P1b | (guard) payload changed after a successful save but failed flag write | `called 2 times, but got 1` | Same memo: changed payload uploads again |
| P2 | A held A import left `inFlight`/`busy` set; the B prompt opened busy and blocked; A's `finally` cleared B's busy/lock | `expected true to be false` (busy), saveItems not called for B | Lock is `{generation, attempt}`; generation change drops lock + busy; `finally` releases only its own attempt |
| P3 | Initial check (asked flag / index / record read) failure only logged; no message, no retry | `.toMatch() expects … got undefined` (no `checkError`) | New `checkError` + `retryCheck()`; modal `checkError`/`onRetryCheck` variant |
| — | Narrow guard contract | `expected undefined to deeply equal { uid: 'user-1' }` | `saveItems(records, { uid })` |

Red run: 12 failed / 20 passed (`useImportOnLogin.test.tsx`), 3 failed / 13 passed (`AskToImportModal.test.tsx`). The P1 reject variant and the same-generation flag-only retry passed on round 1 by design (guard for stale rejection; preserved optimisation).

Regression scenarios (exact):
- P1, for both late resolve and late reject: A import of `{old}` held → A→B → add record `new` → B→A (prompt count 2) → old settles → the new prompt stays open with no error and no flag → Import → events exactly `save:old`, `save:new,old`, `flag`.
- P2, for both late resolve and late reject: A save held → switch to B → B prompt `busy=false` → B Import (2nd save held, `busy=true`) → A settles → B still `busy`, error null, `dismiss()` still a no-op (flag unset) → B resolves → closed, flag set. Also: B `dismiss()` works while A is held.
- P3, for asked-flag, index and record read failures: `checkError` set, `pending=false`, `count=0` (count unknown, modal shows no count) → `retryCheck()` → real count 1, prompt pending, `saveItems` not called. Repeated failure keeps the error, busy returns to false, records untouched. "Don't ask again" in this state persists the flag, clears the error, keeps the records. Identity change clears it.

What is not claimed: an obsolete attempt's already-issued write is not cancelled or rolled back. It settles silently, under the account it was issued for (the uid check runs in the same tick as the `saveItems` call).

Hook API (compatible superset): `{ pending, count, doImport, dismiss, busy, error, clearError, checkError, retryCheck }`. `saveItems` signature: `(items, guard?: { uid: string }) => Promise<void>`; existing `itemService.saveItems` ignores the 2nd argument.

Narrow callback contract for the parent's `SaveItemsGuard` union: if the service reads the guard, it must write to `guard.uid` or refuse, and must resolve the owner once at call entry (not after an await). The hook never assumes the service re-reads auth later; it does not need any other callback.

Modal (compatible): new optional `checkError`, `onRetryCheck`. With `checkError`, the dialog description is the failure text (`role="alert"`, test id `import-check-error`), no count sentence and no "Import N" label; primary button "Try again" → `onRetryCheck` (never `onImport`), "Checking…" while busy; "Don't ask again" → `onDismiss`.

Deferred host wiring (in `APPROOT-INTEGRATION.patch`, both mounts): destructure `checkError: importCheckError, retryCheck: retryImportCheck`; `open={importPending || importCheckError != null}`; pass `checkError={importCheckError}` and `onRetryCheck={() => void retryImportCheck()}`. Without the patch, a check failure still shows no modal (round-1 behaviour) and never shows a false count.

Parent contracts noted, not implemented here: central `pendingProvider`/`loginError`/`cancelLogin` across Editor, hub and visitor hosts (hook API and controlled modal unchanged); core's optional `onOpenPricing` on LoginModal/AppHeader is absent from this baseline and is left for the parent to union.

### Round 2 commands and results

| Command (from `web/`) | Result |
|---|---|
| `yarn vitest run --config .account-flows-harness/vite.config.ts --testTimeout=30000 src/hooks/useImportOnLogin.test.tsx` (red, round-1 hook) | 12 failed, 20 passed |
| same, `src/components/modals/AskToImportModal.test.tsx` (red) | 3 failed, 13 passed |
| owned 6 files (`useAuth`, `useImportOnLogin`, `Dialog`, `LoginModal`, `AskToImportModal`, `SavedOnDeviceModal`) | PASS 111/111 (17 / 32 / 11 / 29 / 16 / 6) |
| `yarn typecheck` | PASS (exit 0) |
| `node_modules/.bin/vite build --config .account-flows-harness/vite.config.ts` | PASS (exit 0; existing chunk-size warning) |
| `git apply --check APPROOT-INTEGRATION.patch` (184 lines) | PASS |
| tsc on patched temp copy `/tmp/af-check/web` | PASS (exit 0) |
| `src/app/AppRoot.test.tsx` on patched temp copy | PASS 69/69 |
| Full suite, ESLint, E2E, real OAuth, screenshots of the check-failure state | UNRUN (instructions: focused checks only; ESLint has no flat config; E2E needs emulator) |

Source hashes (sha256, after round 2):

```
72c38848af528eb95f308a8610799043ba5442e5146c41ff0fbbfec10c644c80  web/src/hooks/useImportOnLogin.ts
f24cb0b0da0156af3b0e935add3960130bc6921b0b1019e83b40ae37223d15ff  web/src/hooks/useImportOnLogin.test.tsx
193acc10a636264e346461cc526325a826f125609c0dcd50e5d5be518f9fe64b  web/src/components/modals/AskToImportModal.tsx
6a3996e2503d6516cb5c007ea32616d00499e2afdf8a36e86f952bbaff951fd2  web/src/components/modals/AskToImportModal.test.tsx
6c4d4325a772aabc3cb6da971aef3c4e4d55819463a89a5512e4be29f3bf26c6  web/src/hooks/useAuth.ts
5d9e169e06021c4202e485870e55dc105e37495e915396c111f3349aa2c4e903  web/src/hooks/useAuth.test.tsx
a79948bdbadf2f659f875c42f6b430ab8321ff249f8eecf2e5be34e065bc2224  web/src/components/auth/LoginModal.tsx
2bc26ba84ed05805026efcc7f19d02eee917690d0571c9add3726cd3dadd148e  web/src/components/auth/LoginModal.test.tsx
f6aaeff381eb26765f9e663fc9ebb8a447c9a4ca7480066ba2d3ed29404fdb6b  web/src/components/auth/signInProviders.ts
23549b808d9da164adc202b900d695de905a624e1eac64a641d5c29474f1b948  web/src/components/auth/account-flows.css
416160a78613e5e63cc29f30826b8ab858b40f05bacd4468977dfede8d0ee4c0  web/src/components/modals/SavedOnDeviceModal.tsx
4f7bc07f36093a4ef9cb4deb47f34d954d2f1db3e249e2f7dcf700a254f5f89f  web/src/components/modals/SavedOnDeviceModal.test.tsx
ab4b106074d018368be2ee940193a25ae84311c24cc45623aaa39cb0ea7dcd7a  web/src/ui/Dialog.tsx
1479358005103d94d902292393b3330f08125e96f5c15bfc7a08d1dd43146455  web/src/ui/Dialog.test.tsx
d6638593dd9500d224168698735ec8a1ca391cb6bf3eb939fe6e1f8e97e50103  account-flows-handoff/APPROOT-INTEGRATION.patch
472a25552f34339d289c2f995b479eb07dfafe25169a045846719390d3429026  account-flows-handoff/E2E-INTEGRATION.patch
```

Changed in round 2: `useImportOnLogin.ts`/`.test.tsx`, `AskToImportModal.tsx`/`.test.tsx`, `APPROOT-INTEGRATION.patch`. The other listed files were not edited in round 2.

Sections 1–7 below describe round 1. Where they disagree with section 0 (retry semantics in 3.3, test counts in 4.1, hook API), section 0 wins.

## 1. Result

| Flow | Status |
|---|---|
| Sign in: Google and GitHub only, 400px compact modal, last used, pending, inline failure, single submission, stale-attempt safety | Done (component + hook). Wiring in AppRoot is a separate patch. |
| Saved on this device (F41) | New `SavedOnDeviceModal`. AppRoot wiring is a separate patch. The trigger and acknowledgement in AppRoot stay as they are. |
| Import local diagrams? (F41) | Hook and modal hardened: real-record count, singular/plural, busy, inline error, retry, identity/unmount safety. Wiring is a separate patch. |
| AppRoot wiring contract | `/Users/pengxiao/.codex/account-flows-handoff/APPROOT-INTEGRATION.patch` (170 lines, `git apply --check` OK, typecheck OK, AppRoot/header tests 104/104 pass on a patched temp copy). |
| E2E spec follow-up | `/Users/pengxiao/.codex/account-flows-handoff/E2E-INTEGRATION.patch` (`git apply --check` OK). Not run. |

## 2. Source ownership (all changes in this checkout)

Modified:
- `web/src/components/auth/LoginModal.tsx` + `.test.tsx`
- `web/src/hooks/useAuth.ts` + `.test.tsx`
- `web/src/components/modals/AskToImportModal.tsx` + `.test.tsx`
- `web/src/hooks/useImportOnLogin.ts` + `.test.tsx`
- `web/src/ui/Dialog.tsx` + `.test.tsx` — optional, backward-compatible presentation props only (see §5)

New:
- `web/src/components/modals/SavedOnDeviceModal.tsx` + `.test.tsx`
- `web/src/components/auth/account-flows.css` — scoped (`.af-*`) styles on the semantic `--editor-*` tokens
- `web/src/components/auth/signInProviders.ts` — Firebase-free provider helpers (re-exported from `useAuth`)
- `web/.account-flows-harness/` — private, non-shipped harness: `vite.config.ts` (private cacheDir/outDir/port 4517), `fixture.html`, `fixture.tsx`, `shoot.cjs`. Delete it before commit or keep it out of the commit.

Not edited: `AppRoot.tsx`, `AppHeader`, `globals.css`, Editor, CodeAppearanceBar, HomeView/HomeSidebar, importDiagrams/import feedback, Share components, backend, `services/firebase.ts` (Facebook/Twitter provider config is unchanged), `node_modules`, lockfiles.

Symlinked `node_modules` and `web/node_modules` (into `editor-core-claude`) were only read. The shared `node_modules/.vite` cache was not written: every Vite/Vitest run used `--config web/.account-flows-harness/vite.config.ts` (cacheDir `web/.account-flows-harness/.cache`, build outDir `web/.account-flows-harness/.out/dist`).

## 3. Behaviour

### 3.1 Sign in (`LoginModal`, `useAuth`)

```
click provider ──► useAuth.login(p)
                    │ sync gate (inFlight ref) — second call same tick ignored
                    │ attempt id++ ; pendingProvider = p ; loginError = null
                    ▼
               fbLogin(p) ──ok──► record lastAuthProvider ; lastProvider = p
                    │
                  error ──► if attempt still current: loginError = describeLoginFailure(p, code)
close modal ──► cancelLogin(): attempt id++, pending/error cleared, gate released
                (late result of the old attempt changes no UI state)
```

- Only Google then GitHub, fixed order, equal weight. No Facebook/Twitter/email/Microsoft/Apple entry. Raw ids passed unchanged to `onLogin`. `ProviderName` and Firebase provider config keep Facebook/Twitter (UI access only removed).
- 400px max width, `min(400px, 100vw − 32px)`, max-height `100dvh − 32px`, 24px centred title, 13px explanation, 48px outlined buttons, 12px gap, icon + label centred. Google brand fills; GitHub `currentColor`.
- "Last used: Google|GitHub" shown below the buttons only for a recorded Google/GitHub value; other stored values (e.g. `facebook`) show nothing. Test id `login-<id>-lastused` kept for E2E AUTH-3.
- Pending: the pending button reads "Signing in…" (`aria-busy`), both buttons are disabled, note "Complete sign-in in the Google window." Close/Escape stay available.
- Failure: inline `role="alert"` note (test id `login-error`), both providers re-enabled. Copy always names a next step, e.g. "Couldn't sign in. Try again or use GitHub."; popup closed → "The Google window was closed before sign-in finished. Try again or use GitHub."; account exists → "This email already uses a different sign-in method. Try Google." No `window.alert`. A closed popup is never treated as success and does not write `lastAuthProvider`.
- `login()` never rejects. A late success of a cancelled attempt still records the provider as last used (the account did sign in) but changes no modal state.
- Modal pending source: controlled via `pendingProvider` prop, or (when the prop is absent) derived from the promise `onLogin` returns. This lets AppHeader's existing mount show pending without editing AppHeader.
- Focus: the dialog container takes focus on open (no ring on ✕ until Tab), focus is trapped, Escape closes, focus returns to the element that opened it.

Hook API (compatible superset): `{ login, logout, loginError, clearLoginError, pendingProvider, cancelLogin, lastProvider }`.

### 3.2 Saved on this device (`SavedOnDeviceModal`)

- Copy: "Saved on this device" / "Your diagram is saved in this browser." / "Sign in to save and sync across devices." Buttons "Not now" / "Sign in". No cloud-saved claim.
- Props `{ open, onOpenChange, onSignIn }`. Not now, ✕, Escape, outside click → `onOpenChange(false)`. Sign in → `onOpenChange(false)` then `onSignIn()`.
- The existing AppRoot trigger is unchanged: it sets `loginAndsaveMessageSeen` before opening, so closing needs no write and the prompt does not return. Editing continues after close (tested).
- Test ids `confirm-cancel` / `confirm-ok` mirror the `ConfirmDialog` it replaces, so E2E IOL-1..3 keep working.

### 3.3 Import local diagrams? (`AskToImportModal`, `useImportOnLogin`)

Defects reproduced with failing tests first (11 red against the base code, each for the stated reason), then fixed:

| # | Defect at base | Red evidence |
|---|---|---|
| 1 | `saveItems` failure rejected `doImport()` (AppRoot calls `void doImport()` → unhandled), no error state | `promise rejected "Error: offline" instead of resolving` |
| 2 | Retry path not reachable after failure | `Error: offline` |
| 3 | Count from the index included ids without a record | `expected 2 to be 1` |
| 4 | Prompt shown when only ghost index entries exist | `expected true to be false` |
| 5 | No busy state; dismiss during import set the flag and closed | `expected undefined to be true` |
| 6 | Prompt stayed open after sign-out | `expected true to be false` |
| 7 | Account switch mid-import saved into the new account | `saveItems ... called 1 times` |
| 8 | Dismiss flag-write failure rejected | `promise rejected "Error: quota"` |
| 9 | Flag-write failure after successful save rejected | `Error: quota` |
| 10 | Record read failure rejected | `promise rejected "Error: read"` |
| 11 | Unmount mid-save rejected | `promise rejected "Error: late"` |

Behaviour now:
- Count = local records that exist. Copy: "1 diagram is saved in this browser." / "3 diagrams are saved in this browser."; "Add it/them to your account to access it/them on other devices."; buttons "Don't ask again" / "Import 1 diagram" / "Import 3 diagrams".
- Busy: "Importing…" (`aria-busy`), both actions and ✕ disabled, Escape/outside click ignored; the hook's synchronous gate also ignores a second `doImport`/`dismiss`.
- Failure: inline `role="alert"` error, prompt stays, local records stay, flag not set, Import becomes "Try again". Prompt closes and `askedToImportCreations` is written only after the save succeeds.
- Retry semantics: if the save succeeded but the flag write failed, retry writes only the flag (no second upload). Otherwise retry re-reads local records and saves again. Re-saving is idempotent in the existing service (`batch.set(..., { merge: true })`), and the signed-in path uses one Firestore `writeBatch`, so no partial cloud write is assumed. No new backend.
- Identity: a generation counter bumps on uid change and unmount; stale reads/saves update no state. The uid is re-checked in the same tick as the `saveItems` call (which resolves the account synchronously), so the save goes to the starting account or does not happen. Sign-out closes the prompt.
- "Don't ask again" / close persist the never-ask flag (existing semantics). Local content is never deleted.

Hook API (compatible superset): `{ pending, count, doImport, dismiss, busy, error, clearError }`. `doImport`/`dismiss` still return `Promise<void>` and never reject.

## 4. Tests

### 4.1 Owned unit tests (Vitest, private harness config) — PASS 94/94

| File | Pass | Fail |
|---|---|---|
| `src/hooks/useAuth.test.tsx` | 17 | 0 |
| `src/hooks/useImportOnLogin.test.tsx` | 19 | 0 |
| `src/ui/Dialog.test.tsx` | 11 | 0 |
| `src/components/auth/LoginModal.test.tsx` | 29 | 0 |
| `src/components/modals/AskToImportModal.test.tsx` | 12 | 0 |
| `src/components/modals/SavedOnDeviceModal.test.tsx` | 6 | 0 |

Command: `cd web && yarn vitest run --config .account-flows-harness/vite.config.ts --testTimeout=30000 <files>`.

Covered: both providers, same-tick double submission (both orders), cancel/stale failure, stale settle vs new attempt, popup closed, generic failure copy, unsupported last provider, unmount; modal pending (controlled + uncontrolled), close while pending, reopen after close, error vs pending priority, focus into dialog / trap / restore (two different openers); import fail/retry/success, ghost records, busy + dismiss race, sign-out, account switch, flag-write failures, read failure, unmount; singular/plural; Escape/✕ while busy.

Existing tests rewritten on purpose: the old LoginModal tests asserted the retired 4-provider/elevated "Last used" chip design; the old useAuth test asserted `window.alert`.

### 4.2 Full web unit suite

- Run 1 (default workers): 6 files failed — 4 with `Error: Denied ID …/editor-core-claude/…/zenuml-server.worker.js?url` (symlinked deps resolve outside Vite root; harness-only fix: `server.fs.allow` the deps realpath), plus 2 tests (ExportDialog 5s timeout, indentInvariant).
- Run 2: 12 failed (8 × `Test timed out in 5000ms`, 2 parser-budget assertions, 2 follow-on lookups). Machine load average 59 (other sessions).
- Run 3 (`--maxWorkers=2`): 1162 passed, 14 failed, 1 skipped; all 14 in `AppRoot.test.tsx` and `SettingsModal.test.tsx`, all 5s timeouts.
- Every failing file from runs 1–3 passes when re-run alone: the 6 files of run 1 → 119/119; `AppRoot.test.tsx` + `SettingsModal.test.tsx` with `--testTimeout=30000` → 88/88.
- Result: no failure reproduces in isolation. A single clean full-suite run was not achieved under the current machine load.

### 4.3 Other checks

| Check | Result |
|---|---|
| `yarn typecheck` (tsc --noEmit, web) | PASS (exit 0) |
| `vite build` via private config (outDir `web/.account-flows-harness/.out/dist`) | PASS (exit 0; existing >500 kB chunk warning) |
| ESLint | UNRUN — `eslint` 10.4.1 in `web/` finds no `eslint.config.*` (repo tooling, not this change) |
| Integration patch: `git apply --check`, tsc, `AppRoot.test.tsx` + header tests on a patched temp copy (`/tmp/af-check/web`) | PASS (104/104) |
| Playwright E2E (`e2e/tests`, `web/e2e`) | UNRUN — needs the Firebase emulator and the shared-cache dev server on :3000 |
| Real OAuth | UNRUN by instruction |

### 4.4 Real-browser fixture (Playwright Chromium, `node web/.account-flows-harness/shoot.cjs`)

Fixture: `http://127.0.0.1:4517/.account-flows-harness/fixture.html?modal=…&state=…&appearance=light|dark` (start: `cd web && node_modules/.bin/vite --config .account-flows-harness/vite.config.ts`, port 4517; then from the repo root `node web/.account-flows-harness/shoot.cjs`. The background dev server hit its 10-minute task limit and was killed after the shots completed; it is not running now). No Firebase is loaded. `import-live` drives the real `useImportOnLogin` with a fake `saveItems` (fail once, then succeed) over seeded localStorage with 3 records + 1 ghost index entry.

Assertions passed at 1440×900 and 390×844, light and dark (12 interaction runs):
- Dialog fully inside the viewport for every state; login width ≤ 400, buttons 48px, gap 12px, equal width, title 24px centred.
- Login: Google pending disables GitHub → failure copy names GitHub → GitHub attempt → Escape while pending → reopen not pending → focus back on opener.
- Saved: Not now closes, typing continues, no re-prompt.
- Import (real hook): "Import 3 diagrams" (ghost excluded) → Importing… with Escape ignored and dismiss disabled → error, flag unset, record kept → Try again → closes, flag `true`, exactly 2 saves, first save `fx-a,fx-b,fx-c`.
- Console errors: only the 4 intentional `[import] saving local diagrams failed … simulated network failure` logs.

Screenshots: `/Users/pengxiao/.codex/account-flows-handoff/screenshots/` (56 PNG + `results.json` with metrics)
- Static, each `{light,dark}-{1440,390}`: `login-default`, `login-lastused`, `login-pending`, `login-error`, `saved-on-device`, `import-default` (3), `import-one` (1), `import-pending`, `import-error`.
- Live, each `{light,dark}-{1440,390}`: `live-login-pending`, `live-login-error`, `live-import-pending`, `live-import-error`, `live-import-done`.
- Example: `screenshots/login-lastused-light-1440.png`, `screenshots/login-pending-dark-390.png`, `screenshots/import-error-dark-390.png`, `screenshots/saved-on-device-light-1440.png`.

## 5. Shared `Dialog` changes (backward compatible)

All new `DialogContent` props are optional; defaults render exactly as before (tested): `bare`, `titleClassName`, `descriptionClassName`, `bodyClassName`, `closeClassName`, `closeDisabled`, `describedBy`, `restoreFocus`, `focusContentOnOpen`, `overlayClassName`.

`restoreFocus` addresses a real gap: Radix modal dialogs return focus only to a `Dialog.Trigger`; app-state dialogs (all of AppRoot's) dropped focus to `<body>` on close. The opener is captured per opening in `onOpenAutoFocus`. Other dialogs are unchanged unless they opt in.

## 6. Integration steps (separate change, not applied)

1. `git apply /Users/pengxiao/.codex/account-flows-handoff/APPROOT-INTEGRATION.patch` (AppRoot only):
   - `useAuth()` → also take `pendingProvider`, `cancelLogin`, `lastProvider`; remove AppRoot's one-time `lastAuthProvider` read (the hook value is reactive and limited to Google/GitHub).
   - `handleLoginOpenChange(open)`: `setLoginModalOpen(open)`; on close also `cancelLogin()`. Used by the hub `LoginModal`, by `AppHeader` `onLoginOpenChange`, and by the auto-close on sign-in.
   - Both `onLogin` handlers `return login(provider)` (analytics `loggedIn` unchanged). The hub `LoginModal` also gets `pendingProvider`; the AppHeader mount derives pending from the returned promise, so AppHeader is untouched.
   - Both "Saved on this device" `ConfirmDialog` mounts (hub + editor) → `SavedOnDeviceModal` with `onSignIn={() => setLoginModalOpen(true)}`. Behaviour change: "Sign in" now opens the provider choice instead of launching a popup for `lastProvider ?? 'google'` (which could launch a retired Facebook/Twitter popup). Trigger/acknowledgement logic in `save()` unchanged.
   - Both `AskToImportModal` mounts → add `busy={importBusy}` and `error={importErrorMessage}`. The existing `onOpenChange` → `dismissImport()` path stays; the modal and hook ignore it while busy.
2. `git apply /Users/pengxiao/.codex/account-flows-handoff/E2E-INTEGRATION.patch`: AUTH-1 (`e2e/tests/cloud.spec.js`) and MOD-7 (`e2e/tests/modals-gap.spec.js`) expect Google/GitHub visible and Facebook/Twitter absent. Without it these 2 specs fail once the new LoginModal ships. AUTH-3/4/5 and IOL-1..3 keep their test ids.
3. Optional: forward `pendingProvider` through `AppHeader` to its `LoginModal` (controlled, same as the hub mount).
4. Remove `web/.account-flows-harness/` from the change set.
5. Run E2E with the emulator (`yarn test:e2e:cloud`) and a full unit run on an unloaded machine.

## 7. Limitations

- AppRoot, AppHeader and E2E specs are not changed; until the patches land, production keeps the old wiring. The new components are compatible with the current AppRoot (typecheck + current AppRoot tests pass), so the new LoginModal and hooks already work in place: without the patch the editor mount shows no pending state (AppRoot's `onLogin` returns void), the hub shows no pending state, the import modal gets no busy/error props (the hook still guards duplicate/dismiss races and never rejects), and the old "Saved on this device" ConfirmDialog stays.
- Until the AppRoot patch lands, closing the sign-in modal does not call `cancelLogin()` (AppRoot passes `setLoginModalOpen` directly). A popup that fails after the user closed the modal still sets `loginError`, and the next opening shows that stale error. Pending state is not affected (it clears when the attempt settles). The patch's `handleLoginOpenChange` fixes this.
- Until the AppRoot patch lands, the old "Saved on this device" ConfirmDialog still calls `login(lastProvider ?? 'google')` with AppRoot's raw stored provider (could be `facebook`).
- A single clean full-suite run was not achieved (load-related 5s timeouts; all pass in isolation).
- E2E and ESLint not run (§4.3).
- Dark dialog border uses `--editor-divider` (#505967) for the approved #516071; no exact token exists. Light border = `--editor-border` (#E3E8ED) exactly.
- F41 mock shows no ✕ on the two-button prompts; a labelled ✕ is kept for consistency and keyboard/screen-reader dismissal (same action as Not now / Don't ask again).
- Font: the approved sans is rendered with the existing editor stack (`'Inter', ui-sans-serif, system-ui, …`); Inter is not bundled, so the system sans is used where Inter is not installed (as in the existing editor chrome).
- Firestore batch limits (500 writes; 2 per item) are an existing constraint of `saveItems`, not addressed here. More than ~250 local diagrams would fail the batch and show the inline error with retry.
- Failure copy for Firebase codes not listed in `describeLoginFailure` falls back to the generic "Couldn't sign in. Try again or use <other>." message.
