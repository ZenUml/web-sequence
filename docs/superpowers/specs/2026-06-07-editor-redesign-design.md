# ZenUML Editor Redesign — Implementation Spec

Source: Claude Design handoff bundle (`tmp/design-bundle/extracted/web-app-v2/`),
primary file `ZenUML Editor - Redesign & Solutions.html` + 3 chat transcripts.
Target: real `web/` React 19 codebase on branch `rewrite/web-foundation`.

The design is a static HTML/CSS prototype using the "Drafting Table" token language,
which maps 1:1 onto the repo's existing Tailwind tokens (`ink-*`, `accent`,
`accent-onDark`, `paper-*`, `signal-amber`, `emerald`/`ok`). No new tokens needed.
We recreate the **visual output**, not the prototype's DOM.

## Confirmed decisions

1. **Scope: everything, phased.** Phase 1 (core chrome §01+§02) specced in detail here;
   phases 2–4 are a roadmap, each gets its own spec→plan→build→ship→screenshot cycle.
2. **File menu = Figma two-menu split.** Logo (▾) = app menu; filename chevron (▾) =
   document menu; clicking the name itself = inline rename.
3. **Save = pure auto-save state.** Remove the Save button; show `Saved / Saving… /
   Unsaved` indicator. **Flip `DEFAULT_SETTINGS.autoSave` to `true`** (currently `false`,
   `domain/types.ts:106`). Manual save stays reachable on ⌘S and in the app menu.
   - Guard the two cases the old Save button handled: **anonymous users** (no Firebase
     target — indicator must not claim "Saved" misleadingly; auto-save is a no-op/local)
     and **read-only diagrams** (no save attempts).
4. **`_STARTER_` console finding** and the **JS/"JavaScript" language selector** finding
   are ALREADY resolved in the live build (`fe95fee` removed the JS dropdown; STARTER
   seeding reworked). The live `css-mode-select` (CSS pre-processor: plain/scss/less/acss)
   is a DIFFERENT, working feature that feeds `previewCss` via `computeCss` — **DO NOT
   REMOVE IT.** The CSS work is purely the collapse-to-strip layout change (callout 7).

## Phase 1 — Core chrome (§01 + §02)

Pattern: parallel build of isolated, single-file-owning components (Workflow) →
controller integrates the shared `AppRoot.tsx` → adversarial verify (Workflow).

### Unit A — AppHeader rebuild (`components/header/AppHeader.tsx` + `.test.tsx`, may add `AppMenu.tsx`)
- **Logo button (▾)** → app menu (design-system `Menu`): New, New from template, Settings,
  Keyboard shortcuts, DSL cheat sheet, Help, Pricing (when `paymentEnabled`), Save (⌘S).
- **Filename**: inline-editable text (click/focus to rename, calls `onTitleChange`) +
  **chevron (▾)** → document menu: Rename (focus the name field), Duplicate (`onFork`).
  Export / Move-to-trash are document-domain but need plumbing not present in Phase 1 —
  OMIT with a `// Phase 3` comment rather than invent backend behavior.
- **Save** → no button. Render a `savestate` indicator left of the action group:
  `Saved` (clean, emerald check), `Saving…` (new `saving` prop true), `Unsaved` (amber,
  `unsavedCount > 0`). Signed-out: show a neutral "Local only" / no false "Saved".
- **Top-right**: `actions` (Share) · **Present** button (labelled, icon = play; calls new
  `onPresent` prop = `toggleFullscreen`) · vertical divider · account
  (`ProfileMenu` when `user`, else `Sign in` subtle button → `setLoginOpen`).
- **New props**: `saving?: boolean`, `onPresent(): void`. Keep all existing props/callbacks
  (they feed the menus). Rewrite `AppHeader.test.tsx` to match (old `header-new`/
  `header-fork`/`header-save` button testids move into menu items / are removed).
- Tokens/classes per `redesign.css` `.topbar/.brand/.filemenu/.savestate/.btn.md/.avatar`.

