# Milestone 05 — Extension + Embed + Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Read the roadmap (`…-roadmap.md`, esp. §1.1 cutover strategy, §3 types, §4 service interfaces, §9 carry-forward — including the **M05 extension share-link origin** deferral and the M04 `lastSeenVersion` Firestore-mirror / `onboarded` / one-time-prompt-flag deferrals), the requirements spec (`…-requirements.md` §3 RM-1..6, §12 REQ-EMB-1, §14 REQ-EXT-1, §15 NFR-8), and the contract spec (`…-frontend-backend-contract.md` §5.1 create-share origin, §7 storage keys, §8 URL-parameter contract, §10 cutover obligations). M00+M01+M02+M03+M04 are complete on `rewrite/web-foundation`.

**Goal:** Ship the two remaining delivery surfaces and make the rewrite the production app: (1) **Embed mode** (`?embed`) — a minimal read-mostly view (no main header, no modals, shortcuts off, embed header linking back, inline `?code=`/`?title=`/`?stickyOffset=` support); (2) **Chrome/Edge MV3 extension** — a packaged build of `web/dist` with a background service worker (icon-click opens the app, optional new-tab override), an options page (`preserveLastCode` + `replaceNewTab`), `chrome.storage.sync` settings (already abstracted in `storage.ts`), billing hidden (payment flag already off on extension hosts), CDN third-party scripts skipped (already gated in `analytics.ts`), and a share-link origin override so minted links point at `https://app.zenuml.com` not `chrome-extension://…`; and (3) the **final production cutover** — repoint the production build / Firebase hosting from the legacy `src/→dist/→app/` pipeline to `web/`'s output, **gated and reversible**, with the actual deploy left as a documented manual step for the user (NEVER deploy or modify cloud resources from this plan — NFR-1, Safety Rule 1/2).

**Architecture:** The runtime-mode foundation already exists (`app/runtimeMode.ts` detects embed/shared/extension/desktop; `config/firebaseConfig.ts` maps extension hosts → prod project + `payment:false`; `services/analytics.ts` skips CDN under `chrome-extension:` + routes to console in debug; `services/storage.ts` `syncStore` backs to `chrome.storage.sync`). M05 *consumes* these seams rather than re-inventing them. New work: a presentational **embed surface** (`components/embed/EmbedHeader.tsx` + an `AppRoot` embed branch that suppresses chrome and supports `?code=` inline source); a framework-agnostic **shareOrigin** helper (`config/shareOrigin.ts`) injected into `createShare` so the extension overrides `window.location.origin`; a **static extension bundle** under `web/extension-src/` (MV3 `manifest.json`, `eventPage.js` service worker, `options.html` + `options.js`) copied alongside `web/dist` by a new **`web/scripts/build-extension.mjs`** that produces `web/extension.zip`; and the **cutover** as a documented, reversible repoint of `firebase.json` `hosting.public` + the root build pipeline to `web/dist` — authored as a **dry-run-verified change set the user applies + deploys manually**, with an explicit rollback path.

**Tech Stack:** React 19, TanStack Router (typed `useSearch` for embed params — pay down the NFR-3 `window.location.search` debt where embed reads URL params), Zustand, Radix + the Drafting Table design system, Vitest + RTL, Playwright; Node `node:fs`/`archiver` (or `gulp-zip` parity) for the extension zip; Vite 6 build (`web/dist`); Firebase Hosting (config edit only — NO deploy from here).

---

## Pre-flight (read once)

- **Working dir:** all `web/` commands `pnpm -C web …` from repo root (cwd drifts). Installs use `pnpm -C web add --ignore-workspace …`. Branch `rewrite/web-foundation` — do NOT branch. Touch only `web/**` (+ `e2e/` for E2E + the **cutover-only** root edits in Tasks 12–13, which are CONFIG, not legacy `src/` code). NEVER modify legacy `src/`, `functions/`, `firestore.rules`, `firestore.indexes.json`, or any deployed cloud resource. Cloud Functions / Firestore rules / indexes are FROZEN (NFR-1). **NEVER run `firebase deploy`, `firebase hosting:*`, `gulp release` against prod, `webstore upload/publish`, or any command that mutates a cloud/store resource** — every deploy/publish action in this plan is written as a **manual step the user performs** (Safety Rules 1+2; push-back skill applies).
- **DESIGN SYSTEM (mandatory for every UI task):** build from `web/src/ui/` primitives (`Button`, `IconButton`, `cn`, etc.) + Tailwind semantic tokens per `docs/superpowers/specs/2026-06-07-design-system.md`. The embed header sits on **ink** (it frames the preview-dominant view); any embed-mode notice/dialog on **paper** with `shadow-pop`. `font-mono` for the "edit on app.zenuml.com" affordance metadata, `font-serif` for any headline. No `gray-*`/raw hex/ad-hoc fonts. Keep `data-testid`s. The options page (`web/extension-src/options.html`) is a **standalone non-React HTML page** (loaded by Chrome outside the SPA) — it does NOT use the React design system; keep it minimal and parity with legacy `src/extension/options.html` (it is NOT app-chrome).
- **What M00–M04 already give you (consume, do not rebuild):**
  - `app/runtimeMode.ts` — `detectRuntimeMode({search,isExtension,isDesktop})` + `detectFromEnv()` returning `{ isEmbed, isShared, isExtension, isDesktop, itemId, shareToken }`. (`isEmbed = ?embed` present; `isExtension = window.IS_EXTENSION || protocol === 'chrome-extension:'`.)
  - `config/firebaseConfig.ts` — extension hosts (Chrome `kcpganeflmhffnlofpdmcjklmdpbbmef`-style id host + two Edge ids) all map to the **prod** project with `features.payment:false`. **DO NOT change these.**
  - `services/analytics.ts` — `emit(ctx)` where `ctx.isExtension` skips the CDN client push and `ctx.debug` routes to console; `loadClientAnalytics({isExtension})` is a documented stub (the M04 deferral). M05 does NOT un-stub it.
  - `services/storage.ts` — `syncStore` (settings) auto-backs to `chrome.storage.sync` when `chrome.storage.sync` exists, else `localStorage`. `localStore` (item cache / flags) is always `localStorage`.
  - `services/cloudFunctions.ts` — `createShare(id)` POSTs EXACTLY `{ id, token, origin: window.location.origin }` (verified ground truth — three fields, nothing else) and returns `{ url, md5 }`. **M05 changes ONLY the `origin` SOURCE** (Task 4). **M05 MUST NOT add `name`/`content`/`description` to the body.** (Contract §5.1 lists a richer body, but shipped M03 sends only `{ id, token, origin }`. That M03-vs-§5.1 divergence is an EXISTING, OUT-OF-SCOPE finding — record it in roadmap §9 in Task 1, do NOT "fix" it here. Adding fields in M05 would be unverified scope creep and a silent body-shape mutation.)
  - `components/header/*`, `components/modals/*`, `components/library/*`, `components/share/*`, `Layout.tsx`, `PreviewFrame` (consumes `code`, `stickyOffset`), `AppRoot.tsx` (boot, runtime detection via `detectFromEnv().isExtension`, stickyOffset via `params.get`).
  - `config/constants.ts` — `APP_VERSION = '1.0.25'` (the version the extension manifest + options page surface; M05 owns release versioning per the M04 §9 note).
