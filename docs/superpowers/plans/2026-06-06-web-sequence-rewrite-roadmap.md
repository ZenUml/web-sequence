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