### Unit B — Sidebar → icon rail (`components/Sidebar.tsx`)
- Vertical icon+label rail, width ~64px. Entries: **Editor**, **Library** (both via
  `activePanel` store), **Templates** (new — `onOpenTemplates` prop, Phase 1 wires to a
  placeholder/createNew), spacer, **Help** at bottom (`onOpenHelp` prop).
- Active state: `text-ondark-strong bg-accent-soft` + left accent rail marker
  (`redesign.css` `.railbtn.active`). Inactive: `text-ondark-faint hover:...`.
- Inline SVG icons matching the design (pencil/grid/template/help-circle).
- New optional props `onOpenTemplates?()`, `onOpenHelp?()`; keep reading `activePanel`/
  `setActivePanel` from `useUiStore`.

### Unit C — Toolbox grouped iconned (`components/Toolbox.tsx` + `editor/snippets.ts`)
- Add `icon` (inline SVG / component) + `group` (`'message' | 'structure'`) to `Snippet`.
- Render two `.igroup` clusters of `.ibtn` (icon over small label) per `redesign.css`.
- Keep `onInsert(code)` signature and `data-testid="snippet-${id}"`.

### Unit D — Smart console (`preview/Console.tsx` + new `preview/consoleFilter.ts` + test)
- `consoleFilter.ts`: `filterStarterNoise(entries) → entries` dropping any entry whose
  rendered message contains `_STARTER_`; `countErrors(entries) → number`.
- `Console.tsx`: when 0 errors show emerald `No issues` pill; when >0 show red count.
  Keep props `{ open, entries, onClear, onEval, onToggle }`.

### Unit E — RendererHeader (new `components/preview/RendererHeader.tsx` + test)
- Header bar above the diagram (white `.pv-head`): a `pageTabs` slot (ReactNode) on the
  left + a controls cluster on the right (zoom % display, Fit, **Present** → `onPresent`).
- Props: `{ pageTabs: ReactNode, onPresent(): void, onFit?(): void, zoomLabel?: string }`.
  Keep it presentational; integration passes `<PageTabs .../>` into the slot.

### Unit F — CssPanel collapsible (new `components/editor/CssPanel.tsx` + test)
- Collapsible CSS section. Collapsed (default when `css` empty): thin `Custom CSS ▸` strip
  (`redesign.css` `.cssbar`). Expanded: header (CSS label + `headerControls` slot for the
  EXISTING mode `Select` + acss button) + `children` (the CodeEditor).
- Props: `{ collapsed?, onToggle?, isEmpty: boolean, headerControls: ReactNode, children }`
  — manages its own collapse state (default = `isEmpty`). Integration moves AppRoot's inline
  CSS block (1006–1024 controls + CodeEditor) into the slots; the mode Select is untouched.

### Integration (controller, `app/AppRoot.tsx` + `domain/types.ts` + a couple tests)
- `domain/types.ts:106`: `autoSave: true`. Update `state/settingsStore.test.ts` expectation.
- AppHeader: pass `saving`, `onPresent={toggleFullscreen}`.
- Move `<PageTabs>` from the editor slot into `<RendererHeader pageTabs={<PageTabs/>}>` at
  the top of the **preview** slot. Editor slot keeps only Toolbox + DSL editor + CssPanel.
- Wrap CSS block in `<CssPanel>`.
- Wire `<Sidebar onOpenTemplates={...} onOpenHelp={() => openModal('help')} />`.
- Apply `filterStarterNoise` to console entries before passing to `<Console>`.
- Replace the old fullscreen `Button` (preview slot) — Present now lives in the header;
  keep only an Exit affordance while `fullscreen` is true.

### Phase 1 done-criteria
- `yarn build` (tsc + vite) clean; `yarn test` green (updated tests included).
- `css-mode-select` still present + functional when CSS expanded.
- Anonymous + read-only save paths verified safe.
- **≥1 Playwright screenshot** of the redesigned editor (per project convention).

