# ZenUML Web-Sequence — UX Research Report

**Type:** Heuristic evaluation + source-code audit. **Date:** 2026-06-04. **App:** app.zenuml.com (web + Chrome extension).

**Method & scope.** This is a *heuristic evaluation combined with a code audit* — **not** user research. There were no interviews, no usability sessions, and no analytics. Every finding is grounded in two evidence types: (1) **observed UI states**, six screens driven through the live production app as an anonymous/first-time-style user (referenced as STATE 1–6), and (2) **source code** read directly, cited as `file:line`. Findings were severity-ranked and individually verified against the code before inclusion; two hypotheses that the code contradicted were dropped and are documented in the Honesty Appendix. Because many issues surfaced under more than one evaluation lens (heuristics, accessibility, information architecture, interaction, visual, microcopy, competitive), this report **merges by underlying issue and renders each once**, listing every contributing lens and its evidence inline — cross-lens repetition is treated as corroboration (a problem flagged by five lenses is pervasive, not redundant).

No claims about frequency, conversion, or task-completion *rates* are made — those require user data this study does not have. Where impact is asserted, it is a heuristic prediction tied to a named usability principle, not a measured outcome.

---

## 1. Executive Summary — Top 5 Highest-Leverage Problems

1. **Account-free link sharing is impossible, and the share panel is built for Confluence, not for everyone.** The only share path hard-requires sign-in (`syncService.js:20-24`) and the panel leads with Confluence instructions plus a baked-in tutorial screenshot (`SharePanel.jsx:101-122`). This kills the single most viral loop for a diagram-as-code tool — "make a diagram, paste the link in chat." Competitors (Mermaid Live, sequencediagram.org) share instantly with zero account by encoding the diagram in the URL.
2. **Core controls are keyboard-inaccessible.** The ZenUML/CSS tab switch (`Tab.jsx:38`) and the folder expand/collapse row (`FolderRow.jsx:6`) are `onClick` handlers on non-interactive elements with no role, tabindex, or key handler. Keyboard-only and screen-reader users are completely blocked from the CSS editor and from browsing foldered saved work (WCAG 2.1.1, A).
3. **The Font Size setting renders blank and shows the wrong placeholder ("Select Processor").** A number-vs-string value mismatch in Radix Select (`SettingsModal.jsx:183` vs string item values) means the control never matches its current value — the settings surface looks broken at a glance. One-line fix.
4. **"My diagrams" exists as two unreconciled models — bottom Page tabs vs. left My Library panel** (`app.jsx:1714`, `PageTabs.jsx:54-101`, `LibraryPanel.jsx:360-465`) — with no labeled hierarchy explaining when to add a Page vs. save a Library item. Users cannot predict where work lands or how to find it again.
5. **Output actions (link, PNG, Copy PNG, Present) are scattered across three chrome regions** (`MainHeader.jsx:115-147`, `PageTabs.jsx:104-137`, plus a popover), and for anonymous users the PNG/Copy PNG/Share buttons look enabled but redirect to a login wall on click (`ContentWrap.jsx:550-552,572-575`) — a bait-and-switch at the highest-intent moment.

**Counts (post-consolidation):** **0 critical**, **9 major**, **15 minor** consolidated issues, synthesized from 64 verified lens-level findings. The headline fact is *0 critical* — nothing here is a hard data-loss or security blocker; the major items are accessibility blockers and high-value-task friction.

---

## 2. Design Assumptions (Personas)

> These personas are **design assumptions, not researched.** No interviews were conducted. They exist only to anchor impact reasoning and should be validated before betting on them.

- **"Dana," the developer documenting an API (assumption).** Lives in code, wants to type a sequence diagram fast, paste a link into a PR or Slack thread, and move on. Expects DSL-aware autocomplete and a no-friction shareable URL. Hit hardest by the sign-in-to-share wall and the JS-flavored autocomplete.
- **"Arjun," the architect sharing to Confluence (assumption).** Already in the Atlassian ecosystem; the Confluence-card flow is genuinely useful *to him*. He is the user the current Share panel is implicitly designed for — which is exactly why it over-serves a minority and buries the generic case.

---

## 3. Findings by Severity

Effort tags: **quick-win** (hours), **medium** (days), **strategic** (cross-cutting / multi-area). Each title carries the contributing `lens · effort`.

### CRITICAL

*No critical-severity findings were identified in this pass. No data-loss, security, or total-blocker defects were observed. The most severe issues (below) are accessibility blockers and friction on the highest-value tasks.*

### MAJOR

