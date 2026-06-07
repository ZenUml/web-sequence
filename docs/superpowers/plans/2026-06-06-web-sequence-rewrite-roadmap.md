# ZenUML Web-Sequence Frontend Rewrite — Roadmap & Shared Architecture

> **For agentic workers:** This is the **index + shared contract** for the rewrite. Each milestone has its own plan file (`…-NN-<name>.md`) authored just-in-time. The canonical types and service interfaces here are the single source of truth — every milestone plan imports these names verbatim. REQUIRED SUB-SKILL for executing each milestone plan: `superpowers:subagent-driven-development`.

**Goal:** Replace the entire web-sequence frontend with a modern, typed, modular app that reaches feature parity (per the approved requirements spec) while working unchanged against the existing Firebase backend (per the approved contract spec).

**Source specs:**
- `docs/superpowers/specs/2026-06-06-web-sequence-rewrite-requirements.md`
- `docs/superpowers/specs/2026-06-06-web-sequence-rewrite-frontend-backend-contract.md`

---

## 1. Locked Architecture Decisions

| Area | Decision | Notes / veto-flag |
|---|---|---|
| Framework | **React 19** | per approved stack |
| Language | **TypeScript** (strict) | per approved stack |
| Build | **Vite 6** | keep current bundler |
| Package manager | **pnpm** | rewrite standardizes on pnpm (E2E already used it; repo has `pnpm-lock.yaml`). Replaces Yarn. |
| Routing | **TanStack Router** (SPA, single `/` route with typed **search params**) | The app is one screen driven by query params (`id`, `share-token`, `embed`, `code`, `title`, `stickyOffset`) — Router's search-param validation fits exactly; no SSR. |
| Server state | **TanStack Query** | items, item, folders, subscription; `onSnapshot` bridged into the query cache |
| Client/UI state | **Zustand** | many independent UI toggles + editor/preview state + prefs. ⚠️ *Veto-flag: not part of "TanStack"; if you prefer, swap for React Context — but Zustand is the recommended pick.* |
| Editor | **CodeMirror 6** via `@uiw/react-codemirror` + `@codemirror/*` | ZenUML DSL gets a lightweight CM6 language (see Milestone 01) |
| Renderer | **iframe + `postMessage`** (unchanged boundary, decision OQ-6) wrapping `@zenuml/core` | reuse the asset-URL shim approach |
| Firebase SDK | **Modular SDK v10+** | contract is SDK-agnostic (CQ-5); modular = tree-shaking + types. Same project/rules/shapes. ⚠️ *Veto-flag: big jump from v7; data contract is identical.* |
| UI primitives | **Radix UI** (+ Headless UI where already idiomatic) + **Tailwind CSS** | Radix is first-class React now — drop `preact/compat` shims |
| Unit tests | **Vitest** + React Testing Library | Vite-native; replaces Jest. ⚠️ *Veto-flag: tooling change (Jest→Vitest).* |
| E2E | **Playwright** (existing specs retained) | re-pointed/greened at Milestone 01; add `data-testid` hooks |
| Icons/styling assets | keep `static/`, Tailwind config, PostCSS | reuse existing visual assets where possible |

### 1.1 Source layout & cutover strategy

- Work happens on a **feature branch** (`rewrite/frontend`), never on `master`.
- The **new app is a self-contained project in `web/`** — its own `package.json`, `pnpm-lock.yaml`, `node_modules`, and Vite/TS/Vitest config — isolated from the legacy Preact/Jest/Yarn toolchain at the repo root. This avoids dependency/config collisions between the two stacks.
- The **legacy app in `src/` is left untouched and keeps building/running** throughout the rewrite (its E2E stays green). No upfront archive/move.
- **Conventional Vite layout** inside `web/`: `web/index.html` + `web/src/**` + `web/vite.config.ts`; build output `web/dist/`.
- **Build-critical seams replicated** in `web/vite.config.ts`: dev **port 3000** + the six function proxies, and the **`@zenuml/core` asset-URL shim** (dev `/@fs/` vs build hashed asset). A `web/`-specific Playwright asset spec (added in M01) guards the shim.
- **Cutover (Milestone 05):** repoint the production build / Firebase hosting from the legacy `src/→dist/→app/` pipeline to `web/`'s output, then retire the legacy `src/` + old configs. Until then nothing legacy is deleted.

### 1.2 Directory structure (inside `web/`)