## Phases 2–4 roadmap (one line each)
- **Phase 2 — §03 hidden failures**: see detailed section below.
- **Phase 3 — §04 library & creation**: library empty-state CTA; visual template
  thumbnails (Start vs Styles, 3-col) — also lands the Templates rail panel; two-column
  Settings modal with `Plus` gating badge on disabled toggles.
- **Phase 4 — §05 polish**: embed centered + frame capped to content; sign-in last-used
  badge + float returning provider to top; pricing struck monthly price + ladder framing.

## Phase 2 — What the happy path hides (§03)

Status note: **console error states are ALREADY done** (Phase 1 smart console — emerald
"No issues" / red count, `_STARTER_` suppression). Phase 2 is the responsive + present work.

Architectural decision (frozen-core boundary): Present-mode fit is achieved by **CSS
`transform: scale()` on the iframe wrapper in AppRoot**, driven by the iframe's reported
natural content size. We do NOT modify `@zenuml/core` (frozen) or its in-diagram toolbar.

### Unit MQ — useMediaQuery hook (`hooks/useMediaQuery.ts` + test)
SSR/jsdom-safe `useMediaQuery(query: string): boolean` built on `window.matchMedia` with an
`addEventListener('change')` subscription and a guarded initial read (matchMedia may be
absent in jsdom → default false). Export a `useIsMobile()` = `useMediaQuery('(max-width: 767px)')`
convenience (the Tailwind `md` breakpoint boundary).

### Unit RL — responsive Layout (`components/Layout.tsx` + test)
- Desktop (≥ md): unchanged split.js two-pane (editor | preview).
- Mobile (< md): NO split. Render a single pane with a **segmented Edit | Preview** control
  (design §03 mobile mock) at the top; show the editor child OR the preview child by the
  selected segment. Manage the segment in local state (default 'edit'). Tear down/skip
  split.js on mobile (only instantiate when desktop). Use `useIsMobile()`.
- Segmented control: accent-soft active pill per the mock (`bg-accent-soft text-ondark-strong`
  vs `text-ondark-faint`). testids `layout-tab-edit` / `layout-tab-preview`.

### Unit PF — Present-mode fit + center (`preview/PreviewFrame.tsx` + test)
- **Ungate `contentSize`**: report + store the iframe's natural content size in ALL modes
  (drop the `if (embedMode)` guard around `setEmbedContentSize`; rename to a mode-neutral
  `contentSize`). Embed behavior must stay byte-identical (still applies explicit px in embed).
- Add a `fit?: boolean` prop. When `fit` (present/fullscreen) AND a contentSize is known,
  the controller wrapper scales the iframe to fit its container: `scale = min(cw/w, ch/h, 1)`
  via `transform`, centered. PreviewFrame exposes the natural size (e.g. an `onContentSize`
  callback or a forwarded ref getter) so AppRoot can compute the scale against the fullscreen
  container; OR PreviewFrame self-fits when `fit` using a ResizeObserver on its wrapper.
  Prefer self-contained: PreviewFrame computes its own fit when `fit` is set (ResizeObserver
  on the wrapper + the reported contentSize), so AppRoot just passes `fit={fullscreen}`.
- Editor (non-fit, non-embed) mode stays `h-full w-full` (unchanged) — the existing centering
  wrapper in AppRoot handles horizontal centering.

### Unit RHm — responsive header (`components/header/AppHeader.tsx` + test)
At < md, condense so nothing clips (design mobile mock = logo + name + savestate + account;
Share/Present become icon-only or move): hide the Share/Present text labels (icon-only) and
the document-menu chevron's affordances may collapse, keeping logo, filename, savestate,
account. Keep all testids. Use Tailwind responsive classes (`hidden md:inline` etc.) — no JS
needed for the header (CSS-only responsive), to avoid coupling to useMediaQuery.