**M1. Account-free link sharing is impossible; share is Confluence-centric** *(competitive + heuristics + ia + interaction + microcopy · strategic)* — Evidence: `syncService.js:20-24` (auth guard throws); `SharePanel.jsx:27-41,83-89,100-122,114,119-122`; STATE 4.
- **Problem:** The only share affordance posts to a Firebase `/create-share` endpoint that hard-requires auth; anonymous users get an error path with no fallback. The panel leads with a Confluence headline + embedded `tutorial.png` + an asterisk-footnoted "Copy link*"; the key fact ("anyone with the link can view") is buried in fine print, and a "expperience" typo sits in the preview card (`SharePanel.jsx:114`).
- **Impact:** Severs the primary viral growth loop and forces a login wall at peak share intent; the Confluence framing makes the common case feel niche (Match to Real World, Aesthetic & Minimalist).
- **Recommendation:** Encode the DSL in the URL (base64/pako) so any link works with no account — keep authenticated Firebase share as an optional "durable/named" link. Lead with a prominent "Copy public link" + inline "Anyone with this link can view." Demote Confluence guidance + image into a collapsible "Using Confluence?" disclosure. Drop the asterisk; fix the typo.

**M2. Output actions fragmented across three regions; anonymous export hits a login wall** *(ia + heuristics + interaction · medium)* — Evidence: `MainHeader.jsx:115-147`; `PageTabs.jsx:104-137`; `SharePanel.jsx:64-80`; `ContentWrap.jsx:550-552,572-575`; STATE 1.
- **Problem:** Share Link (top header), Present/PNG/Copy PNG (bottom page-tabs bar), and the actual link-copy (one popover deeper) live in three unrelated containers with inconsistent styling. The PNG/Copy PNG/Share buttons render fully enabled for anonymous users, then redirect to login on click.
- **Impact:** Users scan two opposite corners to "get the diagram out"; the surprise auth gate at the payoff moment erodes trust (Consistency, Recognition over Recall, Visibility of Status).
- **Recommendation:** Consolidate all output into one "Share / Export" menu (Copy link, PNG, Copy PNG, Present); move export off the page-tabs bar (tabs are for navigation). Signal the gate up front ("Sign in to export") or allow one free export before sign-in.

**M3. Tab switcher (ZenUML/CSS) is keyboard-inaccessible** *(accessibility · quick-win)* — Evidence: `Tab.jsx:38` (rendered by `Tabs.jsx:56-62`).
- **Problem:** Bare `<li onClick>` with no role, tabindex, or key handler — not in tab order, no Enter/Space activation.
- **Impact:** Keyboard-only and screen-reader users cannot reach the CSS editing surface at all (WCAG 2.1.1 Keyboard A; 4.1.2 A).
- **Recommendation:** Render each tab as a real `<button>` (or `role="tab"` + tabindex + arrow/Enter/Space handling) inside `role="tablist"`, mirroring the working `<button>` pattern in `PageTabs.jsx:62-69`.