```
web/                              # self-contained pnpm project (package.json, vite.config.ts, tsconfig.json, ...)
  index.html                      # Vite entry (mounts #app)
src/                              # i.e. web/src

  main.tsx                      # entry: mount React root, router
  app/
    router.tsx                  # TanStack Router: single route, typed search params
    AppRoot.tsx                 # top-level layout shell
    runtimeMode.ts              # RM-1..RM-6 detection (embed, extension, desktop, debug, shared)
  domain/
    types.ts                    # CANONICAL domain types (see §3)
    item.ts                     # item helpers: migrateToPages, dual-write, page ops
    plan.ts                     # plan-type derivation from subscription
  config/
    firebaseConfig.ts           # host→config map + staging fallback (from contract §1)
    constants.ts                # AUTO_SAVE_INTERVAL, UNSAVED_WARNING_COUNT, limits, etc.
  services/                     # backend contract layer (see §4) — framework-agnostic
    firebase.ts                 # SDK init, auth, firestore handle, persistence
    storage.ts                  # local vs chrome.storage.sync abstraction
    itemService.ts
    folderService.ts
    subscriptionService.ts
    syncService.ts              # /create-share
    analytics.ts                # /track + GTM/Mixpanel/Clarity conditional load
    cloudFunctions.ts           # typed fetch wrappers for the 6 rewritten endpoints
  hooks/                        # React/TanStack bindings over services
    useAuth.ts  useItems.ts  useItem.ts  useFolders.ts  useSubscription.ts
    useSettings.ts  useFirestoreSubscription.ts  useKeyboardShortcuts.ts
    useOnlineStatus.ts  usePreview.ts  useExportPng.ts
  state/
    uiStore.ts                  # Zustand: modals, panels, console open, etc.
    editorStore.ts              # Zustand: current item, pages, unsaved count, dirty
  editor/
    CodeEditor.tsx              # CM6 wrapper (theme, keymap, modes, lint)
    zenumlLanguage.ts           # lightweight CM6 language/highlight for ZenUML DSL
    themes.ts                   # curated theme set (default monokai)
    snippets.ts                 # toolbox snippet inserts
    emmet.ts  prettier.ts
  preview/
    PreviewFrame.tsx            # iframe host
    previewProtocol.ts          # typed postMessage protocol (see §5)
    previewHtml.ts              # getCompleteHtml() equivalent (injects @zenuml/core)
    transpilers.ts              # lazy mode transpilers
    Console.tsx
  components/                   # presentational + feature components
    header/ sidebar/ library/ modals/ subscription/ pages/ share/ embed/
  styles/                       # Tailwind entry, globals
  test/                         # vitest setup, RTL utils, msw handlers
```

---

## 2. Milestone Plans (each ships working, testable software)

> Plans are authored just-in-time before execution to avoid drift. Each lists the requirements it satisfies and ends green (unit + relevant E2E).