- **Legacy ground truth for parity (READ-ONLY):**
  - Extension worker: `src/extension/eventPage.js` (icon-click `chrome.tabs.create(index.html)`, new-tab override gated on `chrome.storage.sync.replaceNewTab`, on-install open, uninstall-URL).
  - Options page: `src/extension/options.html` + `src/extension/options.js` (two checkboxes → `chrome.storage.sync`).
  - Manifest: `static/manifest.json` (MV3, `permissions:["storage"]`, `options_ui`, `action`, `background.service_worker:"eventPage.js"`, icons).
  - Build/zip: `gulpfile.cjs` `release` task (copies `dist/**` → `app/`, then `cp -R app/ extension`, drops `static/manifest.json` + `src/extension/{options.*,eventPage.js,script.js}` into `extension/`, zips → `extension.zip`).
  - Hosting: `firebase.json` `hosting.public:"app"` (the legacy gulp-assembled dir) + 6 function rewrites. Root `package.json`: `build` = `vite build` (legacy), `release` = `gulp release`, `deploy:prod` = `firebase deploy --project prod`.
  - Embed/code params: contract §8 URL-parameter table (`code` inline source, `title`, `embed`, `stickyOffset`).

### Key facts (ground truth — match EXACTLY)

- **Embed (RM-2 / REQ-EMB-1):** `?embed` present → hide the main header + sidebar + all modals; disable global keyboard shortcuts; show a minimal **embed header** with a link to open the same diagram in the full editor at the canonical app origin; **no save/auth UI**. Support `?code=<inline DSL>` (render-by-value, no Firestore read), `?title=`, `?stickyOffset=` (already passed to the renderer). Embed is read-mostly: the editor pane may be hidden or shown read-only — **legacy parity = preview-dominant; default to hiding the editor in embed unless `?code` is absent and an item is loaded** (confirm against legacy `app.jsx` embed handling during Task 5; if legacy shows a read-only editor, match that).
- **Shared read-only (RM-3) is ALREADY built** (M02 boot + M03 fork-from-shared). M05 does NOT re-implement it; it only ensures embed + shared compose (an `?embed&id=&share-token=` URL is embed-mode AND read-only).
- **Extension (RM-4 / REQ-EXT-1):** MV3, `permissions:["storage"]` only. Background service worker opens `index.html` on icon click; optionally overrides `chrome://newtab/` when `chrome.storage.sync.replaceNewTab` is true. Options page edits `preserveLastCode` + `replaceNewTab` directly in `chrome.storage.sync` (the same keys the app reads via `syncStore`). Billing is hidden (payment flag already false on extension hosts — DO NOT re-gate). CDN scripts skipped (already gated). The extension loads the EXACT `web/dist` SPA bundle — no separate React build.
- **Share-link origin (M05 §9 deferral — MUST FIX):** under the extension, `window.location.origin === 'chrome-extension://<id>'`. A share URL on that host is unreachable. `createShare` MUST send the **canonical web origin** (`https://app.zenuml.com`) when running under the extension, NOT `chrome-extension://…`. The web app keeps sending its real `window.location.origin` (correct for app/staging/preview). Implement via a `shareOrigin()` helper (Task 4): `isExtension ? CANONICAL_APP_ORIGIN : window.location.origin`.
- **Cutover (roadmap §1.1 / contract §10):** repoint production hosting from `app/` (legacy gulp output) to `web/dist`. The contract §10 cutover checklist obligates: keep the 6 function rewrites, preserve all client storage keys + one-time-prompt flags + the URL-parameter contract, and preserve the `@zenuml/core` asset-URL correctness (the production-build asset spec guards this). **The cutover change is CONFIG ONLY** (`firebase.json` `hosting.public` + root build scripts) and is delivered as a **reversible, dry-run-verified diff the user applies + deploys manually** — with the legacy `app/` pipeline left intact for rollback until the user confirms the new path is live and green. **Legacy `src/` is NOT deleted in this milestone** (roadmap §1.1: retire legacy only after cutover is confirmed; record the deletion as a follow-up, do not perform it here unless the user explicitly approves a separate step).

### Deferred (recorded, not silently dropped) — record in roadmap §9 in Task 1

- **Desktop host (RM-5)** is specified but has no current consumer (no `window.zenumlDesktop` integration ships in M05) — `runtimeMode.isDesktop` is detected and the header is hidden when true, but the injected item service (roadmap §3 mention) is NOT built (no desktop product in scope). Record as deferred.
- **`loadClientAnalytics` un-stub + GTM-local-for-extension** (contract §6.3: "GTM has a local copy for the extension") → stays the M04-recorded deferral; M05 does NOT inject the local GTM. The extension simply runs with `loadClientAnalytics` as a no-op stub (server-side `/track` still fires). Record.
- **`lastSeenVersion` Firestore `users/{uid}` mirror + `onboarded`/`pledgeModalSeen` cross-device story** (M04 §9 deferrals) → re-confirm in Task 14 whether the extension's `chrome.storage.sync` now closes the gap; if the Firestore mirror is still unwritten, keep it deferred (it is a legacy `db.js:141-146` write, not required for extension parity). Record the decision.
- **Legacy `src/` deletion / old-config retirement** → follow-up after the user confirms the cutover is live (NOT performed in this plan). Record.

---

## File structure (this milestone)

```
web/
  src/
    config/
      shareOrigin.ts          # (add) CANONICAL_APP_ORIGIN + shareOrigin({isExtension}) — origin sent to /create-share
    services/
      cloudFunctions.ts       # (modify) createShare takes/uses shareOrigin instead of window.location.origin directly
    app/
      runtimeMode.ts          # (verify/extend) ensure isEmbed/code/title parsing exposed (add embedCode/embedTitle if needed)
      AppRoot.tsx             # (modify) embed branch: suppress header/sidebar/modals/shortcuts; render EmbedHeader; honor ?code/?title; wire shareOrigin into createShare
    components/
      embed/
        EmbedHeader.tsx       # (add) minimal embed header — title + "Open in ZenUML" link to canonical app
        EmbedView.tsx         # (add, optional) presentational embed layout shell (EmbedHeader + PreviewFrame), keeps AppRoot thin
  extension-src/              # (add) static MV3 assets copied alongside web/dist into the package
    manifest.json            #   MV3 manifest (storage perm, options_ui, action, background worker, icons) — version from APP_VERSION
    eventPage.js             #   service worker: icon-click open, new-tab override, on-install open, uninstall URL
    options.html             #   standalone options page (NOT React)
    options.js               #   options page logic → chrome.storage.sync
  scripts/
    build-extension.mjs      # (add) build web/dist + assemble web/extension/ (dist + extension-src + icons + manifest) + zip → web/extension.zip
  package.json               # (modify) add scripts: build:extension, (web stays self-contained)

# CUTOVER (config-only, Tasks 12–13 — delivered as a reversible diff the USER applies + deploys):
firebase.json                # (cutover) hosting.public: "app" → "web/dist" (keep 6 rewrites verbatim); documented + reversible
package.json (root)          # (cutover) build/release/deploy notes pointing at web/dist; legacy app/ pipeline retained for rollback
docs/superpowers/runbooks/2026-06-06-web-sequence-production-cutover.md   # (add) the manual cutover + rollback runbook
```

