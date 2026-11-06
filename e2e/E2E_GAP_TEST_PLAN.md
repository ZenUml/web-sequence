# E2E Gap Test Plan — features not yet covered by Playwright

**Purpose.** The editor/DSL language is exhaustively covered (≈250 tests in
`web/e2e/`: completion, snippets, indentation, brackets, highlighting). The
app-level surface (auth, sharing, subscription, settings depth, preview controls,
library actions, export variants, mobile) is thinly covered by the root
`e2e/tests/` staging-gate suite. This plan enumerates the **uncovered** behaviors
and a test for each, so the suite can grow to cover the whole product.

**Already covered (do NOT re-plan):** editor typing/completion/snippets/indent/
highlight (`catalog*`, `editor-language`, `typing-mechanics`); DSL→SVG render
(`dsl-spot-check`, `smoke`); embed-by-value `?code` + open-in-app + shortcuts-off
(`embed`); library list/search/export-all/import-JSON (`library`); multi-page
add/switch + last-code restore + New-resets (`persistence`); modal **open** +
one action for Settings(font-size)/Create-New/Help/Cheat-Sheet/Shortcuts/Pricing
(`modals`); Report-a-bug FAB→modal→GitHub URL (`report-bug`); routing
editor-as-landing + `?view=diagrams` (`smoke`).

## Legend

**Dependency** — what infra a test needs (drives where it can run):
- `UI` — pure browser, no backend. Runs today (local dev + staging gate).
- `AUTH` — needs a signed-in session (Firebase Auth emulator or a seeded test account).
- `CLOUD` — needs Firestore + cloud functions (`create-share`, `sync-diagram`, `get-shared-item`) — emulator.
- `PADDLE` — needs Paddle sandbox or a mocked `usePaddle`.
- `MOBILE` — needs Playwright viewport/device emulation (no backend).

**Priority** — `P0` core journey, `P1` important, `P2` edge/polish.

**Note on infra.** Most `AUTH`/`CLOUD`/`PADDLE` cases are why these gaps exist —
the staging gate runs signed-out against a live deploy. Recommended unlock:
stand up the **Firebase emulator suite** (auth + firestore + functions) for a
new `e2e/tests/*.cloud.spec.js` project, and mock Paddle's `openCheckout`. Unit
coverage already exists for the services (`useShare`, `subscriptionService`,
`exportImport`, `folderService`, …) — these e2e cases target the **UI + wiring**,
not the pure logic.

---

## 1. CSS editor & custom-CSS gate

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| CSS-1 | CSS pane expands/collapses ("Custom CSS · click to expand" footer) | Click footer; assert CSS CodeMirror surface visible/hidden | UI | P1 |
| CSS-2 | CSS mode select offers CSS/SCSS/Sass/Less/Stylus/ACSS | Open mode select; assert all 6 options | UI | P1 |
| CSS-3 | SCSS/Less/Stylus source transpiles → preview reflects compiled CSS | Enter `$c:red; .label{color:$c}` (scss); assert preview label color | UI | P1 |
| CSS-4 | ACSS mode reveals the Atomic-CSS settings entry; opens `AtomicCssSettingsModal` | Switch mode→acss; click settings; assert modal | UI | P2 |
| CSS-5 | Non-plain CSS mode gated behind Plus for signed-out/free users (→ pricing) | Switch to scss while free; assert pricing/upgrade prompt (`cssGated`) | AUTH | P1 |
| CSS-6 | Prettier-format CSS (Ctrl+Shift+F) reformats the CSS buffer | Type minified CSS; press shortcut; assert formatted | UI | P2 |