| # | Plan file | Delivers | Key reqs |
|---|---|---|---|
| **00** | `…-00-foundation.md` | Branch, create self-contained `web/` project (Vite+React19+TS+pnpm+Tailwind+Router+Query+Zustand+Vitest), Firebase init (multi-tab cache), **canonical types + pure helpers with tests**, config/runtime-mode/storage layers, app shell that renders an empty split layout and boots. App runs at :3000, builds to `web/dist`, asset-shim check clean. Legacy `src/` untouched. | NFR-1..9, RM-1..6, §1, §3, §4 |
| **01** | `…-01-editor-preview.md` | CodeMirror 6 ZenUML editor + CSS editor (modes, curated themes, keymap, snippets, Emmet, find/replace, errors); iframe preview via postMessage rendering `@zenuml/core`; console; CSS-only fast path; fullscreen; lazy transpilers. **Re-green smoke + dsl-spot-check E2E.** | REQ-ED-*, REQ-PRV-*, REQ-LAY-1 |
| **02** | `…-02-persistence-auth.md` | Item domain (create/open/save/fork/delete) with dual-write + pages migration; multi-page tabs (create/switch/delete/**rename**); local + cloud persistence; auth (4 OAuth providers, anonymous, import-on-login); offline + multi-tab warning; last-code restore; auto-save. | REQ-DM-*, REQ-PG-*, REQ-PST-*, REQ-AC-*, REQ-SHR-3 (fork) |
| **03** | `…-03-library-sharing.md` | Library browsing (search, item actions, real-time list), folders CRUD (transactions), move-to-folder, import/export JSON + standalone HTML; create-share link + share panel; open shared read-only. | REQ-LIB-*, REQ-SHR-1/2/4 |
| **04** | `…-04-subscription-settings-modals.md` | Paddle Classic checkout + cancellation + pricing modal; plan gating (3/20/∞, Plus-only CSS, softened limit notice); payment feature flag; full settings (load-once) with live application; modal inventory + one-time prompts + templates; analytics events. | REQ-SUB-*, REQ-SET-*, REQ-MOD-*, REQ-ANL-1 |
| **05** | `…-05-extension-embed.md` (**Phase 2**) | Embed mode polish; Chrome/Edge MV3 extension (background worker, options page, chrome.storage, new-tab override); extension build/package; final **cutover** (repoint production build/hosting to `web/`, retire legacy `src/` + old config). | RM-2/4/5, REQ-EMB-1, REQ-EXT-1, §16 |

**Definition of done per milestone:** its requirements demonstrably work; unit tests green; the E2E it owns green; committed in small steps; no placeholder code.

---

## 3. Canonical Domain Types (`src/domain/types.ts`)

> Every milestone plan uses these exact names. This is the contract between plans.

```ts
export type HtmlMode = 'html' | 'markdown' | 'jade';
export type CssMode = 'css' | 'scss' | 'sass' | 'less' | 'stylus' | 'acss';
export type JsMode = 'js' | 'es6' | 'coffeescript' | 'typescript';

export interface Page {
  id: string;
  title: string;
  js: string;
  css: string;
  isDefault?: boolean;
}

export interface Item {
  id: string;
  title: string;
  // Content (item-level; current page mirror-written here — REQ-DM-1)
  js: string;
  css: string;
  html: string;
  htmlMode: HtmlMode;
  cssMode: CssMode;
  jsMode: JsMode;
  cssSettings?: unknown;            // Atomic-CSS config when cssMode === 'acss'
  // Pages (REQ-PG-*)
  pages: Page[];
  currentPageId: string;
  // Layout
  sizes?: number[];                 // code sub-pane split
  mainSizes?: number[];             // editor/preview split
  // Ownership / meta
  createdBy?: string;               // owner uid — stamped on every cloud write
  updatedOn?: number;
  folderId?: string;
  // Sharing (written by backend create_share only)
  isShared?: boolean;
  shareToken?: string;
  sharedAt?: unknown;
  // Runtime-only (from get_shared_item; never persisted by client)
  isReadOnly?: boolean;
  // Legacy (preserve on round-trip; not surfaced/edited — REQ-DM-3)
  externalLibs?: { js: string; css: string };
}

export interface Folder {
  id: string;                       // "folder-<randomId>"
  name: string;
  createdOn: number;
  updatedOn: number;
}

export type PlanType =
  | 'free' | 'basic-monthly' | 'basic-yearly'
  | 'plus-monthly' | 'plus-yearly' | 'enterprise';

export interface Subscription {
  status: string;                   // 'active' | 'trialing' | 'cancelled' | ...
  passthrough: string;              // JSON {userId, planType} OR legacy plain userId
  subscription_id?: string;
  subscription_plan_id?: string;
  cancel_url?: string;
  update_url?: string;
  next_bill_date?: string;
  cancellation_effective_date?: string;
  [k: string]: unknown;             // other Paddle fields preserved verbatim
}

export interface AppUser {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
  items?: Record<string, true>;
  subscription?: Subscription | null;
}

export interface Settings {
  preserveLastCode: boolean;
  replaceNewTab: boolean;           // extension
  htmlMode: HtmlMode;
  jsMode: JsMode;
  cssMode: CssMode;
  editorTheme: string;              // default 'monokai'
  keymap: 'sublime' | 'vim';
  fontSize: number;                 // 12–18, default 16
  editorFont: string;              // 'FiraCode' | 'Inconsolata' | 'Monoid' | 'FixedSys' | 'other'
  editorCustomFont: string;
  indentWith: 'spaces' | 'tabs';
  indentSize: number;
  lineWrap: boolean;
  autoCloseTags: boolean;
  autoComplete: boolean;
  autoPreview: boolean;
  autoSave: boolean;
  preserveConsoleLogs: boolean;
  refreshOnResize: boolean;
  lightVersion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  preserveLastCode: true, replaceNewTab: false,
  htmlMode: 'html', jsMode: 'js', cssMode: 'css',
  editorTheme: 'monokai', keymap: 'sublime', fontSize: 16,
  editorFont: 'FiraCode', editorCustomFont: '',
  indentWith: 'spaces', indentSize: 2,
  lineWrap: true, autoCloseTags: true, autoComplete: true,
  autoPreview: true, autoSave: false, preserveConsoleLogs: true,
  refreshOnResize: false, lightVersion: false,
};
```

> **Dropped vs current** (decisions): `infiniteLoopTimeout`, `isCodeBlastOn`, `isJs13kModeOn`, `layoutMode` are removed from `Settings`. Unknown keys already in a user's stored `settings` map are left untouched (we only write keys we own).

---

## 4. Canonical Service-Layer Interfaces (`src/services/*`)

> Framework-agnostic; React/TanStack bindings live in `src/hooks/*`. Signatures are fixed across plans.

```ts
// cloudFunctions.ts — typed wrappers over the 6 hosting-rewritten endpoints
export function createShare(input: {
  id: string; name: string; content: string; description: string; origin: string;
}): Promise<{ page_share: string; md5: string }>;            // POST /create-share (auth via ID token in body)
export function getSharedItem(id: string, shareToken: string): Promise<Item>; // GET /get-shared-item
export function trackEvent(payload: Record<string, unknown> & { event: string; userId: string | null }): Promise<void>; // POST /track

// itemService.ts
export interface ItemService {
  getItem(id: string, shareToken?: string | null): Promise<Item>;
  setItem(id: string, item: Item): Promise<void>;     // local always + cloud(merge) when signed-in+online; strips imageBase64; ensures pages; stamps createdBy
  saveItems(items: Record<string, Item>): Promise<void>;  // batch import
  removeItem(id: string): Promise<void>;
  setItemForUser(itemId: string): Promise<void>;
  unsetItemForUser(itemId: string): Promise<void>;
  subscribeAllItems(uid: string, cb: (items: Item[]) => void): () => void; // onSnapshot where createdBy==uid
  saveLastCode(item: Item): void;                     // local 'code' slot, never cloud
  stopSharing(id: string): Promise<void>;             // CQ-2: owner sets isShared:false + clears shareToken (client write); next share mints a fresh token
}

// folderService.ts (transactions on users/{uid}.folders array)
export interface FolderService {
  createFolder(name: string): Promise<Folder>;
  getFolders(): Promise<Folder[]>;
  renameFolder(folderId: string, newName: string): Promise<void>;
  deleteFolder(folderId: string): Promise<void>;      // CQ-3: removes folder only; NO item rewrite. Items with an orphaned folderId render "Unfiled" via the existence-check grouping.
}

// subscriptionService.ts
export function retrieveSubscription(uid: string): Promise<Subscription | null>; // user_subscriptions/user-<uid>

// plan.ts (pure)
export function isSubscribed(s: Subscription | null | undefined): boolean;       // active|trialing
export function getPlanType(s: Subscription | null | undefined): PlanType;       // passthrough → planType; legacy → 'basic-monthly'
export function isPlus(s: Subscription | null | undefined): boolean;
export function isBasic(s: Subscription | null | undefined): boolean;

// auth (firebase.ts)
export type ProviderName = 'google' | 'github' | 'facebook' | 'twitter';
export function login(provider: ProviderName): Promise<void>;                    // signInWithPopup
export function logout(): Promise<void>;
export function onAuthChange(cb: (user: AppUser | null) => void): () => void;
export function getIdToken(): Promise<string>;

// storage.ts (local vs chrome.storage.sync)
export interface KvStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
export const localStore: KvStore;     // localStorage (web) — item cache, flags
export const syncStore: KvStore;      // chrome.storage.sync on extension, else localStorage — settings

// item.ts (pure domain helpers)
export function migrateToPages(item: Item): Item;     // single canonical path (REQ-DM-2)
export function applyPageEdit(item: Item, pageId: string, patch: Partial<Pick<Page,'js'|'css'|'title'>>): Item; // dual-write (REQ-DM-1)
export function addPage(item: Item, title?: string): Item;
export function deletePage(item: Item, pageId: string): Item;     // guards default/last page
export function switchPage(item: Item, pageId: string): Item;
```

---

## 5. Preview Protocol (`src/preview/previewProtocol.ts`)

```ts
export interface RenderOptions {
  enableMultiTheme: false;
  theme: 'theme-default';
  stickyOffset?: number;            // from URL
}
// host → iframe
export type HostMessage =
  | { type: 'render'; code: string; options: RenderOptions }
  | { type: 'getPng' }
  | { type: 'evalConsole'; expr: string };
// iframe → host
export type FrameMessage =
  | { type: 'png'; dataUrl: string }
  | { type: 'console'; level: string; args: unknown[] }
  | { type: 'ready' };
```

The iframe document is assembled by `previewHtml.getCompleteHtml()`, which injects the `@zenuml/core` bundle (via the Vite asset-URL shim) and a small bootstrap that instantiates the engine on `#mounting-point`, listens for `render`/`getPng`, and posts results back. **This boundary is unchanged from today** (decision OQ-6).

---

## 6. Testing Strategy

- **Unit (Vitest + RTL):** pure domain helpers (`item.ts`, `plan.ts`, settings merge), service logic (with Firebase mocked / MSW for fetch endpoints), Zustand stores, editor adapters, preview protocol.
- **Component (RTL):** editor, modals, library, pricing, page tabs — behavior not implementation.
- **E2E (Playwright, retained):** `smoke.spec.js`, `dsl-spot-check.spec.js`, `production-build.spec.js`. Re-greened at Milestone 01; selectors moved to `data-testid`. The production-build spec guards the `@zenuml/core` asset-URL shim.
- **No weakening of tests to pass.** Red E2E during early milestones is expected on the branch and is fixed by real functionality, not by editing assertions.

---

## 7. Conventions

- TS `strict: true`; no `any` except at untyped Firebase boundaries (localized + commented).
- One responsibility per file; prefer small files (NFR-3).
- TDD per the bite-sized task format; commit after each green step; one-line commit messages.
- No `window.*` globals as the integration mechanism (replace `window.user`/`window.db`/`window._app` with hooks/stores). A tiny dev-only test hook may be exposed behind an env guard.
- Keep `data-testid` on elements E2E targets.

---

## 8. Contract questions — resolved (grilled 2026-06-06)

- **CQ-1 Drop LaraSite.** Wire only `/create-share`; `/sync-diagram` is never called (already true today). [M03]
- **CQ-2 Add "Stop sharing" (frontend-only).** Owner sets `isShared:false` + clears `shareToken` via client write; next share mints a fresh token, killing old links. `ItemService.stopSharing`. [M03, REQ-SHR-5]
- **CQ-3 Keep parity on folder delete.** Remove folder only; no item rewrite; orphaned `folderId` → "Unfiled" via existence-check grouping. [M03]
- **CQ-4 Load all items.** No pagination (breaks search/grouping, can't cut download cost without a backend index); add render virtualization only if a large library lags. [M03]
- **CQ-5 Modular SDK v10+, multi-tab supported.** `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`; the legacy multi-tab warning is **removed**; fall back to memory cache if IndexedDB is unavailable. [M00 init / M02 behavior, REQ-PST-4]

---

## 9. Adversarial-review carry-forward (M00 → later milestones)

> Raised by the M00 adversarial-review panel (2026-06-06); deferred deliberately, not forgotten. Each must be addressed in the milestone noted.

- **M02 — `firebase.ts` HMR/double-init safety.** `initializeApp` runs at module load with no guard; under HMR or a second import it throws `Firebase App named [DEFAULT] already exists`. When the module is first wired up, use `getApps().length ? getApp() : initializeApp(config.firebase)`.
- **M02 — `firebase.ts` persistence fallback.** `persistentLocalCache` accesses IndexedDB lazily (no synchronous throw at init), but the first Firestore op fails in private browsing / when IndexedDB is unavailable. Wrap with a try/catch fallback to `memoryLocalCache()` (per CQ-5).
- **M02 — login-side behaviors not in the foundation service.** Legacy `login()` also: fires `trackEvent('fn','loggedIn',provider)`, persists `lastAuthProvider` (LS_KEYS), and alerts the user on `auth/account-exists-with-different-credential`. The foundation `login()` only does `signInWithPopup` and propagates errors — reimplement these at the UI/analytics call sites so UX is preserved.
- **M01+ — `web/public` static assets.** `vite.config.ts` sets `publicDir: 'public'`, which does not yet exist (Vite silently skips it). Legacy served favicons/fonts/animations from `../static`; migrate them into `web/public` before cutover or the app ships without icons/fonts.
- **M04 — editor modals deferred from M01.** REQ-ED-6 cheat sheet, the Atomic-CSS settings modal (edits `cssSettings`), and REQ-KB-1 shortcuts-help modal are built in M04 (modal inventory). Consequence: in M01, ACSS mode renders against existing `cssSettings` but they are not editable until M04 (CSS editor is read-only in ACSS, matching legacy).
- **DESIGN SYSTEM "Drafting Table" (adopted 2026-06-07, applies M02→M05).** All app-chrome UI is built from `web/src/ui/` primitives + Tailwind semantic tokens per `docs/superpowers/specs/2026-06-07-design-system.md` (established via the `frontend-design` skill at the user's request). Direction: precision-instrument — ink dark editor surface + warm-paper preview surface, one cobalt `accent` (+ sparing amber), Hanken Grotesk / IBM Plex Mono / Instrument Serif, blueprint-grid texture, crisp small radii, `ease-draft` motion. **Rule for every milestone UI task (M02 Tasks 11/14/16; M03 library+share UI; M04 settings/subscription/modal inventory):** run UI-bearing work through this system — extend `web/src/ui/` (wrapping Radix) before building the feature; no `gray-*`/raw hex/ad-hoc fonts; keep `data-testid`s. Foundation committed in M02: tokens (`tailwind.config.js`), globals (`src/styles/globals.css`), fonts (`index.html`), primitives (`Button`/`IconButton`/`Dialog`/`cn`), and a restyle of the existing rail/toolbox/gutter.
- **M02 scope boundaries (recorded).** Library/saved-items panel UI → M03. Full settings UI → M04 (M02 only loads `users/{uid}.settings` + honors preserveLastCode/autoSave/autoPreview). Plan-limit enforcement (3/20/∞) → M04 (M02 leaves a `// M04: enforce plan limit` seam in save). create-share/share-panel/stopSharing → M03 (M02 wires only getSharedItem + fork). Analytics `/track` + GTM/Mixpanel → M04 (M02 leaves `// M04: trackEvent` seams). Firebase anonymous-auth is intentionally NOT added — "anonymous" = full local-only operation when signed out (legacy parity).
- **M02 adversarial-review deferrals (2026-06-07).** The Task-18 panel fixed 8 real findings (boot-auth race, read-only last-code poisoning, fork-not-dirty, loadItem counter reset, Layout mainSizes stale-closure mutation, ensureUser first-save race, login unhandled-rejection, switchPage dirty). DEFERRED, not lost:
  - **M03** — `saveItems` batch import uses `batch.set` without `{merge:true}`; when sharing lands, re-importing a previously-shared item would clobber backend sharing fields (`isShared`/`shareToken`/`sharedAt`). Use `batch.set(ref, data, {merge:true})` once sharing fields exist. Also: `subscribeAllItems` onSnapshot error path silently does `cb([])` (empty list indistinguishable from a real error) — the M03 library panel should surface a load error + retry (pass the error through, e.g. `cb([], err)`).
  - **M03/polish** — `useItems` does not reset `loading=true` on a uid transition (signed-in items can flash briefly after logout before the signed-out list loads). `isDefault`-absent edge: a pre-existing item whose `pages[0]` lacks `isDefault` could expose a delete control on the first page (migrateToPages stamps it for synthesized pages, but pre-existing arrays pass through) — harden the PageTabs guard to also treat index 0 as non-deletable.
  - **NFR-3 debt** — `AppRoot` reads `?id`/`share-token`/`stickyOffset` via `new URLSearchParams(window.location.search)` instead of the TanStack Router `useSearch()` (which has `validateSearch`). Works for the single index route; revisit (use the injected router hook) if routing grows or SPA navigation is added.
  - **M04** — `useAuth.login` now swallows+logs non-account-exists OAuth errors (legacy parity); M04 should surface them in the UI (error state in the login modal) instead of console-only. `window.alert` for account-exists is likewise a console/alert stopgap → replace with a design-system notice in M04. `import-on-login` `doImport` re-reads `localItems.list()` at click time (tiny TOCTOU vs the displayed count) — snapshot the set when the modal opens if it ever matters.
  - **Cleanup** — dead `currentPageId:''` literal in `newItem`'s pre-migrate object; dead `detectFromEnv()` export (`window.IS_EXTENSION`/`window.zenumlDesktop`) unused in the M02 path; M01 editor block in AppRoot still uses `gray-*` (mode selects/console) — fold into the design system in a polish pass.
- **M05 — extension share-link origin.** `createShare` now sends `origin: window.location.origin` (contract §5.1). In the web app this is correct (`https://app.zenuml.com` etc). Once the extension lands (M05), `window.location.origin` is `chrome-extension://<id>` — a share URL on that host is unreachable. The extension build must override the origin sent to `/create-share` (e.g. pass the canonical `https://app.zenuml.com`) so minted links point at the web app, not the extension. (Backend env fallback would also produce a valid host if origin were omitted, but the contract obligation is to send it — override rather than drop.)
- **M03 adversarial-review deferral (2026-06-07).** `ConfirmDialog` hardcodes the `confirm-ok`/`confirm-cancel` data-testids and is instantiated multiple times (AppRoot: saved-locally notice + import-error notice; LibraryItemRow delete; FolderList delete). NOT fixed: Radix `Dialog` is modal by default (`web/src/ui/Dialog.tsx` passes no `modal={false}`), so the open overlay blocks opening a second ConfirmDialog through the UI — two `confirm-ok` testids are never simultaneously live in any real user flow, and the only way to force the collision (set two `open` booleans true at once) is unreachable, so there is no honest discriminating regression test. Optional hardening for a later polish pass: add a per-instance testid-suffix prop to `ConfirmDialog` (e.g. `testIdSuffix`) so concurrently-mounted instances are unambiguous to E2E/unit helpers, and re-check if any future flow can stack two non-modal confirms.
- **M03 adversarial-review deferral — role=button + nested interactive controls (2026-06-07).** `FolderList` folder rows (`web/src/components/library/FolderList.tsx` div role="button" wrapping the delete `IconButton` and the rename `TextInput`) and `LibraryItemRow` rows (`web/src/components/library/LibraryItemRow.tsx` div role="button" wrapping the kebab `Menu`) nest focusable/interactive descendants inside an element with `role="button"`, which is invalid ARIA (a button must not contain interactive children) and is the root cause of the keydown-bubbling class of defects. NOT fixed structurally here: the honest fix is a markup refactor (drop role=button on the container; make the row label/hit-area its own button so the controls are siblings, not descendants) and the honest test is axe-core, which is not wired up in this repo. Functionally mitigated today (`focus:opacity-100` reveals the delete button; `stopPropagation` guards activation; the one concrete behavioral symptom — keyboard menu-item activation bubbling to the row's onOpen — WAS fixed this pass via `MenuContent onKeyDown stopPropagation`, with a discriminating test). Later a11y-hardening pass: wire axe-core into the component test setup, then refactor the two row components so no interactive element is a descendant of a `role="button"`, removing the need for the `stopPropagation` patches.
- **M03 adversarial-review triage (2026-06-07, second pass).** Panel raised 7 findings; 3 FIXED with discriminating regression tests, 4 SKIPPED/deferred with rationale:
  - **FIXED #1** — `parseImportJson` now drops items without a real string `id` so a foreign/hand-edited file can never write `items/undefined` or collapse multiple id-less items (legacy parity; `exportImport.ts` filter). Test in `exportImport.test.ts`.
  - **FIXED #4** — folder rename is now keyboard-reachable via **F2** on the focused folder row (parity with the focusable Delete button), added to the existing row `onKeyDown` so it introduces no new nested interactive element (keeps #5 deferral clean). Test in `FolderList.test.tsx`.
  - **FIXED #7** — signed-out library list is now reactive. `localItems.subscribe/notifyChange` emits a same-tab change signal from the signed-out branches of `setItem`/`removeItem`/`saveItems`; `useItems` subscribes in its signed-out branch and re-lists. Emit fires even when the index is unchanged (move-to-folder), which a `storage` event or index-diff approach would miss. Tests drive create/delete/move through the real service in `useItems.test.tsx`.
  - **SKIPPED #2 (stopSharing client write)** — deliberate, not a bug. Contract §3.1 "never by client" governs share *creation* (token minting); owner *revocation* is permitted by `firestore.rules:16` (`allow update if createdBy == uid`), and the backend is FROZEN (NFR-1) so a client write is the only available path. Documented inline in `itemService.stopSharing`.
  - **SKIPPED #3 (migrateToPages asymmetry)** — benign. No signed-out consumer renders `.pages` off the un-migrated stored copy: `LibraryItemRow` reads only title/updatedOn/folderId, and `AppRoot` `pages={item.pages}` reads the editor-store item which always passes through `getItem`→`migrateToPages` on open. Fixing it would require an internals-only assertion.
  - **SKIPPED #6 (ask-to-import Escape/overlay dismiss)** — spec-correct. REQ-AC-5 ("offer **once** … so it isn't repeated") and REQ-MOD-3 ("appear at most once") mandate marking-as-asked on dismissal; re-offering on next login would violate "isn't repeated."
  - **#5 (role=button nesting)** — already recorded above (line: role=button + nested interactive controls deferral); confirmed still deferred — the keydown-bubbling behavioral tests genuinely depend on the `role="button"` row structure, and the honest fix (wire axe-core + markup-refactor both row components so no interactive control is a descendant of role=button) is larger than this triage pass. The F2 fix (#4) was added to the existing row onKeyDown specifically so it introduces no new nested control, keeping this deferral clean.
- **M03 scope boundaries (recorded).** Settings UI / subscription + plan-limit gating / analytics `/track` + GTM/Mixpanel / remaining modal inventory → M04 (M03 leaves `// M04:` seams at gate/track points). Extension + embed + production cutover → M05. `/sync-diagram` stays unused (CQ-1) — only `/create-share` is wired. Folder delete intentionally does NOT rewrite item docs (CQ-3) — orphaned `folderId` renders "Unfiled" via existence check. (Advisor pre-exec fixes baked into the M03 plan: `setItem` strips backend-owned sharing fields; `moveToFolder` takes the held Item, not a localStore re-fetch.)
- **M04 scope boundaries (recorded).** Extension + embed surfaces + production cutover + extension-bundled Paddle (`/lib/paddle.js`) → M05 (M04 builds the conditional structure: skip-CDN-under-extension in `analytics.ts`/`usePaddle.ts`, `syncStore` already abstracts the settings backend). Settings are **load-once** (OQ-5) — written to `syncStore` + cloud on change but no remote settings subscription; the item list stays live. Plan-limit softening (REQ-SUB-5): enforcement preserved (cloud write SKIPPED for an over-cap save, local save kept) with a non-blocking `LimitReachedNotice` + inline upgrade — NOT `alert()`+forced modal. Limit predicate is **legacy-exact** — `ownedIds.length > limitFor(sub)` over the PRE-INSERT ownership map (matching legacy `checkItemsLimit`, which runs before `setItemForUser` and admits the (limit+1)-th NEW item). Legacy blocks purely on count with NO `includes`/new-vs-resave branch: an over-cap re-save is blocked exactly as a new save is. The save-seam additionally **gates enforcement on `!useSubscription().loading`** (auth-resolved-before-read race guard): while the subscription read is in flight the user transiently derives to `'free'`, so enforcing would falsely block a paying user AND silently skip their cloud write — therefore an unresolved subscription is treated as not-yet-known and the cloud write proceeds. Paddle stays **Classic** (vendor 39343, `{userId, planType}` passthrough — contract C-PAY-1). LoginModal OAuth-error surfacing + the account-exists notice replace the M02 console/`window.alert` stopgaps. Dropped from `Settings`: `layoutMode`, `infiniteLoopTimeout`, `isCodeBlastOn`, `isJs13kModeOn`.
- **M04 integration decisions (Task 16, recorded for Task 18).** (1) **Custom-CSS Plus-gate is ALL-CSS, not custom-modes-only.** Legacy `onCodeChange`/`app.jsx` has NO CSS Plus-gate (grep confirmed: the only `isPlusOrAdvanced` use is `checkItemsLimit`); the gate is a NEW rewrite requirement (REQ-SUB-5 bullet 2 / plan §8). Following the plan as written, AppRoot gates BOTH the CSS-editor `onChange` AND selecting a non-plain `css-mode` (`mode !== 'css'`): anonymous → open `LoginModal` (via new `uiStore.loginModalOpen`); signed-in non-Plus → open pricing + `track('Free Limit',{category:'custom-css'})`; mid-subscription-load → NOT gated (same `!loading` race guard as the save-seam); Plus → applies. Flagged for Task 18 to confirm all-CSS vs custom-modes-only is the intended product scope. (2) **Analytics emit-inventory wired** (plan §5): `pageView` (hook mount), `saveBtnClick`, `Free Limit` (over-cap save + custom-css gate), `loggedIn`/`loggedOut` (+provider), `shareLink`, `itemsImported`, `exportItems`, `openSettingsModal`, `updatePref-<key>`, `onboardModalSeen` (Onboarding dismiss), `pledgeModalSeen` (pledge dismiss). (3) **`APP_VERSION` constant** added to `config/constants.ts` (tracks legacy `1.0.25`); the rewrite owns release versioning in M05. (4) **Settings load-once** is performed by `useAuth`'s `onAuthChange` handler (`getUserSettings`→`settingsStore.merge`); M04 adds only the per-change persist split (`syncStore.set` + `setUserSetting`). (5) **`itemService.setItem` gained `{ skipCloud }`** for the softened over-cap path (local write kept, cloud `setDoc`+membership withheld); the cloud-level proof lives in `itemService.test.ts`, the seam-decision proof in `AppRoot.test.tsx`.
- **M04 adversarial-review triage (2026-06-07, M04 panel).** Panel raised 4 findings; 2 FIXED with discriminating regression tests, 2 DEFERRED with rationale:
  - **FIXED #1 (boot settings-load race could clobber cloud settings).** The boot `syncStore` local loop (`AppRoot.tsx`) and `useAuth`'s `getUserSettings` merge had NO ordering guarantee, yet the comment claimed "cloud wins". If the cloud merge resolved first, the serial local loop's plain `merge` would overwrite fresh cloud values key-by-key (REQ-SET cross-device regression). Fix: order-independent layering in `settingsStore` — `mergeCloud(partial)` applies cloud values AND records cloud-owned keys in a `cloudKeys` Set (authoritative layer); `mergeLocalBase(partial)` applies ONLY keys cloud has not claimed (base layer). `useAuth`→`mergeCloud`, boot loop→`mergeLocalBase`, live `handleSettingChange`→plain `merge` (post-boot always wins). Cloud wins regardless of arrival order; an empty cloud doc claims zero keys so a no-cloud-settings user still gets full local base. Tests in `settingsStore.test.ts` (revert→fail verified).
  - **FIXED #2 (support-pledge re-shows once for legacy migrators).** Legacy gates the pledge on `lastSeenVersion && semverCompare<0 && !pledgeModalSeen` (app.jsx:329-331); legacy bumps `lastSeenVersion` only on new-user onboarding / notification-click, NOT on pledge dismiss — so a legacy user who already dismissed the pledge has `pledgeModalSeen=true` + a still-behind `lastSeenVersion` in the SAME localStorage the rewrite reads. The rewrite ignored `pledgeModalSeen` and re-fired on the semver compare alone → a one-time spurious upgrade prompt to the wrong audience (REQ-MOD-3), and `pledgeModalSeen` was dead state. Fix: read `pledgeModalSeen` in the pledge trigger (`AppRoot.tsx`) and `return` early if seen — `pledgeModalSeen` is now a live latch. Test in `AppRoot.test.tsx` (revert→fail verified).
  - **DEFERRED #3 → M05 (one-time-prompt flags + settings use plain localStorage, not sync, in the extension).** Real cross-surface parity gap but extension-only (Phase 2/M05): the rewrite uses `localStore` for `onboarded`/`lastSeenVersion`/`pledgeModalSeen` and never writes the `users/{uid}.lastSeenVersion` Firestore field (contract §3.2). On the web app this is functionally equivalent (both `localStore` and `syncStore` back to localStorage); only the MV3 extension's `chrome.storage.sync` carries these flags cross-device. DEFERRED rather than fixed because there is no extension harness in M04 to write an honest discriminating test — swapping the backend blind would be unverified. M05 (extension) must route these one-time flags through `syncStore` and mirror `lastSeenVersion` to the Firestore user doc.
  - **DEFERRED #4 → analytics-stub implementer (latent Mixpanel double-count).** `analytics.emit` POSTs to `/track` (server-side Mixpanel, contract §5.5/§6.3) AND, on the non-extension client path, pushes to `window.mixpanel.track` if present. Verified NO-OP today: `loadClientAnalytics` is a documented stub, so `window.mixpanel` is never defined and the push is skipped (legacy Mixpanel was server-ONLY via POST /track). The risk activates only when the stub injects a Mixpanel CDN snippet — every event would then double-count into the SAME project token. NOT fixed: REQ-ANL-1 intends a client channel and contract §6.3 lists client-side Mixpanel as conditionally loaded, so deleting the `window.mixpanel.track` push would contradict the requirement; and the defect does not exist until a stub lands, so no honest discriminating test can be written now. Constraint recorded for whoever implements `loadClientAnalytics`: use a DISTINCT client token, gate one channel off, or de-dupe — do NOT load a CDN snippet that reuses the server-side project token without de-duping.