---

### Task 1: Record M05 scope deferrals in roadmap §9

**Files:** Modify `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md`

- [ ] **Step 1:** Append to roadmap "## 9. Adversarial-review carry-forward":
```markdown
- **M05 scope boundaries (recorded).** Embed mode (RM-2/REQ-EMB-1) + MV3 extension (RM-4/REQ-EXT-1) + share-link origin override (resolves the prior "M05 — extension share-link origin" deferral) + production cutover (config-only repoint of `firebase.json hosting.public` → `web/dist`, delivered as a reversible manual runbook — NO deploy performed). DEFERRED beyond M05: Desktop host RM-5 injected item service (no desktop product in scope — `isDesktop` is detected + hides the header, but no injected service ships). `loadClientAnalytics` un-stub + GTM-local-for-extension (contract §6.3) stays the M04 deferral — the extension runs with the analytics stub (server-side `/track` still fires). `lastSeenVersion` Firestore `users/{uid}` mirror stays deferred (legacy `db.js` write, not required for extension parity; `chrome.storage.sync` covers cross-device prefs). Legacy `src/` deletion + old-config retirement is a follow-up AFTER the user confirms the cutover is live — NOT performed in M05.
- **createShare body: §5.1-vs-shipped divergence (recorded, OUT OF SCOPE for M05).** Contract §5.1 describes a `/create-share` body of `{ token, id, name, content, description, origin }`, but the shipped M03 client (`web/src/services/cloudFunctions.ts`) sends ONLY `{ id, token, origin }`. M05 changes ONLY the `origin` SOURCE (canonical-origin override for the extension) and intentionally does NOT add `name`/`content`/`description` — adding them would be unverified scope creep and a silent body-shape mutation. Whether the client should grow to match §5.1 (or §5.1 should be corrected to the shipped shape) is a SEPARATE client-vs-contract reconciliation, deferred. Flagged here so a later implementer does not "fix" it inside M05.
```
- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md
git commit -m "docs(m05): record extension/embed/cutover scope deferrals in roadmap §9"
```

---

### Task 2: shareOrigin config helper (canonical origin + extension override)

**Files:** Create `web/src/config/shareOrigin.ts`, Test `web/src/config/shareOrigin.test.ts`

> Pure, framework-agnostic. `CANONICAL_APP_ORIGIN = 'https://app.zenuml.com'`. `shareOrigin({ isExtension }, locationOrigin)` → the extension origin override (resolves the §9 deferral). Inject `locationOrigin` (default `window.location.origin`) for testability — never read `window` at module scope.

- [ ] **Step 1: Failing test** `web/src/config/shareOrigin.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CANONICAL_APP_ORIGIN, shareOrigin } from './shareOrigin';

describe('shareOrigin', () => {
  it('web app: uses the real location origin', () => {
    expect(shareOrigin({ isExtension: false }, 'https://staging.zenuml.com')).toBe('https://staging.zenuml.com');
    expect(shareOrigin({ isExtension: false }, 'http://localhost:3000')).toBe('http://localhost:3000');
  });
  it('extension: overrides chrome-extension:// with the canonical app origin (resolves §9 deferral)', () => {
    expect(shareOrigin({ isExtension: true }, 'chrome-extension://abcdef')).toBe(CANONICAL_APP_ORIGIN);
    expect(CANONICAL_APP_ORIGIN).toBe('https://app.zenuml.com');
  });
});
```
- [ ] **Step 2: Run** `pnpm -C web test src/config/shareOrigin.test.ts` → FAIL.
- [ ] **Step 3: Implement** `web/src/config/shareOrigin.ts`:
```ts
// The canonical public web origin. Share links must point here so they are
// reachable — never at chrome-extension://<id> (M05 §9 deferral). The backend
// /create-share builds page_share from the `origin` we send (contract §5.1).
export const CANONICAL_APP_ORIGIN = 'https://app.zenuml.com';

export function shareOrigin(
  ctx: { isExtension: boolean },
  locationOrigin: string = typeof window !== 'undefined' ? window.location.origin : CANONICAL_APP_ORIGIN,
): string {
  // Under the extension, window.location.origin is chrome-extension://<id> — an
  // unreachable share host. Override with the canonical web origin. The web app
  // sends its real origin (correct for app/staging/preview deploys).
  return ctx.isExtension ? CANONICAL_APP_ORIGIN : locationOrigin;
}
```
- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/config/shareOrigin.ts web/src/config/shareOrigin.test.ts
git commit -m "feat(m05): shareOrigin — canonical-origin override for extension share links (resolves §9 deferral)"
```

---

### Task 3: runtimeMode — expose embed inline params (code / title)

**Files:** Modify `web/src/app/runtimeMode.ts`, extend `web/src/app/runtimeMode.test.ts`

> `detectRuntimeMode` already returns `isEmbed/isShared/isExtension/isDesktop/itemId/shareToken`. Add the embed-by-value params from the contract §8 table: `embedCode` (`?code=`, inline DSL) and `embedTitle` (`?title=`). Keep them on the returned object so AppRoot reads them from one typed place (pays down NFR-3 ad-hoc `params.get` debt for embed).

- [ ] **Step 1: Extend the test** `web/src/app/runtimeMode.test.ts` (append):
```ts
describe('detectRuntimeMode — embed inline params (contract §8)', () => {
  it('parses ?code and ?title for embed-by-value', () => {
    const m = detectRuntimeMode({ search: '?embed&code=A.method()&title=Demo', isExtension: false, isDesktop: false });
    expect(m.isEmbed).toBe(true);
    expect(m.embedCode).toBe('A.method()');
    expect(m.embedTitle).toBe('Demo');
  });
  it('embedCode/embedTitle are null when absent', () => {
    const m = detectRuntimeMode({ search: '?embed', isExtension: false, isDesktop: false });
    expect(m.embedCode).toBeNull();
    expect(m.embedTitle).toBeNull();
  });
  it('embed composes with shared read-only (?embed&id=&share-token=)', () => {
    const m = detectRuntimeMode({ search: '?embed&id=x&share-token=t', isExtension: false, isDesktop: false });
    expect(m.isEmbed).toBe(true);
    expect(m.isShared).toBe(true);
    expect(m.itemId).toBe('x');
  });
});
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — add `embedCode: string | null; embedTitle: string | null;` to `RuntimeMode`, and in `detectRuntimeMode`:
```ts
    embedCode: p.get('code'),
    embedTitle: p.get('title'),
```
- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/src/app/runtimeMode.ts web/src/app/runtimeMode.test.ts
git commit -m "feat(m05): runtimeMode exposes embed ?code/?title inline params (contract §8, REQ-EMB-1)"
```

---

### Task 4: createShare — use shareOrigin (extension origin override)

**Files:** Modify `web/src/services/cloudFunctions.ts`, extend `web/src/services/cloudFunctions.test.ts`, extend `web/src/hooks/useShare.test.tsx` (the through-`useShare` seam test)