## 2. Preview controls

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| PRV-1 | Present/fullscreen toggle expands diagram, hides editor/console; Exit restores | Click Present; assert editor hidden + fullscreen surface; Exit; assert restored | UI | P0 |
| PRV-2 | Debug console toggles open/closed; shows render output | Toggle console; assert panel; assert "No issues" / entries | UI | P1 |
| PRV-3 | Ctrl+L clears the console | Produce entries; Ctrl+L; assert console emptied | UI | P2 |
| PRV-4 | Console eval runs JS against preview iframe and returns a result | Type expression in console input; assert echoed result | UI | P2 |
| PRV-5 | Mobile (<768px, non-fullscreen) renders native **SVG** (fit-to-width), not fixed-px HTML | Emulate phone; assert `#svg-mount` svg present, width:100% | MOBILE | P1 |
| PRV-6 | Auto-preview off → edits do NOT re-render until manual refresh | Disable auto-preview (settings); edit; assert preview stale until refresh | UI | P2 |
| PRV-7 | Refresh-on-resize setting re-renders on window resize | Enable; resize viewport; assert re-render | UI | P2 |
| PRV-8 | Zoom indicator shows 100% (presentational) | Assert renderer header shows `100%` | UI | P2 |

## 3. Multi-page (beyond add/switch)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| PG-1 | Rename page inline (double-click tab / menu) commits new title | Double-click page tab; type; blur; assert tab label | UI | P1 |
| PG-2 | Delete non-default page shows confirm, removes the page | Add page; delete; confirm; assert tab gone + active page falls back | UI | P1 |
| PG-3 | Default (first) page cannot be deleted (no delete affordance) | Assert page 1 has no delete control | UI | P2 |
| PG-4 | Page metadata edits mark the item dirty (drive autosave) | Rename page; assert unsaved indicator | UI | P2 |

## 4. Library / Hub actions

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| LIB-1 | Card kebab → **Duplicate** creates a copy row | Seed item; kebab→Duplicate; gotoHome; assert 2 rows | UI | P1 |
| LIB-2 | Card kebab → **Delete** removes the row (with confirm if any) | Seed item; kebab→Delete; assert row gone | UI | P0 |
| LIB-3 | Card kebab → **Export as HTML** downloads a standalone file | kebab→Export HTML; assert download `*.html` | UI | P1 |
| LIB-4 | Sort toggle (Updated ↔ Title A–Z) reorders the grid | Seed items with known titles/dates; toggle sort; assert order | UI | P2 |
| LIB-5 | Card shows DSL preview (≤240 chars), title, last-updated date | Seed; assert card body contains DSL snippet + date | UI | P2 |
| LIB-6 | "New diagram" CTA from hub opens a blank editor | Click home-new; assert editor with starter/blank | UI | P1 |
| LIB-7 | Signed-out hub shows a sign-in affordance | gotoHome signed-out; assert sign-in prompt visible | UI | P2 |
| LIB-8 | Empty-state ("No diagrams yet") shows New + Browse templates | Fresh hub; assert empty-state CTAs | UI | P1 |

## 5. Folders

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| FLD-1 | Create folder; it appears in the folder list with 0 count | Create folder "Work"; assert listed, count 0 | AUTH/CLOUD | P1 |
| FLD-2 | Move a diagram into a folder; folder count increments; "Unfiled" decrements | Drag/menu-move item; assert counts | AUTH/CLOUD | P1 |
| FLD-3 | Rename folder | Rename; assert new label | AUTH/CLOUD | P2 |
| FLD-4 | Delete folder; its items return to Unfiled | Delete; assert items unfiled | AUTH/CLOUD | P2 |
| FLD-5 | "All" vs "Unfiled" filters the grid | Click each; assert filtered set | AUTH/CLOUD | P1 |

> Verify whether folders are local-only (then `UI`) or cloud-backed (`CLOUD`) — `useFolders.ts`/`folderService.ts`.

## 6. Templates

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| TPL-1 | "Browse templates" opens the full `CreateNewModal` picker | Hub→Browse templates; assert modal grid | UI | P1 |
| TPL-2 | Each template (Basic, B&W, Blue, starUML, Blank) loads its DSL+CSS and opens editor | For each card: select; assert editor DSL matches template | UI | P1 |
| TPL-3 | Template previews render the schematic CSS thumbnail | Assert each card shows a styled preview | UI | P2 |