**M4. Folder expand/collapse row is keyboard-inaccessible** *(accessibility · quick-win)* — Evidence: `FolderRow.jsx:6`.
- **Problem:** The whole folder name row is a clickable `<div>` with `onClick` only — no button role, tabindex, key handler, or `aria-expanded`.
- **Impact:** Keyboard/SR users cannot open folders to reach the diagrams inside — a navigation dead-end in the library (WCAG 2.1.1 A; 4.1.2 A).
- **Recommendation:** Make the toggle a `<button>` with `aria-expanded={isOpen}` (move rename/delete out so it doesn't nest interactive elements), or add `role="button"` + tabindex + `onKeyDown`.

**M5. Account-menu trigger (avatar) has no accessible name when logged in** *(accessibility · quick-win)* — Evidence: `MainHeader.jsx:159-174` (logged-in, no name); contrast `:211-222` (logged-out has `aria-label`); avatar `<img>` lacks `alt` (`:160-167`).
- **Problem:** Logged-in trigger contains only an image with no `alt` and a presentational SVG → no computed accessible name; the logged-out path was given an `aria-label` but the logged-in path was missed.
- **Impact:** SR users hear an unnamed "button" and cannot tell it opens the account/logout menu (WCAG 4.1.2 A; 1.1.1 A).
- **Recommendation:** Add `aria-label="Account menu"` + `aria-haspopup="menu"` to the trigger, and a meaningful `alt` (e.g. `${displayName} avatar`) to the image.

**M6. Insufficient color contrast: user email and saved-item timestamps below AA** *(accessibility · quick-win)* — Evidence: `MainHeader.jsx:186` (text-gray-600 #5A5A5A on bg-black-400 #2c2d31 ≈ 1.99:1); item timestamps ≈ 3.8:1.
- **Problem:** Account-menu email at ~2:1 is effectively unreadable; library timestamps fail AA for body text. (Credit: inactive page-tab gray-400 at 5.98:1 and FolderRow count at 5.25:1 *do* pass — failures are specific, not blanket.)
- **Impact:** Low-vision users / bright environments cannot read their own email or timestamps (WCAG 1.4.3 AA).
- **Recommendation:** Raise email to ≥ text-gray-400 (#c2c2c2); raise timestamp to ~text-white/60; audit remaining text-white/40 and gray-600-on-dark uses.

**M7. Focus indicators suppressed with no `:focus-visible` replacement** *(accessibility · medium)* — Evidence: `style.css:744-745` (`outline:none`), `MainHeader.jsx:160` (`outline-0`); focus-outline token already exists at `style.css:9`; no `:focus-visible` anywhere in `src/`.
- **Problem:** Outlines are actively zeroed in places with no project-wide focus-visible style to restore a cue.
- **Impact:** Keyboard users lose track of focus on affected controls (WCAG 2.4.7 AA; risks 2.4.11).
- **Recommendation:** Remove gratuitous `outline:none`/`outline-0`; add a global `*:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }`.

**M8. Icon-only nav and insert toolbars rely solely on hover tooltips — no visible labels** *(heuristics + interaction + competitive · medium)* — Evidence: left rail `LeftSidebar.jsx:50,69,78,86,93,100`; insert toolbar `Toolbox.jsx:11,24,58,122,175,288,350,409,466,510`; STATE 6 (no tooltips observed). Related a11y: `Toolbox.jsx` buttons lack title/aria-label (name lives only in nested SVG `<title>`, click bound to `<svg>` not button).
- **Problem:** Both the left rail (Library, Editor, Shortcuts, Cheatsheet, Language Guide, Settings) and the ~9-button insert toolbar are pure icons; meaning is exposed only via `title`/SVG-`<title>` tooltips that appear late, never on touch, never on keyboard focus — and STATE 6 confirmed none appeared at all.
- **Impact:** New users must trial-and-error abstract glyphs to learn the core authoring toolbar; SR users get unlabeled buttons (Recognition over Recall; competitors solve this with labeled/menu-based insertion).
- **Recommendation:** Add visible/expandable labels to the left rail; add `title` + `aria-label` to each Toolbox `<button>` (bind click to the button, not the SVG) and a hover tooltip; ensure tooltips fire on keyboard focus. Consider a labeled "Insert" menu like sequencediagram.org's right-click menu.

**M9. Modal focus trap incomplete; no `role="dialog"`/`aria-modal`; focus not restored** *(accessibility · medium)* — Evidence: `Modal.jsx:30-49,56-74`.
- **Problem:** Shift+Tab leaks focus to background content (rest of page stays in tab order — no inert/aria-hidden); on close, focus drops to `<body>` instead of the opener; container has no `role="dialog"`/`aria-modal="true"`.
- **Impact:** Keyboard/SR users tab into hidden content, lose their place, and re-traverse from the top on close (WCAG 2.4.3 A; weakens 1.3.1/4.1.2).
- **Recommendation:** Add `role="dialog" aria-modal="true"`; capture `document.activeElement` on open and restore on close; trap both Tab and Shift+Tab (or apply `inert`/`aria-hidden` to the rest of `#app`).

### MINOR

**N1. "My diagrams" exists as two unreconciled models (Pages vs. My Library)** *(ia · strategic)* — Evidence: `app.jsx:1714,1738`; `PageTabs.jsx:54-101`; `LibraryPanel.jsx:360-465`.
- **Problem:** Bottom Page tabs (sub-diagrams of the current doc) and the left My Library panel (saved items in folders) are two overlapping containers of "diagrams" on opposite sides of the screen, never visually related or explained.
- **Impact:** Users cannot predict where a diagram lands or how to find it again — a classic IA failure raising lost-work and duplicate creation.
- **Recommendation:** Define and label the hierarchy ("Documents" contain "Pages"); surface the current document name above its page tabs; nest pages under the active Library item so the two read as one tree.

**N2. Library and Editor are mutually exclusive — opening saved items hides your code** *(ia · medium)* — Evidence: `app.jsx:1744` (Library forces `hideEditor=true`); `LeftSidebar.jsx:34-73`; `ContentWrap.jsx:1012`.
- **Problem:** The rail groups Library and Editor as peers, but selecting Library unmounts the editor.
- **Impact:** Breaks the "open a previous diagram while keeping current work visible" flow; users lose their place every time they peek at the library.
- **Recommendation:** Open Library as an overlay/drawer beside the editor (or allow both open) so behavior matches the visual peer grouping.

**N3. Item open/fork uses a hardcoded 350ms timeout race** *(interaction · quick-win)* — Evidence: `app.jsx:1059-1064,1080-1084,529-536`.
- **Problem:** `openItem`/fork are deferred behind a magic 350ms `setTimeout` tied to a CSS transition, not an animation-end event.
- **Impact:** On slow machines (or if the transition changes) the content swaps mid-animation → flicker or ~⅓s perceived lag on a very frequent flow.
- **Recommendation:** Drive off the panel's `transitionend` event, or open immediately and animate independently.

**N4. Inconsistent destructive/input flows: branded modal for pages, native `confirm()`/`prompt()`/`alert()` everywhere else** *(heuristics + interaction + ia + microcopy + competitive · medium)* — Evidence: branded `DeletePageModal` at `PageTabs.jsx:139-143`; native dialogs at `app.jsx:364,424,478-480,848,1046,1099`, `LibraryPanel.jsx:52,69,85,108`, `SavedItemPane.jsx:54,71,87,110,120`.
- **Problem:** The app ships a branded confirmation (delete page) but routes item delete, discard-unsaved (new/fork/logout), the diagram-limit upsell, and all folder create/rename/move/delete through unstyled blocking native dialogs. Moving an item requires *typing* the folder name (`LibraryPanel.jsx:108`) though folders are already in state; delete copy is a generic "Are you sure?" with no irreversibility note and OK/Cancel rather than Delete/Keep.
- **Impact:** Native dialogs feel broken and untrustworthy, give different mental models for the same confirm action, offer no validation, and present the paywall as an OS alert rather than a designed upgrade moment (Consistency; Error Prevention; weaker monetization UX).
- **Recommendation:** Standardize one branded confirmation component (reuse `Modal.jsx`/`DeletePageModal`) across delete, discard, and logout; replace folder prompts with an in-app input + a folder *picker* (list is in `state.folders`); convert the diagram-limit alert into a branded upgrade prompt; use action-specific copy ("Delete \"{title}\"? This cannot be undone").

**N5. "New" creation modal conflates blank-create, mislabeled "templates," and a marketing plea; has no close button or title** *(ia + heuristics + microcopy + competitive · medium)* — Evidence: `CreateNewModal.jsx:12-44` (no `Dialog.Close`, no `Dialog.Title`), `:18-40` (blank create, "Or choose from a template," tweet plea `:37-40`); `templateList.js:1-22` + `templates/template-blue.json` (these are color themes, not content); contrast `SettingsModal.jsx:309-316`, `CheatSheetModal.jsx:109-116`; STATE 3.
- **Problem:** The modal mixes three unrelated jobs — start blank, "templates" that are actually color themes (Basic/Black & White/Blue/StarUML), and a "tweet about ZenUML at least once a month" plea — has no X/Cancel and no heading, and is sometimes entered right after discarding unsaved work (`app.jsx:1098-1116`).
- **Impact:** Calling themes "templates" sets a false content-scaffold expectation; the plea reads as needy clutter at peak intent; no obvious exit violates User Control & Freedom (Aesthetic & Minimalist; learnability/trust).
- **Recommendation:** Add a `Dialog.Close` X and a title ("Create new diagram"); relabel theme cards "Styles/Themes"; add real content starters (Login/auth, REST API call, Retry with alt/loop, microservice fan-out) à la sequencediagram.org; move the tweet ask to a non-blocking surface (footer/post-export toast/Help).

**N6. Settings modal is titled "Editor," mismatching the gear entry point** *(heuristics + microcopy · quick-win)* — Evidence: `SettingsModal.jsx:51` (h3 "Editor"), `:256` ("Others"); `LeftSidebar.jsx:99-103` (gear title="Settings"); STATE 2.
- **Problem:** The universal settings gear opens a modal headed "Editor" with no top-level title naming the dialog.
- **Impact:** Users distrust they're in the right place and may keep hunting for a "real" Settings screen (Consistency; Match to Real World).
- **Recommendation:** Title the dialog "Settings"; make "Editor" a subsection above Theme/Font, sibling to "Others."

**N7. Font Size dropdown renders blank (number/string mismatch) with a copy-paste "Select Processor" placeholder** *(heuristics · quick-win)* — Evidence: `SettingsModal.jsx:183,207-246,65,105,192`; `app.jsx:106` (`fontSize: 16`); STATE 2.
- **Problem:** Radix compares numeric `value` 16 against string item `"16"` → no match → placeholder shows. Theme/Font Family work because those prefs are already strings. Placeholder reads "Select Processor."
- **Impact:** The control looks broken/unset and hides the user's actual setting (Visibility of System Status), eroding trust in the whole settings surface.
- **Recommendation:** `value={String(props.prefs.fontSize)}` (or store as string); fix placeholders to "Select font size" / theme / font.

**N8. "Share Link" silently opens login when logged out** *(heuristics · quick-win)* — Evidence: `MainHeader.jsx:115-122`.
- **Problem:** A prominent primary button labeled "Share Link" performs a different action (open login) for anonymous users, with no lock icon, tooltip, or label change.
- **Impact:** Action doesn't match label → feels like bait-and-switch (Match to Real World; Visibility of Status).
- **Recommendation:** Relabel to "Sign in to share" for logged-out users, or add an explicit inline/tooltip note before the click.

**N9. Developer jargon and silent persistence in Settings → Others** *(heuristics + microcopy · medium)* — Evidence: `SettingsModal.jsx:282-305,296-297`; default `app.jsx:96`; restore `app.jsx:285-302`; STATE 2.
- **Problem:** "Preserve console logs" is meaningless for a diagram audience; "Preserve last written code" is ON by default and silently reloads the previous session's content on launch with no "start fresh" path.
- **Impact:** Non-developers can't judge relevance; returning users see stale scratch reappear with no explanation (Match to Real World; Visibility of Status).
- **Recommendation:** Hide/rename dev-only toggles (or move under "Advanced"); add a visible "start a new diagram" affordance and a hint that the last diagram is auto-restored; surface saved-vs-scratch state.

**N10. "Preserve last written code" default-ON with no one-click "start fresh"** *(interaction · medium)* — Evidence: `app.jsx:96,285-305,1098-1110,1495-1497`.
- **Problem:** On load with prior unsaved code, the app restores scratch rather than a fresh example; the only escape is the multi-step "+ New" modal (which may itself prompt about unsaved changes).
- **Impact:** Returning users re-enter mid-edit on possibly-throwaway content with no clean-canvas path, and can't tell scratch from saved.
- **Recommendation:** Add a lightweight "New blank diagram" that bypasses the modal when nothing worth keeping is unsaved; surface saved-vs-unsaved status.

**N11. HelpModal has no entry point — Help is unreachable** *(ia · quick-win)* — Evidence: `app.jsx:71,1789-1796` (`isHelpModalOpen` never set true; confirmed via grep).
- **Problem:** HelpModal is imported and rendered, but no control sets its flag true; the rail offers Shortcuts, Cheatsheet, external Language Guide, and Settings — no Help trigger.
- **Impact:** Dead/orphaned IA; no in-app general help (closest is an external link that leaves the app).
- **Recommendation:** Wire a visible Help/"?" entry point, or remove the dead modal. Decide whether Help/Cheatsheet/Shortcuts/Language Guide consolidate into one "Learn/Help" hub.

**N12. Four learning/help affordances split across the lower rail with no grouping label** *(ia · quick-win)* — Evidence: `LeftSidebar.jsx:74-104,89-96` (external Language Guide).
- **Problem:** Shortcuts, Cheatsheet, and an external Language Guide (leaves the app) sit next to an unrelated Settings gear as bare icons with no heading and no external-link indicator.
- **Impact:** Users hunt to distinguish "syntax reference" from "app settings"; the external item silently navigates away (findability; category clarity).
- **Recommendation:** Group the three learning items under one "Help/Learn" entry separate from Settings; add an external-link indicator to Language Guide.

**N13. Auto-generated titles use an ambiguous, locale-unfriendly date-time** *(microcopy + heuristics + ia + interaction + competitive · quick-win)* — Evidence: `app.jsx:380-391`; used as nav label at `PageTabs.jsx:68`; regex `app.jsx:1171`; STATE 1.
- **Problem:** `'Untitled ' + getDate() + '-' + (getMonth()+1) + '-' + getHours() + ':' + getMinutes()` → "Untitled 3-6-19:55": no year, no zero-padding, day-month ambiguity, and a colon that reads as a clock time. The library fills with near-identical "Untitled …" strings.
- **Impact:** Saved work is hard to tell apart and scan — hurts findability on the core return-visit flow (Match to Real World; Recognition over Recall).
- **Recommendation:** Use a sortable, unambiguous format ("Untitled 2026-06-03 19:55" via `toLocaleString`/padded ISO) or seed the title from the first participant/message so titles are self-describing.

**N14. "Asyc message" typo in the Cheat Sheet syntax reference** *(microcopy + heuristics · quick-win)* — Evidence: `CheatSheetModal.jsx:47`; STATE 5.
- **Problem:** The canonical DSL reference misspells "Async message."
- **Impact:** Typos in the learning-critical reference reduce trust and seed the wrong term in the user's mental model (Help & Documentation accuracy).
- **Recommendation:** Fix to "Async message"; audit the rest of the cheat-sheet labels against docs.zenuml.com while editing.

**N15. Marketing "tweet about us" plea inside the New-creation flow** *(heuristics + microcopy + competitive · quick-win)* — Evidence: `CreateNewModal.jsx:37-40`; STATE 3. *(Also folded into N5 structurally; called out here as a standalone microcopy/competitive issue.)*
- **Problem:** A recurring social-promotion request is the only body copy below the templates at peak creation intent — no comparison tool gates its create flow this way.
- **Impact:** Adds emotional friction and a needy tone at the highest-intent moment, lowering perceived professionalism (Aesthetic & Minimalist).
- **Recommendation:** Remove from the creation flow; relocate to a post-success toast, footer, or Help/About.

---

### Visual / Design-System Findings (root cause + symptoms)

The visual lens isolated one **strategic root cause** feeding several minor symptoms. Treat the root cause as the real work; the symptoms resolve once it lands.

**V0 (root cause). Three coexisting color systems with no single source of truth** *(visual · strategic)* — Evidence: CSS variables `style.css:3-13`; Tailwind tokens `tailwind.config.js`; arbitrary bracket-hex literals in `Toolbox.jsx:64` (#A5A5A5, already gray-500), `LibraryPanel.jsx:365,372,391,401`, `EditorPanel.jsx:139,204`, `LeftSidebar.jsx:33`.
- **Problem:** Color is defined in CSS variables, Tailwind theme tokens, and inline bracket-hex literals in newer panels; recurring hexes (#111722, #232f48, #1a2332, #135bec) and #A5A5A5 are hardcoded though equivalents exist.
- **Impact:** A theme/brand change requires hunting three systems; values silently diverge — the root cause of the inconsistency seen in STATE 1.
- **Recommendation:** Consolidate to one palette: lift recurring panel hexes into named Tailwind tokens, replace #A5A5A5 with gray-500, and lint arbitrary bracket-hex in JSX as an error.

**V1. Token "primary" maps to two unrelated colors** *(visual · medium)* — Evidence: `tailwind.config.js:34` (primary #6786f7) vs `style.css:268` (.btn--primary gold #d3a447). **Fix:** unify `--color-button` and Tailwind `primary` to one hue; migrate `.btn--primary` onto the token.

**V2. Three different blues all do the "active/primary" job** *(visual · medium)* — Evidence: #6786f7 (`tailwind.config.js:34`), #135bec (`LibraryPanel.jsx:391,401`, `EditorPanel.jsx:143`), #3b82f6 (`style.css:390`). **Fix:** one accent blue via one token; remove the other two.

**V3. Header CTA hierarchy inverted — only the secondary action is saturated** *(visual · medium)* — Evidence: `MainHeader.jsx:71` (New = bg-black-600), `:117,:132` (Share Link = bg-primary); `ProductVersionLabelAbstract.jsx:8` (Upgrade = bg-black-600). **Fix:** define a 3-tier button scale (filled/outline/ghost); give the filled style to the genuine primary action for the context; demote Share unless analytics justify it.

**V4. Button visual language fragmented across `.btn`/`.button`/`.icon-button` + inline Tailwind** *(visual · strategic)* — Evidence: `style.css:249,801,2021`; `MainHeader.jsx:71,117`; `ProductVersionLabelAbstract.jsx:8`. **Fix:** one button component with documented variants; migrate ad-hoc classes onto it.

**V5. Icon delivery uses four incompatible mechanisms** *(visual · strategic)* — Evidence: font (`LeftSidebar.jsx:52`), sprite (`MainHeader.jsx:66`), inline SVG (`Toolbox.jsx:64`), `<img>` (`ProductVersionLabelAbstract.jsx:13`). **Fix:** standardize on the existing xlinkHref sprite (color-inherits well); migrate material-symbols + Toolbox SVGs into it; reserve `<img>` for raster brand assets.

**V6. Icon font is CDN-only with no fallback; failure renders raw words ("folder_open")** *(accessibility · medium)* — Evidence: `index.html:17` (CDN-only), `style.css` (no `@font-face`), `LeftSidebar.jsx:52`. Compounds M8 where the glyph is the only label, and offline use is a stated product feature. **Fix:** self-host with `@font-face` + `font-display:swap` (or ship inline SVGs); ensure every icon-only control has a text/aria-label so meaning never depends on the glyph.

**V7. FolderRow rename/delete icon buttons have `title` but no `aria-label`** *(accessibility · quick-win)* — Evidence: `FolderRow.jsx:17-30`; contrast `ItemTile.jsx:29-31` (which *do* have aria-labels). **Fix:** add `aria-label={`Rename folder ${folder.name}`}` / `Delete folder …`.

**V8. Tiny diagram floats in a vast empty dotted canvas** *(visual · medium)* — Evidence: `style.css:682-691`; STATE 1. **Fix:** zoom-to-fit/center on load, or use a content-hugging frame with padding so the diagram is the focal point.

**V9. "ZenUML.com" watermark sits on the diagram canvas** *(visual · medium)* — Evidence: STATE 1; origin `preview.html:4` + `utils.js:6` (renderer is `@zenuml/core`, not this repo). **Fix:** decide intent — style as a subtle footer mark with controlled opacity, or gate behind plan logic; coordinate in `@zenuml/core`.

**N16. Literal `<br>` tags in the default diagram's code comments** *(microcopy · quick-win)* — Evidence: `app.jsx:394,396`. **Fix:** remove the `<br>` tokens — the template literal already uses real newlines so they're redundant *in the editor source view*. (See Honesty Appendix: a related claim that this corrupts the *rendered* diagram was rejected — the `<br>` renders correctly in the diagram via marked/DOMPurify. This finding is scoped to the editor-source reading only and kept as low-priority.)

---

### Competitive-only Findings (no internal-heuristic duplicate)

**C1. No DSL-aware autocomplete — editor hints with JavaScript completions** *(competitive · medium)* — Evidence: `ContentWrap.jsx:1033` (DSL mode = 'javascript'); `UserCodeMirror.jsx:120-122` (Ctrl-Space → generic javascript-hint); no `registerHelper('hint', …)` in `src/`.
- **Problem:** sequencediagram.org offers DSL-tuned Ctrl/Cmd-Space completion + a right-click insert menu. ZenUML's Ctrl-Space suggests JS identifiers, not ZenUML constructs (`participant`/`alt`/`loop`/`par`/`opt`).
- **Impact:** The DSL keywords — the core thing a new user must learn — are undiscoverable in the editor; learnability falls entirely on the Cheat Sheet. Higher time-to-first-correct-diagram than competitors.
- **Recommendation:** Register a ZenUML-DSL hint provider (`CodeMirror.registerHelper('hint', …)`) completing in-buffer participants + the DSL keyword set, bound to the ZenUML mode instead of javascript-hint.

**C2. Templates are color themes, not runnable example starters** *(competitive · medium)* — Evidence: `templateList.js:1-22`; `CreateNewModal.jsx:26-36`; STATE 3. *(Structurally part of N5; retained here as the competitive learnability gap.)*
- **Problem:** Competitors seed concrete scenario examples ("copy source" under each rendered example); ZenUML's "templates" only change colors.
- **Impact:** Picking a template teaches no DSL pattern — a missed learnability lever.
- **Recommendation:** Add content starters (auth flow, REST call, retry with alt/loop, microservice fan-out) alongside the color themes.

---

## 4. Competitive Insights — What to Copy

Distilled from the competitive lens (Mermaid Live Editor, sequencediagram.org, swimlanes.io, Excalidraw). These are *moves to adopt*, not a re-listing of the findings above.

| Competitor strength | ZenUML gap | Move to copy |
|---|---|---|
| **Account-free URL sharing** (Mermaid Live, sequencediagram.org encode source in the URL) | Share hard-requires sign-in (`syncService.js:20-24`) | Encode the DSL in the URL (base64/pako); make account-free the default share, keep Firebase as optional durable link. **Highest-leverage competitive move.** |
| **Neutral, platform-agnostic share panel** | Confluence-first panel with embedded tutorial image (STATE 4) | Lead with "Copy link / Copy image" + "Anyone with the link can view"; demote Confluence to a collapsible section. |
| **DSL-aware autocomplete + right-click insert menu** (sequencediagram.org) | Generic javascript-hint; icon-only insert toolbar with no labels | DSL hint provider; labeled "Insert" menu. |
| **Library of runnable example diagrams** | "Templates" are just color themes | Ship content starters that teach syntax patterns. |
| **Branded in-app dialogs** (Mermaid, Excalidraw keep everything in-product) | Native `confirm()`/`alert()`/`prompt()` for delete, limits, folders | One branded confirmation component; branded upgrade prompt for the diagram limit. |
| **Friction-free create flow** | Tweet-plea inside the New modal | Remove the plea from the create path. |

---

## 5. Prioritized Roadmap

**Quick Wins** = high impact / low effort (the major + quick-win quadrant first, then high-value minor quick-wins). **Strategic bets** = the `strategic`-effort, cross-cutting investments.

### Quick Wins (do first)

| Finding | Why it's high-leverage | Effort |
|---|---|---|
| N7 — Font Size renders blank ("Select Processor") | Settings looks broken at a glance; one-line `String()` fix | quick-win |
| M3 — Tab switcher keyboard-inaccessible | Unblocks the CSS editor for keyboard/SR users (WCAG A) | quick-win |
| M4 — Folder toggle keyboard-inaccessible | Unblocks library navigation for keyboard/SR users (WCAG A) | quick-win |
| M5 — Account-menu trigger has no accessible name | Names the primary account control for SR users (WCAG A) | quick-win |
| M6 — Email/timestamp contrast below AA | Makes own email + timestamps readable (WCAG AA) | quick-win |
| V7 — FolderRow rename/delete missing aria-label | Prevents accidental destructive folder deletion (WCAG A) | quick-win |
| N8 — "Share Link" silently opens login | Removes a bait-and-switch label | quick-win |
| N13 — Ambiguous "Untitled 3-6-19:55" titles | Restores library findability | quick-win |
| N14 — "Asyc message" typo | Trust in the canonical reference | quick-win |
| N15 — Tweet plea in create flow | Removes needy friction at peak intent | quick-win |
| N6 — Settings titled "Editor" | Entry-point/destination label match | quick-win |
| N11 / N12 — Help unreachable; ungrouped learning rail | Surfaces dead Help; clarifies categories | quick-win |
| N3 — 350ms open/fork race | Removes flicker on a frequent flow | quick-win |
| N16 — Literal `<br>` in default comments | Cleans the first example's source view | quick-win |

### Strategic Bets (plan deliberately)

| Finding | Investment | Effort |
|---|---|---|
| M1 — Account-free URL sharing + neutral share panel | The single biggest growth + trust lever | strategic |
| N1 — Reconcile Pages vs. My Library into one labeled hierarchy | Fixes the core "where is my work" IA failure | strategic |
| V0 — Consolidate three color systems into one palette | Root cause behind V1/V2/V3 and visual drift | strategic |
| V4 — One button component with documented variants | Resolves button-language fragmentation | strategic |
| V5 — One icon-delivery system (sprite) | Resolves icon weight/theming inconsistency | strategic |

### Medium (between the two)

M2 (consolidate + de-trap output actions), M7 (`:focus-visible`), M8 (toolbar labels), M9 (modal focus trap), V6 (self-host icon font), N2 (Library/Editor coexistence), N4 (branded dialogs everywhere), N5 (New-modal restructure), N9/N10 (preserve-code UX), V1/V2/V3/V8/V9 (visual symptoms), C1 (DSL autocomplete), C2 (content templates).

---

## 6. Honesty Appendix — Rejected Hypotheses

Two findings were investigated and **dropped** because the code contradicted their central claim. Recording them documents the verification rigor.

1. **"Autosave silently does nothing until the first manual save" — REJECTED.** The claim was that `isAutoSavingEnabled` flips only after a completed manual `saveItem` (`app.jsx:876-878`). But `setCurrentItem` auto-invokes `this.saveItem()` at `app.jsx:459` on every startup/item path (createNewItem 304→382→459, load-last-code 301, item-load 248/252). That non-manual startup save runs `saveCode().then()` at 876 and, when `prefs.autoSave` is true (default via `db.getSettings` at 220, also set from `onAuthStateChanged` 161-166), enables autosave with no manual Save/Cmd+S. The only path where the flag stays false is an anonymous user who *cancels* the `confirm()` at 848 — i.e. explicitly declined to save, so autosave staying off is correct, not a silent failure. The "critical / never autosaved" framing does not hold.

2. **"Default starter diagram embeds literal `<br>` tags inside JS comments (corrupting the rendered diagram)" — REJECTED as framed.** The `<br>` text does exist in the default `js` (`app.jsx:394-397`), but the claimed consequence is false: those `//` lines are ZenUML DSL comments rendered through `marked.parse()` + `DOMPurify.sanitize()` + `dangerouslySetInnerHTML` (`@zenuml/core` `Comment.tsx`), so `<br>` produces an actual line break in the **rendered** diagram — it is intentional formatting. The same renderer has a custom codespan handler for `POST /v1/...` REST endpoints, matching line 397, strong evidence the comment block was deliberately authored as rendered markdown. The original finding confused the CodeMirror *source* pane with the diagram *output*. The narrow, low-priority residue — that the literal `<br>` is visible in the editor source view and is redundant given real newlines — is retained as **N16**, not as a rendering bug.