> `createShare` currently hardcodes `origin: window.location.origin`. Change it to derive the origin from `shareOrigin({ isExtension })` so the extension sends the canonical web origin. **Keep the body shape EXACT — the shipped M03 body is `{ id, token, origin }` and ONLY those three fields. M05 changes ONLY the `origin` SOURCE; it MUST NOT add `name`/`content`/`description`.** (The contract §5.1 body is richer than what M03 ships — that is a pre-existing client-vs-contract divergence; it is OUT OF SCOPE for M05 and recorded as a finding in roadmap §9 (Task 1), NOT silently introduced here. Do not let §5.1's field list tempt a body-shape mutation.) Inject `isExtension` (default `detectFromEnv().isExtension`) so the test can drive both branches without touching `window.location.protocol`.

- [ ] **Step 1: Extend the test** `web/src/services/cloudFunctions.test.ts` (append; reuse the existing MSW `server` + `${window.location.origin}/create-share` handler convention):
```ts
describe('createShare — origin source (M05)', () => {
  it('web app: sends window.location.origin', async () => {
    let captured: any;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = await request.json();
      return HttpResponse.json({ page_share: 'http://localhost?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1', { isExtension: false });
    expect(captured.origin).toBe(window.location.origin);
  });
  it('extension: sends the canonical app origin, NOT chrome-extension://', async () => {
    let captured: any;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = await request.json();
      return HttpResponse.json({ page_share: 'https://app.zenuml.com?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1', { isExtension: true });
    expect(captured.origin).toBe('https://app.zenuml.com');
  });

  // NO-OPTS DEFAULT (discriminating for the lazy default — the two tests above pass an
  // EXPLICIT opts; this one passes NONE, exercising `opts.isExtension ?? detectFromEnv()
  // .isExtension`). Stub env so detectFromEnv().isExtension === true WITHOUT passing opts
  // (match however existing tests stub runtime — e.g. window.location.protocol =
  // 'chrome-extension:' via the test's location mock, or vi.mock('../app/runtimeMode', …)).
  it('no-opts default: under the extension env, createShare(id) sends app.zenuml.com', async () => {
    let captured: any;
    server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
      captured = await request.json();
      return HttpResponse.json({ page_share: 'https://app.zenuml.com?id=item-1&share-token=tok', md5: 'abc' });
    }));
    await createShare('item-1'); // NO opts — exercises the detectFromEnv() default
    expect(captured.origin).toBe('https://app.zenuml.com');
    // Revert (hardcode origin back / resolve env at module load) → this FAILS.
  });
});
```
**THROUGH-`useShare` SEAM TEST (REQUIRED — this is the one the critique demanded; the no-opts test above does NOT traverse the seam).** The exact gap is: `UseShareOpts.createShare` is typed `(id: string) => Promise<…>` and AppRoot.tsx:612 passes the BARE `createShare` reference — no `{ isExtension }` is threaded — so the real share path resolves env ONLY via `createShare`'s lazy default. A `createShare`-only test cannot catch a regression in the *wiring*. Add a test that drives `share()` through `useShare` with the **real** `createShare` injected and the extension env stubbed. Put it in `web/src/hooks/useShare.test.tsx` (it already pins at :36 that `useShare` calls `createShare` with a bare id) — or in `AppRoot.test.tsx`:
```ts
// web/src/hooks/useShare.test.tsx — REAL createShare through the useShare seam (M05)
import { createShare } from '../services/cloudFunctions';
// + the project's MSW `server` import/setup used by cloudFunctions.test
it('extension env: share() through useShare with the REAL createShare sends app.zenuml.com (end-to-end seam)', async () => {
  // Stub env so detectFromEnv().isExtension === true (same mechanism as the no-opts test).
  let captured: any;
  server.use(http.post(`${window.location.origin}/create-share`, async ({ request }) => {
    captured = await request.json();
    return HttpResponse.json({ page_share: 'https://app.zenuml.com?id=item-1&share-token=tok', md5: 'abc' });
  }));
  const { result } = renderHook(() =>
    useShare(makeOpts({ createShare /* REAL, bare ref — exactly AppRoot.tsx:612 */ })),
  );
  await act(async () => { await result.current.share(); });
  expect(captured.origin).toBe('https://app.zenuml.com');
  // Discriminating: revert createShare's lazy default, OR rewire useShare to drop the
  // bare-ref pass-through → captured.origin becomes chrome-extension://… → FAILS.
});
```
(If `createShare`'s existing signature is `createShare(id)`, change it to `createShare(id, opts: { isExtension?: boolean } = {})` with the default deriving from `detectFromEnv().isExtension` — keep every existing call site working by leaving `opts` optional. **DO NOT change `UseShareOpts.createShare`'s type (`(id: string) => Promise<…>`) or thread `isExtension` through `useShare`** — AppRoot.tsx:612 passes the bare `createShare` reference, and the extension override flows through the LAZY `detectFromEnv()` default at call time, which the through-`useShare` seam test above guards end-to-end. Document this lazy-default reliance in a `createShare` comment (env is resolved at CALL time, not module load, precisely so the bare reference works under the extension). Update existing M03 tests only if they assert the old `origin` field VALUE; do NOT weaken them.)

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — import `shareOrigin` + `detectFromEnv`; replace `origin: window.location.origin` with `origin: shareOrigin({ isExtension: opts.isExtension ?? detectFromEnv().isExtension })`. The `?? detectFromEnv().isExtension` MUST be evaluated INSIDE the function body (call time), NOT captured at module load — AppRoot passes the bare `createShare` reference through `useShare`, so the lazy default is the only thing making the extension override work end-to-end. Add a comment saying exactly that. Keep the body shape EXACTLY `{ id, token, origin }` (do NOT add fields) and the md5 cache-buster URL assembly unchanged.
- [ ] **Step 4: Run** → PASS (incl. the M03 createShare tests AND the through-`useShare` seam test). **Step 5: Commit**
```bash
git add web/src/services/cloudFunctions.ts web/src/services/cloudFunctions.test.ts web/src/hooks/useShare.test.tsx
git commit -m "feat(m05): createShare uses shareOrigin so extension links point at app.zenuml.com (REQ-EXT-1)"
```

---

### Task 5: EmbedHeader (presentational minimal embed header)

**Files:** Create `web/src/components/embed/EmbedHeader.tsx`, Test `web/src/components/embed/EmbedHeader.test.tsx`

> DESIGN SYSTEM, on **ink**. Presentational: shows the diagram `title` (or a default) and an "Open in ZenUML" affordance that links to the full editor for the same diagram at the canonical app origin. NO save/auth/library/share controls (embed has none). Props: `{ title?: string, openUrl: string }`. The link uses `target="_blank" rel="noopener"`. `data-testid`s: `embed-header`, `embed-title`, `embed-open-link`. Use `font-serif` for the title, `font-mono` for the link label; the `accent` token on the link.

- [ ] **Step 1: Failing test** — renders the title (and a sensible default when omitted); the open-link has the given `openUrl` href, `target="_blank"`, `rel` contains `noopener`; carries the testids; no save/auth/library testids present.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the presentational component (Button/anchor styled per design system; no `gray-*`/hex).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git commit -m "feat(m05): EmbedHeader — minimal embed header + open-in-app link (REQ-EMB-1)"
```

---

### Task 6: AppRoot embed branch (suppress chrome, honor ?code/?title, shortcuts off)

