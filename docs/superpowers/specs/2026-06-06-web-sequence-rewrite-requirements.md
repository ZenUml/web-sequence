# ZenUML Web-Sequence — Frontend Rewrite: Requirement Specification

**Status:** Draft for approval
**Date:** 2026-06-06
**Author:** Engineering (with Peng Xiao)
**Scope of this document:** A complete, **technology-stack-neutral** description of what the rewritten frontend must do, derived from the existing application's features. This document describes *what* the product does — not *how* it is built. Implementation technology choices live in the separate implementation plan, not here.

> Companion document: `2026-06-06-web-sequence-rewrite-frontend-backend-contract.md` defines the exact Firebase backend contract the rewrite must honor unchanged.

> **How to read this spec — UX latitude:** This document specifies required **capabilities and behaviors**, not a pixel-for-pixel reproduction of the current UI. The rewrite is free to redesign layout, interactions, and visual treatment to improve the experience. What is **fixed** (not up for redesign): the backend contract and stored data shapes (companion doc), plan-gating rules (§8), keyboard *bindings* where listed (§11), and the invariants in §4. Where current behavior is mentioned only as an example, it is marked *(suggested)*.

---

## 1. Purpose & Goals

ZenUML Web-Sequence is a free, real-time tool that turns ZenUML DSL text into UML sequence diagrams. It runs as a web application (https://app.zenuml.com) and as a Chrome/Edge extension.

The rewrite replaces the entire frontend codebase while:

1. **Preserving feature parity** with the current application (this document is the parity baseline).
2. **Leaving the backend untouched** — the new app must work smoothly against the existing Firebase project, Cloud Functions, Firestore schema, security rules, Paddle billing, and external services exactly as they are today (see the contract document).
3. **Improving internal quality** — maintainability, type safety, testability, and a modern editor — without changing observable behavior except where an improvement is explicitly listed in §15.

### Non-goals
- No backend changes (no new collections, no schema migrations, no new Cloud Functions, no rule changes).
- No change to the ZenUML DSL or the `@zenuml/core` rendering engine.
- No change to the Paddle product catalog, pricing, or billing model.

---

## 2. Scope & Phasing

The rewrite covers three delivery surfaces. Per decision, the **web application reaches full parity first**; the extension and embed surfaces are fully specified here but delivered in a later phase.

| Surface | Description | Phase |
|---|---|---|
| **Web application** | The full editor at app.zenuml.com / staging.zenuml.com | **Phase 1 (parity target)** |
| **Embed mode** | Read-mostly diagram view via URL parameters, minimal chrome | Phase 2 (specified, deferred) |
| **Chrome/Edge extension** | Packaged build with `chrome.storage` settings, new-tab override, options page | Phase 2 (specified, deferred) |
| **Desktop host** (`window.zenumlDesktop`) | Alternate item-service host; no auth | Parity-preserve (keep the integration seam; low effort) |

**In scope:** every user-facing feature in §5–§14.
**Out of scope / deferred:** see §16.

---

## 3. Surfaces & Runtime Modes

The app behaves differently depending on how it is loaded. These modes are determined at startup and gate large parts of the UI.

- **RM-1 Standard web app.** Full editor, header, sidebar, modals, auth, billing.
- **RM-2 Embed mode** (`?embed` present). Hides the main header and most modals; shows a minimal embed header with an "edit on app.zenuml.com" link; disables global keyboard shortcuts; no save/auth UI.
- **RM-3 Shared read-only** (`?id=…&share-token=…`). Loads a shared diagram via the backend; item is marked read-only; editing and saving are disabled; the user may **fork** to create their own editable copy.
- **RM-4 Extension mode** (`window.IS_EXTENSION`). Settings persist to `chrome.storage.sync`; billing UI is disabled (payment feature flag is false on extension hosts); some third-party scripts (analytics/Paddle CDN) are skipped under the `chrome-extension:` protocol.
- **RM-5 Desktop host** (`window.zenumlDesktop`). Uses an injected item service instead of Firebase; hides the main header; no login required.
- **RM-6 Debug mode** (`wmdebug` cookie). Routes analytics events to the console instead of sending them.

---

## 4. Domain Model (neutral)

These are the user-meaningful data concepts. Field names match what the backend already stores and **must be preserved** (see contract doc for storage detail).

### 4.1 Item (a saved diagram)
A diagram document the user creates, edits, and saves.
- Identity: `id`, `title`, `updatedOn`, `createdBy` (owner).
- Content: `js` (ZenUML DSL — the primary content), `css`, `html`.
- Legacy (preserved in storage, **not** surfaced/edited by the rewrite): `externalLibs: { js, css }` (see REQ-DM-3).
- Editing modes: `htmlMode`, `cssMode`, `jsMode`.
- Atomic-CSS config: `cssSettings` (used when `cssMode = acss`).
- Layout: `sizes` (code sub-pane split), `mainSizes` (editor/preview split).
- **Pages:** `pages: [ { id, title, js, css, isDefault } ]` and `currentPageId`.
- Sharing: `isShared`, `shareToken`, `sharedAt` (set by backend).
- Organization: `folderId` (optional; references a folder).
- Read-only marker (runtime, for shared items): `isReadOnly`.

**Backward-compatibility invariant (REQ-DM-1):** HTML is item-level (not per-page). The current page's `js`/`css` are **mirror-written** to the item-level `js`/`css` fields on every edit. The rewrite MUST preserve this dual-write so existing documents and the renderer keep working. This invariant should be centralized in one place to prevent divergence.

**Migration invariant (REQ-DM-2):** An item without a `pages` array must be migrated on load to a single default page `{ title: "Page 1", js, css, isDefault: true }`, with `currentPageId` set to it. There must be exactly **one** canonical migration path (today the logic is duplicated; the rewrite must consolidate it).

**Legacy-field invariant (REQ-DM-3):** `externalLibs: { js, css }` may exist on stored items. Because the backend is frozen, the new app MUST NOT delete or corrupt this field on write (preserve it as-is on round-trip), but it does **not** surface, edit, or inject it (the library-reference and external-libs-input features are removed).

### 4.2 Page
A named sub-diagram within an item: `{ id, title, js, css, isDefault }`. The first page (`isDefault`) cannot be deleted. HTML is shared across pages.

### 4.3 Folder
A user-defined grouping of items: `{ id: "folder-…", name, createdOn, updatedOn }`. Stored as an array on the user record. Items reference a folder by `folderId`; deleting a folder moves its items to "Unfiled".

### 4.4 Settings / Preferences
Per-user editor and app preferences (full list in §9). Persisted locally and, when signed in, to the user record.

### 4.5 User & Subscription
Authenticated identity (`uid`, `displayName`, `photoURL`, `email`), an ownership map of items, and a subscription record determining plan tier (§8).

---

## 5. Functional Requirements — Editor

**REQ-ED-1 Dual code editors.** Provide a ZenUML/JS editor (primary, the DSL) and a CSS editor. The current app additionally carries HTML and multiple language modes; preserve the mode model (below) even though ZenUML DSL is the dominant use.

**REQ-ED-2 Language modes.**
- JS modes: JavaScript, ES6 (Babel), CoffeeScript, TypeScript.
- CSS modes: CSS, SCSS, SASS, LESS, Stylus, **Atomic CSS (ACSS)**.
- HTML modes: HTML, Markdown, Jade.
- Selecting a mode persists on the item (`jsMode`/`cssMode`/`htmlMode`) and triggers (re)compilation. Transpilers load on demand (must remain lazy; see REQ-PRV-4).
- **ACSS** disables direct CSS editing and is configured through a dedicated Atomic-CSS settings modal that edits `cssSettings`.

**REQ-ED-3 Editor features (parity).** Syntax highlighting; line numbers; code folding; bracket matching; auto-close brackets; auto-close tags (pref-controlled); active-line highlight; line wrapping (pref); find / find-next / find-previous / find-and-replace; toggle line comment; indent left/right; re-indent; autocomplete (manual via shortcut + automatic when enabled; suppressed for the ZenUML DSL editor by design); Emmet expansion (CSS editor only); Prettier formatting command. (Exact shortcuts in §11.)

**REQ-ED-4 Editor appearance.** Configurable theme — a **curated set** of a few themes (not all ~51 from the current app), with "monokai" as the default; font family (curated list + custom), font size, keymap (default + Vim), indent unit/size, tabs-vs-spaces.

**REQ-ED-5 Snippet toolbox.** A button toolbar (in the sidebar editor) inserts ZenUML DSL snippets at the cursor: new participant, async message `A->B: message`, sync message `A.method() {}`, return `result = A.method() {}`, self message, instance creation `a = new A()`, `if`/conditional, `while`/loop, and comment+message. Hidden on small screens.

**REQ-ED-6 Cheat sheet.** A modal reference of ZenUML DSL syntax (participant, message, async, nested, self, alt/conditional, loop) with examples.

**REQ-ED-7 Error display.** Compilation/parse errors surface inline in the editor (gutter markers with message), per language.

> **Removed from scope** (web-maker carry-overs, not relevant to sequence diagrams): the "library reference" list and "external libraries input" (`externalLibs`; see REQ-DM-3), and the **code-blast** typing effect.

---

## 6. Functional Requirements — Rendering & Preview

**REQ-PRV-1 Live preview.** The diagram renders from the current page's content using the `@zenuml/core` engine and updates as the user edits, with a short debounce (~500ms). Auto-preview is pref-controlled; when off, the user refreshes manually (shortcut in §11).

**REQ-PRV-2 Isolation boundary (decided: keep current).** The renderer runs in an **isolated iframe** and communicates with the host via `postMessage` — the existing mechanism is **retained** (sends code, returns rendered output and a PNG). This keeps `@zenuml/core` a drop-in dependency and preserves the production-build asset checks. Direct in-React embedding of the engine is explicitly **not** done in this rewrite (decision OQ-6).

**REQ-PRV-3 Render options.** Pass through the render parameters the engine expects today, including a `stickyOffset` taken from the URL and a fixed default theme.

**REQ-PRV-4 On-demand transpilers.** Language transpilers (Babel, TypeScript, SASS/SCSS, LESS, Stylus, Markdown, Jade) load only when the corresponding mode is used.

**REQ-PRV-5 CSS-only fast path.** When only CSS changed, update preview styling without a full re-render (parity optimization; may be reframed but should not regress responsiveness).

**REQ-PRV-6 Console panel.** A console docked under the preview shows logs emitted by the preview, with a log count, clear action, open/close toggle (double-click header or shortcut), and an input line to evaluate expressions in the preview context. Logs optionally persist across refreshes (pref). Objects are stringified for display.

**REQ-PRV-7 Fullscreen present mode.** Toggle fullscreen on the preview region.

> **Removed from scope:** *Infinite-loop protection* (runaway-loop guard + `infiniteLoopTimeout` pref) and the *Detached preview window* are **dropped** in the rewrite. Both are web-maker carry-overs of limited value for sequence diagrams; the renderer is the trusted `@zenuml/core` engine, not arbitrary user JS, so loop-guarding the preview is unnecessary.

---

## 7. Functional Requirements — Multi-Page

**REQ-PG-1 Create page.** Add a blank page (auto-titled "Page N") and switch to it.
**REQ-PG-2 Switch page.** Selecting a page tab loads its `js`/`css` into the editors and re-renders; the active page is remembered via `currentPageId` and restored on reload.
**REQ-PG-3 Delete page.** Remove a page after confirmation; the default/first page cannot be deleted and shows no delete control; deleting the active page switches to the nearest remaining page; the last page cannot be removed.
**REQ-PG-4 Per-page content.** Each page owns its `js` and `css`; HTML remains item-level (REQ-DM-1).
**REQ-PG-5 Auto-save on page switch (optional).** Today page switches do *not* auto-save (they rely on explicit save or the auto-save loop). This is **not** a hard requirement for the rewrite — the new app MAY auto-save on switch if that yields a better experience. No data-loss on switch either way.
**REQ-PG-6 Rename page.** Provide a UI affordance to rename a page (e.g., double-click the tab or an inline edit), updating the page `title`. (This adds the affordance that exists only programmatically today.)

---

## 8. Functional Requirements — Accounts, Subscription & Gating

**REQ-AC-1 Authentication.** Sign in via popup OAuth with **Google, GitHub, Facebook, Twitter** (GitHub is the historical default). Remember the last-used provider as a UI hint. Track login/logout. Handle the "account exists with different credential" error with a user-facing message.

**REQ-AC-2 Auth state.** A single auth listener drives the app: on sign-in, load the user's items, settings, and subscription; on sign-out, clear user state (warn first if there are unsaved changes).

**REQ-AC-3 Profile.** Show avatar (fallback when missing), display name (fallback "Anonymous Creator"), email, current plan, and sign-out.

**REQ-AC-4 Anonymous use.** Without signing in, the user can create, edit, and save diagrams **locally** (no cloud sync, no library list). The first local save explains the limitation once; opening the cloud library prompts sign-in.

**REQ-AC-5 Import local on first sign-in.** If a previously-anonymous user had local diagrams, offer once to import them into the account; track that the offer was made so it isn't repeated.

**REQ-SUB-1 Plan tiers.** Starter/Free, Basic, Plus, Enterprise. Pricing modal shows per-tier features with a monthly/yearly toggle and yearly savings. Enterprise links to the contact page.

**REQ-SUB-2 Plan resolution.** Subscribed = subscription status `active` or `trialing`. Plan type is derived from the subscription's `passthrough` (`{ userId, planType }`), with legacy plain-`userId` passthrough treated as `basic-monthly`. Both formats MUST stay supported (matches backend).

**REQ-SUB-3 Checkout.** Upgrading opens **Paddle Classic** checkout (vendor `39343`) with the env-correct product ID and passthrough `{ userId, planType }`. On success, prompt to refresh and reload subscription state. Non-logged-in users are sent to sign-in first.

**REQ-SUB-4 Cancellation.** Subscribed users get a "Cancel subscription" link to the Paddle-hosted `cancel_url` from their subscription record.

**REQ-SUB-5 Plan gating (exact parity).**
- **Saved-file limits:** Free = 3, Basic = 20, Plus = unlimited. The cap is **still enforced** (an over-limit diagram is not persisted to the cloud), but the rewrite communicates it with a **non-blocking** in-app notice/toast carrying an inline upgrade affordance — *not* a blocking browser `alert()` + force-opened modal. The pricing modal is offered, not forced. *(Assumption: "soften" = gentler presentation, not removal of enforcement; flag if you intended to let over-limit saves through.)*
- **Custom CSS** editing is **Plus-only**; Basic/Free attempting it opens the pricing modal; anonymous users are sent to sign-in.
- **Export/PNG is not gated** today (do not introduce new gating).

**REQ-SUB-6 Payment feature flag.** A per-host `payment` flag gates *all* billing UI. It is on for the web hosts and **off for all extension hosts**. The rewrite must hide the entire billing subsystem when the flag is off.

**REQ-SUB-7 Pro indicator.** Subscribed users show a Pro badge on the avatar and a "My Plan (planType)" entry in the profile menu; non-subscribed users show an "Upgrade plan" control.

---

## 9. Functional Requirements — Settings & Persistence of Preferences

**REQ-SET-1 Settings surface.** A settings modal exposes all preferences below. Changing a setting persists it (locally always; to the user record when signed in) and applies it live.

**REQ-SET-2 Preference list (parity defaults).**

| Setting | Default | Notes |
|---|---|---|
| `preserveLastCode` | true | Restore last code on load |
| `replaceNewTab` | false | Extension: override new tab |
| `htmlMode` | html | |
| `jsMode` | js | |
| `cssMode` | css | |
| `editorTheme` | monokai | |
| `keymap` | sublime | + vim |
| `fontSize` | 16 | 12–18 |
| `editorFont` | FiraCode | + Inconsolata, Monoid, FixedSys, custom |
| `editorCustomFont` | "" | used when font = "other" |
| `indentWith` | spaces | spaces/tabs |
| `indentSize` | 2 | |
| `lineWrap` | true | |
| `autoCloseTags` | true | |
| `autoComplete` | true | |
| `autoPreview` | true | |
| `autoSave` | (parity) | drives 15s auto-save loop |
| `preserveConsoleLogs` | true | |
| `refreshOnResize` | (parity) | re-render on pane resize |
| `lightVersion` | (parity) | light UI theme toggle |
| `layoutMode` | 1 | fixed (horizontal) today |

**REQ-SET-3 Storage backend.** Web uses local browser storage; the extension uses `chrome.storage.sync`; signed-in users additionally sync to the user record. (Exact keys in the contract doc.)

**REQ-SET-4 Live application.** Theme, font, keymap, indentation, wrapping, auto-close, font-size, and light-version changes apply to the running editor/UI immediately.

**REQ-PST-1 Save model.** Saving writes locally always, and (when signed in and online) to the cloud, and registers the item in the user's ownership map. `imageBase64` is stripped before save (size). Read-only shared items skip save.

**REQ-PST-2 Auto-save.** When `autoSave` is on and there are unsaved edits, auto-save on a ~15s interval.

**REQ-PST-3 Unsaved-edit feedback.** Track an unsaved-edit count; after a threshold (~15 edits) draw attention to the save control.

**REQ-PST-4 Offline & multi-tab.** Saves succeed locally while offline and sync when back online; the user is told the save was local. **Multiple tabs are fully supported** (offline persistence is shared across tabs) — the legacy "multi-tab not supported / persistence disabled" warning is **removed** (decision CQ-5, enabled by the modern SDK's multi-tab cache). If the persistent cache can't initialize (e.g., IndexedDB unavailable in private browsing), fall back silently to an in-memory cache.

**REQ-PST-5 Last-code restore.** On unload, persist the current working item to a local "last code" slot; restore it on next load when `preserveLastCode` is on.

---

## 10. Functional Requirements — Library, Saved Items & Folders

> **UX latitude:** This section defines the **required capabilities**, not a mandate to replicate the current UI. The rewrite is free to redesign the layout, interactions, and visual treatment (panel vs. page, grid vs. list, how folders are presented, etc.). Specific behaviors below marked *(suggested)* are examples of current behavior, not requirements; everything else is a capability that must exist in some form.

**REQ-LIB-1 Access to saved diagrams.** A signed-in user can browse their saved diagrams with a visible total/count, reachable from the main UI and via a shortcut. *(Suggested: a "My Library" sidebar panel.)*
**REQ-LIB-2 Search.** Filter the saved diagrams live by title and/or DSL content (case-insensitive).
**REQ-LIB-3 Organization.** Items can be grouped/organized by folder, with an implicit "Unfiled" grouping for items without a folder. *(Suggested defaults: folders A–Z, items by `updatedOn` descending — the rewrite may choose other sensible defaults and offer sorting controls.)*
**REQ-LIB-4 Item actions.** Open, fork/duplicate, delete (keeping the ownership map in sync), and move-to-folder.
**REQ-LIB-5 Keyboard operability.** The list is keyboard-operable (navigate + open at minimum). *(Suggested: arrow keys to move, Enter to open, a fork shortcut — exact bindings at the designer's discretion.)*
**REQ-LIB-6 Folders CRUD.** Create, rename, delete folders. Deleting a folder reassigns its items to "Unfiled". Folder operations require sign-in. (Storage shape is fixed by the contract; the UX is not.)
**REQ-LIB-7 Real-time list.** The list reflects the user's items via the live item subscription (updates without a manual refresh).
**REQ-LIB-8 Import/Export.** Export all items as JSON; import items from JSON (with old-format migration); generate a complete standalone HTML for a diagram.

---

## 11. Functional Requirements — Keyboard Shortcuts (parity)

Global (disabled in embed mode):
- **Save:** Ctrl/Cmd+S
- **Manual preview refresh:** Ctrl/Cmd+Shift+5
- **Open library:** Ctrl/Cmd+O
- **Search/quick-open library:** Ctrl/Cmd+K
- **Keyboard-shortcuts help:** Ctrl/Cmd+Shift+?
- **Clear console:** Ctrl+L
- **Close overlays/modals/library:** Esc

Editor:
- Find: Ctrl/Cmd+F · Find next: Ctrl/Cmd+G · Find prev: Ctrl/Cmd+Shift+G · Find & replace: Ctrl/Cmd+Alt/Opt+F
- Toggle comment: Ctrl/Cmd+/ · Indent right/left: Ctrl/Cmd+] / Ctrl/Cmd+[ · Re-indent: Shift+Tab
- Autocomplete: Ctrl/Cmd+Space · Emmet expand: Tab (CSS editor) · Prettier format: Ctrl+Shift+F

**REQ-KB-1** A keyboard-shortcuts reference modal lists all of the above. **REQ-KB-2** Shortcuts must use modern key identifiers (not deprecated keyCodes) but preserve the same bindings.

---

## 12. Functional Requirements — Sharing & Embed

**REQ-SHR-1 Create share link.** A signed-in owner can generate a share link for the current diagram; the backend returns a URL of the form `…?id=<id>&share-token=<token>` plus a content hash appended as `&v=<md5>` for cache-busting.
**REQ-SHR-2 Share panel.** Present the generated link for copying (the current UI is a popover from the header).
**REQ-SHR-3 Open shared (read-only).** Opening a share link loads the diagram read-only (RM-3); editing/saving disabled; **fork** creates an owned editable copy.
**REQ-SHR-4 Share errors.** If the shared item can't be loaded (missing/disabled), show a clear message.
**REQ-SHR-5 Stop sharing (new).** A signed-in owner can revoke sharing for a diagram: the app sets the item to un-shared and mints a fresh share token on the next share, so previously-distributed links stop working. This is done client-side (the owner may write their own item document — no backend change). *(New vs current: closes the "share link lives forever" gap — decision CQ-2.)*
**REQ-EMB-1 Embed view.** `?embed` produces a minimal view (no main header, no modals, no shortcuts) with an embed header linking back to the full editor. Supports `?code=` (inline diagram source), `?title=`, and `?stickyOffset=`.

---

## 13. Functional Requirements — Modals, Onboarding & Notifications

**REQ-MOD-1 Modal inventory (parity).** Settings, Login, Pricing, Help, Keyboard Shortcuts, Cheat Sheet, Create-New (templates/blank), Ask-To-Import, Onboarding, Support-Developer (version-upgrade pledge), Delete-Page, CSS (Atomic) Settings, Profile.
**REQ-MOD-2 Behavior.** Backdrop click and Esc close overlays; focus is trapped within an open modal; only the relevant modal(s) render.
**REQ-MOD-3 One-time prompts.** Onboarding, the import offer, the support/pledge modal, and the local-save warning each appear at most once, tracked by persistent flags. The support/pledge modal triggers when the seen version is behind the current version.
**REQ-MOD-4 Templates.** Create-New offers a blank diagram or starter templates (Basic, Black & White, Blue, StarUML), each carrying title, layout sizes, modes, and starter code.
**REQ-MOD-5 Notifications/alerts.** Lightweight toast/alert feedback for actions (saved, logged in/out, errors, limit reached, etc.).

---

## 14. Functional Requirements — Layout, Analytics, Extension

**REQ-LAY-1 Split layout.** Resizable split between editor and preview, plus resizable code sub-panes; sizes persist on the item (`sizes`, `mainSizes`). A collapsible left sidebar with an icon bar toggles Library / Editor panels and other actions. Layout mode is fixed (horizontal) today; preserve unless an improvement is approved.

**REQ-ANL-1 Analytics.** Emit the existing analytics events (UI interactions, functional events, page views, auth, shortcuts, limit-reached, share, subscription) to the backend `track` endpoint and to the existing client-side analytics (GTM/Mixpanel/Clarity) under the same conditions (skip CDN-based ones under the extension protocol; route to console in debug mode). Anonymous events carry a null user id.

**REQ-EXT-1 Extension (Phase 2).** Manifest v3 with: a background worker that opens the app on icon click and optionally overrides the new-tab page (`replaceNewTab`); an options page with `preserveLastCode` and `replaceNewTab`; settings via `chrome.storage.sync`; billing disabled; the same editor/preview/library experience as the web app where applicable.

> **Removed from scope:** *JS13K mode* (code-golf compressed-size display + its modal) is **dropped** — a web-maker carry-over with no relevance to sequence diagrams.

---

## 15. Non-Functional Requirements

- **NFR-1 Backend compatibility.** All reads/writes, endpoint calls, payload shapes, auth, and storage keys must match the existing backend contract (companion doc). No backend change is permitted.
- **NFR-2 Type safety.** The codebase is statically typed; the domain model (Item, Page, Folder, Settings, User, Subscription) and all backend request/response shapes are typed.
- **NFR-3 Modularity & testability.** Replace the two monolithic files (~1,900 and ~1,200 lines) with focused, independently testable units with clear interfaces. No single global mutable app object as the integration mechanism.
- **NFR-4 Test coverage.** Unit tests for state/transform logic and editor adapters; the existing E2E suites (smoke, DSL spot-check, production-build asset check) must pass against the rewrite, updated only where DOM selectors necessarily change. Provide stable test hooks (e.g., `data-testid`) rather than relying on framework-internal DOM.
- **NFR-5 Performance.** Live preview remains responsive (debounced); large libraries/console output don't degrade the UI; transpilers and heavy modals load lazily.
- **NFR-6 Offline & multi-tab.** Preserve offline-save; support multiple tabs via the SDK's multi-tab cache (no warning — REQ-PST-4); degrade to in-memory cache when persistence is unavailable.
- **NFR-7 Accessibility (parity only).** Preserve current modal focus-trapping and keyboard operability. No dedicated WCAG pass in this rewrite (a future improvement; see §17).
- **NFR-8 Build outputs.** Produce the web build and the extension package; preserve the production-build asset-URL correctness that the existing CI test guards.
- **NFR-9 Browser support.** Maintain current support targets (recent Chrome/Firefox/Edge).

---

## 16. Out of Scope / Deferred

- Backend/Cloud-Function/Firestore/rules changes (explicitly forbidden).
- Extension and embed surfaces are **deferred to Phase 2** (specified here, built later).
- Migrating off Paddle Classic to Paddle Billing — **decided: stay on Classic** (a move would require backend changes, which are out of scope).
- Multi-page sharing (today only single-page `js` is sent to the external share service).
- New product features beyond §17 improvements.

---

## 17. Optional Improvements (separate from parity — from UX research)

These come from the existing UX research report and debt registry. They are **not** part of the parity baseline and require explicit opt-in per item. Examples to consider, smallest-first:

- Replace blocking `alert()`/`confirm()` prompts (limit reached, save warnings) with in-app modals/toasts.
- Improve export-button placement/discoverability.
- Modernize the editor (a maintained editor engine) — captured as a stack decision, not behavior.
- Accessibility / WCAG pass on modals and editor (deferred beyond this rewrite per OQ-10).

A prioritized list will be drawn from `docs/ux-research/UX-RESEARCH-REPORT.md` and `IMPLEMENTATION-PLAN.md` once parity scope is approved.

---

## 18. Open Questions / Decisions Needed

All open questions are now resolved.

1. ~~**OQ-1 Page rename UI**~~ — **Resolved: add it** (see REQ-PG-6).
2. ~~**OQ-2 Detached preview window**~~ — **Resolved: dropped** (removed from scope, see §6).
3. ~~**OQ-3 Paddle**~~ — **Resolved: stay on Paddle Classic** (required to keep the backend untouched).
4. ~~**OQ-4 Anonymous/plan limits**~~ — **Resolved: soften presentation** (non-blocking notice), enforcement preserved (see REQ-SUB-5).
5. ~~**OQ-5 Settings live-sync**~~ — **Resolved: keep load-once** for settings (item list stays live).
6. ~~**OQ-6 Renderer integration**~~ — **Resolved: keep current** isolated iframe + `postMessage` boundary (see REQ-PRV-2).
7. ~~**OQ-7 Themes**~~ — **Resolved: curated set** of a few themes (default monokai), not all ~51.
8. ~~**OQ-8 Code-blast**~~ — **Resolved: dropped.**
9. ~~**OQ-9 JS13K mode**~~ — **Resolved: dropped.**
10. ~~**OQ-10 Accessibility**~~ — **Resolved: parity only** (preserve current focus-trapping/keyboard operability; no dedicated WCAG pass this rewrite).
11. ~~**OQ-11 Desktop host**~~ — **Resolved: still required** — keep the `window.zenumlDesktop` integration seam.

---

## 19. Parity Acceptance Checklist (Phase 1, web app)

The rewrite is "at parity" when, against the unchanged backend:
- [ ] Create/edit/save/fork/delete diagrams (local + cloud) with the exact item schema and dual-write invariant.
- [ ] Multi-page create/switch/delete with default-page protection and `currentPageId` persistence.
- [ ] Live preview, console, fullscreen present mode.
- [ ] PNG download + copy-to-clipboard; standalone HTML export; JSON import/export.
- [ ] All four OAuth providers; anonymous use; first-login import offer.
- [ ] Library panel: search, folders CRUD, item actions, live list.
- [ ] Settings: full preference list with live application and correct persistence backends.
- [ ] Subscription: pricing modal, Paddle Classic checkout, cancellation, exact gating (3/20/∞, Plus-only CSS), payment flag behavior.
- [ ] Sharing: create link + read-only open + fork; embed mode.
- [ ] All keyboard shortcuts; modal inventory; one-time prompts; templates.
- [ ] Analytics events emitted as today.
- [ ] Existing E2E suites pass; production-build asset check passes.