## 7. Settings (beyond font-size)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| SET-1 | Editor **theme** change applies live to CodeMirror | Change theme; assert `.cm-editor` theme class/colors change | UI | P1 |
| SET-2 | **Keymap = Vim** enables Vim bindings (e.g. `i`/`Esc` modal editing) | Set vim; assert vim status / modal behavior in editor | UI | P1 |
| SET-3 | **Font family** change applies to `.cm-content` | Change family; assert computed font-family | UI | P2 |
| SET-4 | **Indent** unit (2/4/8/tabs) changes auto-indent width | Set indent=4; Enter in block; assert 4-space indent | UI | P1 |
| SET-5 | Behavior toggles (line-wrap, auto-close, autocomplete, auto-save) take effect | Toggle each; assert observable effect | UI | P1 |
| SET-6 | Settings persist across reload (local syncStore) | Change; reload; assert retained | UI | P1 |
| SET-7 | Signed-in: settings persist to cloud and survive a fresh session | AUTH; change; re-login elsewhere; assert retained | AUTH/CLOUD | P2 |
| SET-8 | "Replace new tab" toggle hidden on web (extension-only) | Assert control absent in web context | UI | P2 |

## 8. Persistence / autosave (beyond last-code)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| PST-1 | Auto-save 15s loop fires only when enabled AND dirty | Enable; edit; wait; assert save occurs; clean → no save | UI/AUTH | P1 |
| PST-2 | Save indicator transitions Unsaved → Saving… → Saved (signed-in) | AUTH; edit→save; assert state labels | AUTH | P1 |
| PST-3 | Read-only (shared) item: Save disabled, Fork offered | Open read-only; assert Save disabled + Fork present | CLOUD | P1 |
| PST-4 | Read-only item is NOT written to the last-code slot (no stale re-boot) | Open read-only; reload `/`; assert NOT the shared item | CLOUD | P2 |
| PST-5 | preserve-last-code = off → reload `/` shows starter, not last edit | Disable setting; edit; reload; assert starter | UI | P2 |

## 9. Authentication

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| AUTH-1 | Sign-in modal lists Google/GitHub/Facebook/Twitter providers | Open login; assert 4 provider buttons | UI | P1 |
| AUTH-2 | Google sign-in completes → profile menu shows name/photo/plan | AUTH emulator; sign in; assert ProfileMenu | AUTH | P0 |
| AUTH-3 | Last-used provider re-surfaces as elevated/primary on next login | Sign in (GitHub); sign out; reopen; assert GitHub primary + chip | AUTH | P2 |
| AUTH-4 | Auth error surfaces in the modal alert | Force provider error; assert error text | AUTH | P2 |
| AUTH-5 | Login modal auto-dismisses once auth resolves | Sign in; assert modal closes (P5 regression) | AUTH | P1 |
| AUTH-6 | Sign-out clears session, returns to editor/hub, hides profile menu | Sign out; assert signed-out chrome | AUTH | P1 |

## 10. Import-on-login

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| IOL-1 | First sign-in with local diagrams offers `AskToImportModal` | Seed locals; sign in; assert import prompt | AUTH | P1 |
| IOL-2 | Accepting import uploads local items to the cloud account | Accept; assert items present after reload signed-in | AUTH/CLOUD | P1 |
| IOL-3 | Declining keeps locals untouched, no upload | Decline; assert no cloud write | AUTH/CLOUD | P2 |

## 11. Sharing

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| SHR-1 | Share button: anonymous → opens sign-in first | Signed-out; click Share; assert login modal | AUTH | P1 |
| SHR-2 | Create share link → popover shows `?id=&share-token=` URL | AUTH; Share; assert URL in popover | CLOUD | P0 |
| SHR-3 | Copy button copies URL and shows "Copied ✓" | Click copy; assert confirmation + clipboard | CLOUD | P1 |
| SHR-4 | Stop-sharing revokes the token | Stop sharing; assert link no longer resolves | CLOUD | P2 |
| SHR-5 | Opening a share URL renders the diagram **read-only** + "Open in ZenUML" | Visit share URL; assert read-only render + link | CLOUD | P0 |
| SHR-6 | Fork a shared item → owned editable copy (clears readonly/shareToken) | Open shared; Fork; assert editable + new id | CLOUD | P1 |
| SHR-7 | Bad share link → `ShareErrorNotice` with "Start fresh" | Visit bad token; assert error modal | CLOUD | P2 |
| SHR-8 | Share button disabled for read-only items | Open read-only; assert Share disabled | CLOUD | P2 |