**Files:** Modify `web/src/app/AppRoot.tsx`, extend `web/src/app/AppRoot.test.tsx`

> When `runtime.isEmbed`: (a) do NOT render the main header, sidebar, or any modal; (b) render `<EmbedHeader title=… openUrl=…>` + the preview (and editor per legacy parity — default preview-dominant, editor hidden; if legacy `app.jsx` shows a read-only editor in embed, match it — verify during this task); (c) global keyboard shortcuts are disabled (gate the keyboard-shortcuts hook/effect on `!isEmbed`); (d) if `embedCode` is present, render BY VALUE (feed `embedCode` to the preview as the DSL, set the title from `embedTitle`) WITHOUT a Firestore read; (e) `openUrl` = `${CANONICAL_APP_ORIGIN}/?` + the same `id`/`share-token` (shared embed) OR `code`/`title` (by-value embed) so "Open in ZenUML" reproduces the diagram in the full editor. Embed composes with shared read-only (already built) — an `?embed&id=&share-token=` URL loads the shared item read-only inside the embed shell.

- [ ] **Step 1: Extend the test** `web/src/app/AppRoot.test.tsx`:
```ts
describe('AppRoot — embed mode (RM-2 / REQ-EMB-1)', () => {
  // DISCRIMINATING-TESTID CONTRACT (ground truth — verified against the code, do NOT
  // invent ids). AppHeader exposes `header-title`/`header-menu`/`header-new`/`header-save`
  // (there is NO `app-header` id). Sidebar exposes `sidebar-${panel}` (e.g. `sidebar-files`;
  // there is NO bare `sidebar` id). A test that queries a non-existent id returns null
  // whether or not the chrome renders — it CANNOT fail if embed suppression breaks
  // (revert→still-green = vacuous). The embed assertions therefore MUST use REAL ids that
  // are PRESENT in normal mode so their ABSENCE in embed is a genuine signal.
  //
  // First, PIN the discriminator with a control assertion in NORMAL (non-embed) mode so a
  // reviewer (and revert→fail) can see the id actually exists when chrome renders:
  it('CONTROL: normal (non-embed) mode renders the real header + a sidebar panel', () => {
    // render AppRoot with search '' (or runtime { isEmbed:false }); these MUST be present:
    // getByTestId('header-title'); getByTestId('header-menu');
    // getByTestId(/^sidebar-/)  (at least one sidebar-<panel> node, e.g. 'sidebar-files')
    // — if any of these is already null in normal mode, the discriminator below is broken;
    //   STOP and pick a different real id rather than weakening the embed test.
  });
  it('?embed hides the real header + sidebar and shows the embed header', () => {
    // render AppRoot with window.location.search = '?embed&code=A.b&title=Demo' (or inject runtime)
    // DISCRIMINATING absence (these ids EXIST in normal mode per the control above):
    //   expect(queryByTestId('header-title')).toBeNull();
    //   expect(queryByTestId('header-menu')).toBeNull();
    //   expect(queryAllByTestId(/^sidebar-/)).toHaveLength(0);  // no sidebar-<panel> rendered
    // Presence of the embed shell:
    //   getByTestId('embed-header') present;
    //   getByTestId('embed-open-link') href starts with CANONICAL_APP_ORIGIN.
    // (Revert the embed branch → header-title/header-menu/sidebar-* reappear → this FAILS.
    //  That is the integrity guarantee the old `app-header`/`sidebar` ids could not give.)
  });
  it('?embed&code= renders by value without a Firestore read', () => {
    // assert getItem / subscribeAllItems NOT called; preview receives the inline code
  });
  it('?embed disables global keyboard shortcuts', () => {
    // fire the shortcut that opens a modal in normal mode; assert no modal opens in embed
  });
  it('?embed&id=&share-token= composes embed + shared read-only', () => {
    // assert embed-header present AND the shared item loads read-only (no save UI)
  });
});
```
(Mirror the existing AppRoot test setup for runtime/search injection — reuse how M02/M03/M04 tests drive `window.location.search` or the runtime. Portals: modals render in a portal — assert absence via `queryByTestId` against `document`.)

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the embed branch in `AppRoot`: read `runtime = detectFromEnv()` (already used for `isExtension`); when `runtime.isEmbed`, short-circuit the normal layout to the embed shell, gate the shortcuts hook on `!runtime.isEmbed`, build `openUrl` from the canonical origin + the live params, and feed `embedCode`/`embedTitle` to the preview when present. Keep the existing non-embed path untouched.
- [ ] **Step 4: Run** FULL `pnpm -C web test` + `pnpm -C web typecheck` → green. **Step 5: Commit**
```bash
git commit -m "feat(m05): AppRoot embed branch — suppress chrome, ?code by-value, shortcuts off, open-in-app (REQ-EMB-1, RM-2)"
```

---

### Task 7: Extension manifest (MV3) — version-synced

**Files:** Create `web/extension-src/manifest.json`, Test `web/scripts/manifest.test.ts` (a Vitest unit that imports the JSON + `APP_VERSION` and asserts shape)

> Parity with legacy `static/manifest.json` (MV3, `permissions:["storage"]`, `options_ui`, `action`, `background.service_worker:"eventPage.js"`, icons), with the **version derived from `config/constants.ts APP_VERSION`** (the M04 §9 note: the rewrite owns versioning in M05). Keep it static JSON; a unit test guards the required fields + version match (the build script in Task 11 stamps the version into the copied manifest, so the test asserts the SOURCE is well-formed and the constant exists).

- [ ] **Step 1: Failing test** `web/scripts/manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import manifest from '../extension-src/manifest.json';

describe('extension manifest (MV3)', () => {
  it('is manifest v3 with storage-only permission', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['storage']);
  });
  it('declares the background service worker, action, options page, and icons', () => {
    expect(manifest.background.service_worker).toBe('eventPage.js');
    expect(manifest.action).toBeDefined();
    expect(manifest.options_ui.page).toBe('options.html');
    expect(manifest.icons).toBeDefined();
  });
});
```
- [ ] **Step 2: Run** → FAIL (file missing).
- [ ] **Step 3: Implement** `web/extension-src/manifest.json` — copy the legacy `static/manifest.json` shape verbatim (name "ZenUML Sequence", description, MV3, `permissions:["storage"]`, `options_ui.page:"options.html" open_in_tab:false`, `action` with title + icons, `background.service_worker:"eventPage.js"`, `icons`). Use a placeholder `"version": "1.0.25"` matching `APP_VERSION` (the build script will overwrite it from the constant in Task 11). Icon filenames must match the icons the build script copies (Task 11 sources them from the legacy `static/` icons — `icon-16.png`, `icon-48.png`, `favicon-128x128.png`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add web/extension-src/manifest.json web/scripts/manifest.test.ts
git commit -m "feat(m05): MV3 extension manifest (storage-only, options, worker, icons) (REQ-EXT-1)"
```

---

### Task 8: Extension background service worker

**Files:** Create `web/extension-src/eventPage.js`, Test `web/extension-src/eventPage.test.js` (Vitest with a mocked `chrome` global)

> Parity with legacy `src/extension/eventPage.js`: icon-click → `chrome.tabs.create({url: chrome.runtime.getURL('index.html')})`; `chrome.tabs.onCreated` for `chrome://newtab/` → read `chrome.storage.sync.replaceNewTab` → if true, update the tab to the app; `onInstalled` reason `install` → open the app; `setUninstallURL`. The worker is plain JS (runs in the MV3 worker context, NOT bundled by Vite). Make the handler functions importable/testable: export `openApp`, `handleTabCreated`, `handleInstalled` (or attach via a small registration fn) so the test can drive them with a mocked `chrome`.

- [ ] **Step 1: Failing test** `web/extension-src/eventPage.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openApp, handleTabCreated, handleInstalled } from './eventPage.js';

let chromeMock;
beforeEach(() => {
  chromeMock = {
    tabs: { create: vi.fn(), update: vi.fn(), onCreated: { addListener: vi.fn() } },
    runtime: { getURL: vi.fn((p) => `chrome-extension://id/${p}`), onInstalled: { addListener: vi.fn() }, setUninstallURL: vi.fn() },
    storage: { sync: { get: vi.fn((defaults, cb) => cb({ replaceNewTab: true })) } },
    action: { onClicked: { addListener: vi.fn() } },
  };
  globalThis.chrome = chromeMock;
});

