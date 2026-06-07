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
- **Phase 2 — §03 hidden failures**: responsive tabbed Edit/Preview at phone width;
  Present mode fits+centers and hides console/dev toolbar; console error-state styling.
- **Phase 3 — §04 library & creation**: library empty-state CTA; visual template
  thumbnails (Start vs Styles, 3-col) — also lands the Templates rail panel; two-column
  Settings modal with `Plus` gating badge on disabled toggles.
- **Phase 4 — §05 polish**: embed centered + frame capped to content; sign-in last-used
  badge + float returning provider to top; pricing struck monthly price + ladder framing.