## 12. Export / Import (beyond export-all / import-JSON)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| EXP-1 | Export PNG downloads a `.png` of the diagram | Trigger PNG export (preview menu); assert download | UI | P1 |
| EXP-2 | Export SVG downloads an `.svg` | Trigger SVG export; assert download | UI | P1 |
| EXP-3 | Export-as-HTML produces a self-contained file that renders standalone | Export HTML; open file; assert diagram renders (CDN core) | UI | P1 |
| EXP-4 | Import of malformed JSON shows an error dialog (not silent) | Import bad file; assert error modal | UI | P1 |
| EXP-5 | Import merge skips duplicate IDs; reports added count | Import overlapping set; assert only new rows added | UI | P2 |

## 13. Subscription / pricing

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| SUB-1 | Pricing modal shows 4 tiers (Starter/Basic/Plus/Enterprise) | Open pricing; assert tiers | UI | P1 |
| SUB-2 | Upgrade (signed-in) opens Paddle checkout for the chosen plan | AUTH; click Upgrade; assert `openCheckout(plan)` | PADDLE | P1 |
| SUB-3 | Upgrade (anonymous) → sign-in → resumes checkout for the captured plan | Signed-out Upgrade; sign in; assert checkout resumes (`5751479`) | AUTH/PADDLE | P1 |
| SUB-4 | Plan-limit at save: free user over 3 diagrams → limit notice + "Free Limit" event; local copy kept, cloud write withheld | AUTH free; exceed cap; save; assert notice + no cloud write | AUTH/CLOUD | P0 |
| SUB-5 | "Manage subscription" link present for paid users (Paddle cancel URL) | AUTH plus; assert manage link | AUTH | P2 |
| SUB-6 | Plus-only features show the Plus badge (informational) | Assert badge on gated settings | UI | P2 |

## 14. Header / title / actions

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| HDR-1 | Inline title edit: click → focus, type, Enter commits | Edit title; assert committed | UI | P1 |
| HDR-2 | Title edit Escape cancels (reverts) | Type; Escape; assert original | UI | P2 |
| HDR-3 | Unsaved marker (`*`/`•`) appears on edit, clears on save | Edit; assert marker; save; assert cleared | UI/AUTH | P1 |
| HDR-4 | Fork button duplicates current item into an owned copy | Click Fork; assert new editable item | CLOUD | P2 |
| HDR-5 | Breadcrumb "← Your diagrams" returns to the hub | Click breadcrumb; assert `?view=diagrams` hub | UI | P1 |
| HDR-6 | Signed-out header shows "Sign in"; signed-in shows profile menu | Toggle auth; assert correct affordance | AUTH | P1 |

## 15. Keyboard shortcuts (beyond Cmd+Shift+?)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| KB-1 | Cmd/Ctrl+S triggers a save | Edit; press save; assert save fired | UI/AUTH | P1 |
| KB-2 | Ctrl+L clears the console | (see PRV-3) | UI | P2 |
| KB-3 | Editor find/replace/comment/format shortcuts work (smoke) | Exercise one of each via keymap | UI | P2 |

## 16. Embed (beyond by-value)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| EMB-1 | Embed by-reference `?embed&id=&share-token=` renders the shared diagram | CLOUD; visit; assert embed render | CLOUD | P1 |
| EMB-2 | Embed empty state ("Diagram unavailable") on bad `?code`/bad token | Visit bad embed; assert empty-state + open-in-app | UI/CLOUD | P1 |
| EMB-3 | Embed posts content-size to parent (responsive iframe sizing) | Listen for postMessage dimensions; assert message | UI | P2 |
| EMB-4 | Legacy JSON-encoded `?code=` (not bare DSL) still renders | Visit legacy ?code; assert render | UI | P2 |

## 17. Modals (uncovered / deeper)

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| MOD-1 | Onboarding modal shows once per profile (localStorage `onboarded`) | Fresh profile; assert modal; reload; assert gone | UI | P1 |
| MOD-2 | Support-Pledge modal shows when app.version > lastSeenVersion, once | Bump version; assert modal; reload; assert gone | UI | P2 |
| MOD-3 | Only one modal open at a time (opening a 2nd closes the 1st) | Open Settings then Help; assert Settings closed | UI | P1 |
| MOD-4 | Help modal links (Docs/Contact/GitHub) have correct hrefs + new-tab | Assert href + target=_blank rel=noopener | UI | P2 |
| MOD-5 | Cheat-sheet lists all documented rows (participant…comment) | Assert each example row present | UI | P2 |
| MOD-6 | Shortcuts modal lists global + editor shortcut groups | Assert both sections | UI | P2 |
| MOD-7 | Login modal opens from header "Sign in" and from gated actions | Trigger both; assert modal | UI | P1 |