describe('extension service worker', () => {
  it('openApp creates a tab at index.html', () => {
    openApp();
    expect(chromeMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'chrome-extension://id/index.html' }));
  });
  it('new-tab override fires only when replaceNewTab is true', () => {
    handleTabCreated({ id: 7, url: 'chrome://newtab/' });
    expect(chromeMock.tabs.update).toHaveBeenCalledWith(7, expect.objectContaining({ url: 'chrome-extension://id/index.html' }), expect.any(Function));
  });
  it('new-tab override does NOT fire when replaceNewTab is false', () => {
    chromeMock.storage.sync.get = vi.fn((d, cb) => cb({ replaceNewTab: false }));
    handleTabCreated({ id: 7, url: 'chrome://newtab/' });
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });
  it('onInstalled(install) opens the app', () => {
    handleInstalled({ reason: 'install' });
    expect(chromeMock.tabs.create).toHaveBeenCalled();
  });
});
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `web/extension-src/eventPage.js` — export `openApp`, `handleTabCreated(tab)`, `handleInstalled(details)`, and at module load register them (`chrome.action.onClicked.addListener(openApp)`, `chrome.tabs.onCreated.addListener(handleTabCreated)`, `chrome.runtime.onInstalled.addListener(handleInstalled)`, `chrome.runtime.setUninstallURL(...)`) GUARDED by `typeof chrome !== 'undefined' && chrome.action` so importing it in the test doesn't throw. Parity uninstall URL with legacy.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git commit -m "feat(m05): extension service worker — open-on-click, new-tab override, on-install (REQ-EXT-1)"
```

---

### Task 9: Extension options page

**Files:** Create `web/extension-src/options.html` + `web/extension-src/options.js`, Test `web/extension-src/options.test.js` (Vitest + jsdom, mocked `chrome`)

> Parity with legacy `src/extension/options.{html,js}`: two checkboxes — `preserveLastCode` (default true) + `replaceNewTab` (default false) — restored from `chrome.storage.sync` on load, saved back on submit with a transient "Settings saved." status. These are the SAME keys the app reads via `syncStore`. Standalone HTML (Chrome loads it outside the SPA) — minimal styling, NOT the React design system. Show `APP_VERSION` in the heading. Make `restoreOptions`/`saveOptions` exported/testable.

- [ ] **Step 1: Failing test** `web/extension-src/options.test.js` — set up a jsdom form (or load the html), mock `chrome.storage.sync.get/set`; assert `restoreOptions` reflects stored values into the checkboxes; `saveOptions` writes both keys to `chrome.storage.sync.set` and shows the status text.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `options.html` (parity markup, single version heading — drop the legacy duplicate `<h3>`) + `options.js` (`restoreOptions`/`saveOptions`, exported; DOM wiring guarded for the test).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit**
```bash
git commit -m "feat(m05): extension options page — preserveLastCode + replaceNewTab via chrome.storage.sync (REQ-EXT-1)"
```

---

### Task 10: IS_EXTENSION bootstrap for the extension build

**Files:** Modify `web/index.html` (or add `web/extension-src/ext-boot.js` injected into the packaged `index.html` by the build script), Test covered by Task 11's build-output assertion

> The SPA detects the extension via `window.IS_EXTENSION` OR `location.protocol === 'chrome-extension:'`. The protocol check already covers the packaged extension (it runs from `chrome-extension://`), so **no `window.IS_EXTENSION` injection is strictly required** for detection. CONFIRM this during Task 6/11: `runtimeMode.detectFromEnv()` returns `isExtension:true` purely from the `chrome-extension:` protocol. If protocol detection is sufficient (it is, per `runtimeMode.ts`), this task is a **no-op verification** — record that in the commit/notes and skip injecting a global (avoid an unnecessary build-time HTML mutation). Only if a code path needs `window.IS_EXTENSION` earlier than `detectFromEnv` runs, add a tiny guarded boot script.

- [ ] **Step 1:** Verify (read `runtimeMode.ts` + grep the app for any pre-`detectFromEnv` extension assumption). If protocol detection suffices → no code change; note it.
- [ ] **Step 2:** If (and only if) a global is needed, add `web/extension-src/ext-boot.js` (`window.IS_EXTENSION = true;`) and have Task 11's build script inject `<script src="ext-boot.js"></script>` as the FIRST script in the packaged `index.html`.
- [ ] **Step 3: Commit (only if a change was made; otherwise fold the note into Task 11)**
```bash
git commit -m "chore(m05): confirm chrome-extension: protocol drives isExtension (no IS_EXTENSION global needed)"
```

---

### Task 11: build-extension script (assemble web/dist + extension-src → web/extension.zip)

**Files:** Create `web/scripts/build-extension.mjs`, modify `web/package.json` (add `build:extension`), Test `web/scripts/build-extension.test.mjs` (assemble into a temp dir without a real Vite build; OR a lighter unit testing the pure assemble/manifest-stamp functions)

> Parity with the legacy gulp zip flow, but self-contained in `web/`: (1) run `vite build` → `web/dist`; (2) assemble `web/extension/` = `web/dist/**` + `web/extension-src/{eventPage.js,options.html,options.js}` + `manifest.json` (with `version` stamped from `APP_VERSION`) + the icons (`icon-16.png`, `icon-48.png`, `favicon-128x128.png`) sourced from the legacy `static/` (READ-ONLY copy — we only READ legacy static assets, never modify them); (3) zip `web/extension/` → `web/extension.zip` (the asset CI attaches to a release). Use `node:fs`/`node:fs/promises` + a zip lib (`archiver`, install with `pnpm -C web add -D --ignore-workspace archiver`); OR shell out to `zip` if simpler — match whatever the repo already has. Keep the manifest-stamp + assemble logic as PURE functions so the test exercises them on a fixture dir without invoking Vite.

> Caveat to document inline: the packaged SPA must use **relative asset paths** (Chrome serves the extension from `chrome-extension://<id>/`). Confirm `web/vite.config.ts` build emits relative `./assets/...` references (set Vite `base: './'` for the extension build if the default `/` absolute base breaks under `chrome-extension://`). If a separate base is needed, the build script runs `vite build --base ./` for the extension variant. Verify the built `index.html` references are relative; add an assertion.