### Integration (controller, AppRoot.tsx)
- Pass `fit={fullscreen}` to PreviewFrame. On mobile, hide the icon rail (Sidebar) — the
  design mobile mock has no rail; render it `hidden md:flex` (Sidebar wrapper) or gate via
  `useIsMobile()`. Ensure the renderer header's page tabs still show on mobile preview pane.
- Confirm fullscreen present mode: console hidden (done Phase 1), diagram fits+centers, only
  Exit affordance. Mobile: segmented Edit/Preview, full-width, header condensed, no rail.

### Phase 2 done-criteria
`yarn build` + `vitest` green; desktop layout unchanged (split.js still works); a phone-width
Playwright screenshot showing tabbed Edit + Preview; a fullscreen screenshot showing the
fit-centered diagram with no console/rail.

## Phase 3 — Library & creation (§04)

Status note: the library empty-state CTA partly exists (`library-empty` + `lib-empty-new`);
`CreateNewModal` + `SettingsModal` exist. Phase 3 upgrades them to the design.

### Unit LIB — Library empty-state (`components/library/LibraryPanel.tsx` + test)
Bring the empty state to the design mock: a framed folder-glyph icon above the serif
"No diagrams yet" heading + "Start from scratch, or pick a styled template." subtext, then
TWO actions — primary **New diagram** (existing `onNewDiagram`, keep testid `lib-empty-new`)
and secondary **Browse templates** (new optional `onBrowseTemplates?()` prop; testid
`lib-empty-templates`). Keep the "No matches" search-empty variant (single message, no CTA).
The diagram count already shows once on the header — leave it.

### Unit TPL — Visual template picker (`components/modals/CreateNewModal.tsx` + test; may extend `domain/templates.ts` additively)
Replace the raw-DSL card body (`{t.item.js}` mono text) with a **schematic CSS thumbnail** — a
mini sequence diagram (2 participant boxes + 1–2 message lines) drawn with divs, tinted per the
template's theme so the card shows the LOOK not the source (design §04): Blank = dashed "+"
card; Basic/plain = ink-on-white; Black & White = black borders; Blue = #2F6BFF tint; starUML =
amber tint. Group into **Start** (Blank, Basic) and **Styles** (black-white, blue, starUMLTheme)
with `eyelabel`-style section headers, on a **3-column** grid (`grid-cols-3`). Keep testids
`create-blank` / `create-template-${id}` and the `onSelect` contract. Add an optional
`group: 'start' | 'styles'` + (optional) thumbnail hint to the Template type additively if it
helps categorize — do NOT change existing template content/ids. The thumbnail is a pure CSS
mock (no @zenuml render — out of scope/expensive), same approach the design prototype uses.

### Unit SET — Two-column Settings (`components/modals/SettingsModal.tsx` + test)
Lay the settings out in **two columns** (design §04): an **Editor** column (theme, keymap, font
size, font, indent, line wrap, auto-close, autocomplete) and a **Behavior** column (preserve
last code, auto-preview, auto-save, preserve console logs, refresh on resize, Light version).
Use a responsive `grid` (1-col stacked < sm, 2-col ≥ sm) so it halves the height. Add a small
**"Plus"** badge next to the **Light version** row label (design: it reads as gated, not broken),
using accent tokens (`text-accent-press`/`accent-soft` on paper). Keep the toggle FUNCTIONAL
(badge is informational) unless subscription state is already available to the modal — do NOT
introduce a new functional gate/regression in Phase 3. Keep the Extension section (ext-only) and
ALL existing testids (`setting-*`).

### Integration (controller, AppRoot.tsx)
Wire the library's `onBrowseTemplates` → `openModal('createNew')` (same surface the rail's
Templates entry opens — the visual CreateNewModal IS the "templates panel" per §04).

### Phase 3 done-criteria
`vitest` + build green; screenshots of (a) the library empty state with both CTAs, (b) the
visual template picker (Start/Styles thumbnails), (c) the two-column Settings with the Plus badge.