## 18. Mobile / responsive

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| MOB-1 | Mobile: segmented control toggles Editor ↔ Preview panes | Phone viewport; toggle; assert active pane | MOBILE | P1 |
| MOB-2 | Mobile hub header is two-row; collapses to one row at sm+ | Phone vs sm; assert layout | MOBILE | P2 |
| MOB-3 | Action buttons go icon-only on mobile (text hidden) | Phone; assert Share/Present icon-only | MOBILE | P2 |
| MOB-4 | Modals fit the viewport and scroll (no overflow) on small screens | Phone; open a tall modal; assert contained | MOBILE | P2 |

## 19. Analytics / telemetry

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| ANL-1 | `landed_in_editor{bootKind}` fires once per editor boot | Intercept analytics; boot; assert one event w/ label | UI | P1 |
| ANL-2 | `hub_opened{source}` fires on hub arrival; re-arms on Back | Open hub via param then breadcrumb/Back; assert correct labels | UI | P1 |
| ANL-3 | `first_edit` fires once per mount on first DSL edit | Edit; assert single event | UI | P2 |
| ANL-4 | `saveBtnClick`, `shareLink`, `itemsImported`, `Free Limit` fire with legacy envelope | Exercise each; assert category/label/value | mixed | P2 |

## 20. Connectivity

| ID | Behavior | Method | Dep | Pri |
|----|----------|--------|-----|-----|
| NET-1 | Offline status reflected in UI; local edits still persist | Go offline; edit; assert offline indicator + local save | UI | P2 |
| NET-2 | Reconnect resumes cloud sync without data loss | AUTH; offline edits; reconnect; assert synced | AUTH/CLOUD | P2 |

---

## Coverage map (what unlocks what)

| Bucket | Cases | Runnable today (signed-out, live deploy) |
|--------|-------|-------------------------------------------|
| `UI` (pure browser) | CSS-1..4/6, PRV-1..4/6..8, PG-*, LIB-1..8(local), TPL-*, SET-1..6/8, PST-1/5, EXP-1..5, SUB-1/6, HDR-1..3/5, KB-*, EMB-2..4, MOD-*, ANL-1/3, NET-1 | **Yes** — biggest immediate win; add as new root specs |
| `MOBILE` | PRV-5, MOB-1..4 | Yes (Playwright device project) |
| `AUTH` | AUTH-*, IOL-*, SET-7, PST-2, SHR-1, SUB-3/5, HDR-6 | Needs Firebase **Auth emulator** / test account |
| `CLOUD` | FLD-*, PST-3/4, SHR-2..8, SUB-4, HDR-4, EMB-1, NET-2 | Needs **Firestore + functions emulator** |
| `PADDLE` | SUB-2/3 | Needs Paddle **sandbox** or mocked `usePaddle` |

**Recommended sequencing**
1. **P0/P1 `UI` cases** → new specs `e2e/tests/{preview,library-actions,settings,export,multipage,modals,templates}.spec.js`. No infra; runs in the staging gate signed-out. Largest coverage gain for least cost.
2. **`MOBILE`** → a Playwright `devices['Pixel 7']`/`iPhone 14` project; covers PRV-5 + MOB-*.
3. **Emulator project** `*.cloud.spec.js` (auth + firestore + functions) → unlocks AUTH/CLOUD (sharing, folders, plan limits, import-on-login, save indicator).
4. **Paddle** mock → SUB-2/3.

**Out of e2e scope (keep at unit level — already covered):** transpiler logic
(`transpilers`), `buildIssueUrl`, `exportImport` parse/merge, `planLimit`,
`semver`, `templates`, store reducers, `parseEmbedCode`. The e2e cases above
target the **UI + wiring**, not this logic.