- [ ] **Step 1: Failing test** `web/scripts/build-extension.test.mjs` — import the pure `stampManifestVersion(manifestObj, version)` + `assembleExtension({distDir, extSrcDir, iconsDir, outDir})` from the script; run against a temp fixture (fake dist with an `index.html` + `assets/x.js`, the real `extension-src`, a fake icons dir); assert the out dir contains `manifest.json` (version === `APP_VERSION`), `eventPage.js`, `options.html`, `options.js`, `index.html`, the icons; assert the packaged `index.html` asset refs are relative (no leading `/assets/`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `build-extension.mjs` (export the pure fns + a `main()` that does vite build → assemble → zip). Add `"build:extension": "node scripts/build-extension.mjs"` to `web/package.json`. Set the extension build base to relative.
- [ ] **Step 4:** Run the unit test → PASS. Then run the REAL build once to prove end-to-end: `pnpm -C web build:extension` → assert `web/extension.zip` exists and `web/extension/manifest.json` version matches `APP_VERSION` (manual one-shot verification; do NOT upload/publish). **Step 5: Commit**
```bash
git add web/scripts/build-extension.mjs web/scripts/build-extension.test.mjs web/package.json
git commit -m "feat(m05): build-extension — package web/dist + MV3 assets → extension.zip (NFR-8, REQ-EXT-1)"
```

---

### Task 12: Production cutover — config diff (REVERSIBLE, dry-run-verified; user deploys)

**Files:** Modify `firebase.json` (`hosting.public`), modify root `package.json` (build/deploy scripts/notes) — **CONFIG ONLY**; NO deploy

> The cutover repoints hosting from the legacy gulp-assembled `app/` to `web/dist`. This is the riskiest, most irreversible-feeling step — so it is delivered as a **minimal, reversible config diff** that the USER applies + deploys manually (Safety Rules 1+2). Constraints (contract §10): keep the **6 function rewrites verbatim**; preserve storage keys / one-time-prompt flags / URL-parameter contract (already preserved by the app code — no change needed); preserve `@zenuml/core` asset-URL correctness (the production-build asset spec guards it — run it against `web/dist` in Task 13). The legacy `app/` pipeline + `firebase.json` original value are recorded for rollback; legacy `src/` is NOT deleted.

- [ ] **Step 1:** Edit `firebase.json` `hosting.public` from `"app"` → `"web/dist"`. Leave `hosting.rewrites` (all 6), `hosting.ignore`, `firestore`, `emulators`, `functions` UNCHANGED. (This is the entire hosting change — the 6 rewrites already match the same-origin function paths the app calls.)
- [ ] **Step 2:** Edit root `package.json` to make production builds produce `web/dist`: add a script (e.g. `"build:web": "pnpm -C web build"`) and a comment/README note that `deploy:prod`/`deploy:staging` now serve `web/dist` (the legacy `release`/gulp pipeline stays present for rollback — DO NOT delete it). Do NOT change `deploy:prod`/`deploy:staging` command targets (they already point at the right projects); only ensure the artifact built before deploy is `web/dist`.
- [ ] **Step 3:** **Dry-run verification (no deploy):**
  - `pnpm -C web build` → `web/dist` populated (incl. the asset-URL-shimmed `@zenuml/core` asset).
  - `firebase deploy --only hosting --project staging --dry-run` IF the installed firebase-tools supports `--dry-run`; otherwise verify config with `firebase hosting:channel:list` / `cat firebase.json` and STOP — do NOT run a real deploy.
  - Confirm `firebase.json` still lists all 6 rewrites (grep/read).
- [ ] **Step 4:** Do NOT deploy. **Step 5: Commit**
```bash
git add firebase.json package.json
git commit -m "chore(m05): cutover config — repoint Firebase hosting.public to web/dist (reversible; deploy is manual)"
```

---

### Task 13: Production cutover runbook (manual deploy + rollback + smoke)

**Files:** Create `docs/superpowers/runbooks/2026-06-06-web-sequence-production-cutover.md`

> A precise manual runbook the user follows to deploy the cutover and to roll back. Every cloud-mutating command is the USER's to run (push-back skill). Include: pre-deploy checklist (all unit/E2E green; `pnpm -C web build` clean; production-build asset spec green against `web/dist`; the 6 rewrites intact), the exact deploy commands (`firebase deploy --only hosting --project staging` → verify staging.zenuml.com → `firebase deploy --only hosting --project prod`), the post-deploy `@smoke` check (existing CI smoke spec against app.zenuml.com), and TWO rollback paths: (1) hosting-only fast rollback `firebase hosting:rollback --project prod`; (2) full revert of the Task-12 config diff (`git revert` the cutover commit → `hosting.public:"app"` → rebuild legacy `app/` via `gulp release` → redeploy). State that legacy `src/` + the `app/`/gulp pipeline are retained until the user confirms the new path is live and green, and that legacy deletion is a SEPARATE follow-up.

- [ ] **Step 1:** Write the runbook with the gates, exact commands (marked USER-RUN), the asset-spec gate, and both rollback paths. Cross-reference the existing release pipeline ADR (`docs/adr/0001-release-pipeline-imitating-conf-app.md`).
- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/runbooks/2026-06-06-web-sequence-production-cutover.md
git commit -m "docs(m05): production cutover runbook — manual deploy, smoke, dual rollback paths"
```

---

### Task 14: E2E — embed mode (local, no auth) + production-build asset spec against web/dist

**Files:** Create/extend `e2e/tests/embed.spec.js`; verify `e2e/tests/production-build.spec.js` (or equivalent) passes against `web/dist`

> Embed E2E needs no emulator: `?embed&code=…` renders by value, hides the main header/sidebar, shows the embed header + open-in-app link, and shortcuts are off. The production-build asset spec (the M01-greened guard for the `@zenuml/core` asset URL) must pass against the cutover artifact `web/dist`.

- [ ] **Step 1:** `embed.spec.js`: navigate to `/?embed&code=A.method()&title=Demo`; assert `embed-header` visible; assert the REAL chrome ids are absent — `getByTestId('header-title')`, `getByTestId('header-menu')` and every `sidebar-<panel>` (`page.getByTestId(/^sidebar-/)`) resolve to **0 matches** (these ids EXIST in normal mode, so their absence is a genuine signal; do NOT assert against `app-header`/`sidebar` — those ids do not exist and the assertion would pass vacuously). To pin the discriminator, FIRST navigate to `/` (normal mode) in a sibling `test()` and assert `header-title`/`header-menu`/at-least-one `sidebar-<panel>` ARE present, so revert→fail is observable. Then assert the preview renders the inline diagram (`#demo-frame` / preview testid shows content) and the `embed-open-link` href starts with `https://app.zenuml.com`. Add a shortcut-off check (a global shortcut that opens a modal in normal mode does nothing in embed). Note auth-gated combos (`?embed&id=&share-token=`) deferred to the staging gate.
- [ ] **Step 2:** Production-build asset check: `pnpm -C web build` then run the existing asset spec against the built `web/dist` (the spec that guards the `@zenuml/core` hashed-asset URL — confirm it points at `web/dist`, adjust the path if it still references the legacy `app/`/`dist`). Green.
- [ ] **Step 3:** Full gate: `pnpm -C web typecheck && pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green (incl. embed + M01–M04 specs). **Step 4: Commit**
```bash
git commit -m "test(m05): E2E embed-by-value (local) + production-build asset check against web/dist (NFR-8)"
```

---

### Task 15: Adversarial review of M05 surfaces

**Files:** none (review + fix)

- [ ] **Step 1:** Dispatch independent reviewers (parallel) against ground truth (legacy `src/extension/{eventPage.js,options.*,manifest}`, `static/manifest.json`, `gulpfile.cjs` release, `firebase.json`, `src/components/app.jsx` embed handling, contract §5.1/§7/§8/§10, roadmap §1.1/§9) over:
  1. **Embed surface** — header/sidebar/modal suppression complete (no leaked save/auth/library control); shortcuts genuinely off (not just visually); `?code` renders by value with NO Firestore read; `openUrl` reproduces the diagram at the canonical origin; embed composes with shared read-only; `?title` applied.
  2. **Extension build** — manifest MV3 correctness (storage-only perm, worker, options, icons present in the zip); service worker parity (open-on-click, new-tab override gated on `replaceNewTab`, on-install, uninstall URL); options page writes the exact `syncStore` keys; packaged SPA uses RELATIVE asset paths (loads under `chrome-extension://`); version stamped from `APP_VERSION`; CDN scripts skipped + payment off (confirm the existing seams still fire under the packaged protocol).
  3. **Share origin** — extension `createShare` sends `https://app.zenuml.com`, web sends real origin; the body is STILL EXACTLY `{ id, token, origin }` (the shipped M03 shape — confirm NO field was added/dropped/renamed, in particular NO `name`/`content`/`description` crept in from §5.1); md5 cache-buster URL unchanged. **Additionally verify the END-TO-END seam (see review-item 6): a share minted THROUGH `useShare`/`AppRoot` under the extension actually sends `app.zenuml.com` — not just the `createShare` unit.**
  4. **Cutover** — `firebase.json` keeps all 6 rewrites; `hosting.public` points at the asset-spec-verified `web/dist`; rollback paths are real and reversible; NO cloud resource was mutated by any task; legacy `src/`/`app/`/gulp untouched and retained.
  5. **Cross-cutting** — NFR-1 (no backend/legacy-`src/` change), design-system compliance in EmbedHeader, NFR-3 (embed reads params from typed `runtimeMode`, not ad-hoc `window.location.search`), no listener/subscription leaks introduced by the embed branch.
  6. **Share-origin END-TO-END seam** — confirm `createShare`'s extension override actually fires on the REAL path: AppRoot.tsx:612 passes the bare `createShare` through `useShare` with `UseShareOpts.createShare` typed `(id: string) => …` (NO `isExtension` threaded), so the override depends ENTIRELY on `createShare`'s lazy `detectFromEnv().isExtension` default being read at CALL time. Verify (a) the no-opts seam test exists and is discriminating (revert the lazy default → it fails), and (b) env is NOT resolved at module load anywhere in the `shareOrigin`/`createShare`/`detectFromEnv` chain (which would silently break the bare-reference path while keeping the explicit-opts unit tests green).
- [ ] **Step 2:** Triage; fix real findings with discriminating regression tests (revert→fail). Record deferrals in roadmap §9.
- [ ] **Step 3:** Commit fixes (one per fix, message references the review).

---

## Self-Review (completed during authoring)

**Spec coverage:** RM-2 / REQ-EMB-1 (embed minimal view, `?code`/`?title`/`?stickyOffset`, shortcuts off, open-in-app) → Tasks 3/5/6/14. RM-3 (shared read-only) reuses M02/M03 — composed with embed in 6. RM-4 / REQ-EXT-1 (MV3 worker, new-tab override, options, `chrome.storage.sync`, billing off, CDN skip) → Tasks 7/8/9/10/11 (consuming the M00–M04 firebaseConfig/analytics/storage seams). §9 extension-share-origin deferral → RESOLVED in Tasks 2/4. NFR-8 (web build + extension package + asset-URL correctness) → Tasks 11/14. Production cutover (roadmap §1.1, contract §10) → Tasks 12/13 (config-only + manual runbook + dual rollback, NO deploy). RM-5 desktop + GTM-local + Firestore `lastSeenVersion` mirror → recorded deferred in Task 1.

**Placeholders:** pure/service/config tasks (2/3/4/7/8/9/11) carry full code + tests; UI tasks (5/6) specify exact props/testids/TDD targets without dumping every line (presentational + an AppRoot branch — acceptable). The cutover (12/13) is intentionally a config diff + runbook, NOT executable deploy code (Safety Rules). No "TBD".

**Type consistency:** reuses canonical `Item`/`RuntimeMode`; `createShare` keeps its EXACT shipped M03 body shape `{ id, token, origin }` — only the `origin` SOURCE changes via `shareOrigin` (NO `name`/`content`/`description` added; the §5.1-vs-M03 divergence is recorded as an out-of-scope finding in roadmap §9, not fixed here); the share-origin override flows through the `useShare` seam — `UseShareOpts.createShare` stays typed `(id: string) => Promise<…>` and AppRoot passes the bare `createShare` reference (AppRoot.tsx:612), so the extension override relies on `createShare`'s LAZY `detectFromEnv().isExtension` default resolving env at CALL time (Task 4 documents this + adds an end-to-end seam test); extension reads the same `syncStore` keys (`preserveLastCode`/`replaceNewTab`) the app already owns; manifest version derives from `config/constants.ts APP_VERSION`. No backend/legacy-`src/` mutation; cutover is reversible.

---

## Done when

- [ ] `pnpm -C web typecheck`, `pnpm -C web test` green; `pnpm exec playwright test --project=chromium` green (incl. the new embed spec + M01–M04 specs); `pnpm -C web build:extension` produces `web/extension.zip` with a version-stamped MV3 manifest.
- [ ] Embed: `?embed` hides the main header/sidebar/modals + disables shortcuts + shows the embed header with an open-in-app link; `?code=` renders by value with no Firestore read; `?title`/`?stickyOffset` honored; embed composes with shared read-only.
- [ ] Extension: MV3 package loads `web/dist` (relative assets), background worker opens the app on icon click + overrides new tab when `replaceNewTab`, options page edits `preserveLastCode`/`replaceNewTab` via `chrome.storage.sync`, billing hidden + CDN scripts skipped (existing seams), share links minted under the extension point at `https://app.zenuml.com` (not `chrome-extension://`).
- [ ] Cutover: `firebase.json hosting.public` → `web/dist` with all 6 rewrites intact, asset-URL spec green against `web/dist`, a manual runbook with dual rollback paths committed. NO deploy performed; NO cloud resource mutated; legacy `src/`/`app/`/gulp retained for rollback.
- [ ] EmbedHeader uses the Drafting Table design system (no gray-*/hex). Legacy `src/` + backend assets untouched (NFR-1).
- [ ] Adversarial review (Task 15) complete; real findings fixed with regression tests; deferrals in roadmap §9.
- [ ] All work committed in small steps; a milestone screenshot (embed view + loaded extension) delivered.
