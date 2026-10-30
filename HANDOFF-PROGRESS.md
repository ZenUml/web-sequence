# Core Editor implementation — progress

Scope: core ZenUML Editor only (Figma frames 32:4370 Editor Light, 32:4188 Editor Soft Dark Darcula).
Excluded: Settings / Code appearance, library, login, share dialog, renderer package, backend.

## Baseline assessment (12cf0e4d + inherited uncommitted work)

Inherited uncommitted work (preserve, do not overwrite):
- Modified: `web/src/app/AppRoot.tsx` (ExportDialog wiring), `web/src/components/preview/RendererHeader.tsx` (download button),
  `web/src/preview/PreviewFrame.tsx` (+test; `theme` prop, export snapshot), `web/src/preview/previewBootstrap.runtime.js` (+test),
  `web/src/preview/previewProtocol.ts`, `web/src/services/download.ts`.
- Untracked: `web/dark-theme-preview.html`, `web/src/preview/darkThemePreview.ts`, `web/src/components/preview/ExportDialog.tsx` (+test),
  `web/src/services/diagramOutput.ts`, `web/src/services/renderExport.ts`.
- `PreviewFrame` accepts `theme`, but `AppRoot` does not pass it yet.

Baseline UI at 1440x960 (`web/.shots/baseline-1440.png`):
- Teal palette (`--editor-*` in `globals.css`), header 64px tall.
- Title, save state, Share and Present are portaled into the preview card (64px slot), not in the header.
- Preview card x389 y76 1027x864 (target x392 y68 1036x880). Editor region x0..379 (target code area x24..368).
- Header shows "Your diagrams" back link, Pricing link, Sign in. No sidebar toggle, no Fork button, no appearance toggle.
- Title has document-menu chevron (Rename / Duplicate).
- DSL heading above the code. Report a bug is a FAB moved by CSS to the top of the code column.
- Custom CSS strip shows "empty · click to expand" filler.
- Renderer header: download, fixed "100%" text (not a real zoom), duplicate Present icon. No zoom/fit.
- Console shows green "No issues" badge.
- No app-level light/dark appearance. CodeMirror `ink` theme hardcodes teal background `#EDF4EF`.
- @zenuml/core 4.7.2 public API: `render`, `getPng`, `getSvg` only. `zoomIn/zoomOut` exist on an internal React ref, not public.

Baseline at 390x844 (`web/.shots/baseline-390.png`): two-row header, Edit/Preview tabs, no overflow.

## Checklist

- [x] Appearance: `Settings.appearance` ('light' default) through the existing settings persistence path; `data-appearance` on `<html>`; applied before first paint; header toggle.
- [x] Semantic tokens: replace teal `--editor-*` with blue light/dark palette; portal menus get dark variants.
- [x] `ink` code theme reads shell tokens (continuous surface in both appearances). Other code themes unchanged.
- [x] Dark preview: pass `theme-darcula` to `PreviewFrame` in dark appearance; iframe background matches card.
- [x] Header 56px: logo/app menu + sidebar toggle, `Diagrams / title`, save state; Fork, Share, Present (filled); appearance; account.
- [x] Remove title menu chevron; keep rename via title; Fork replaces Duplicate.
- [x] Sidebar toggle collapses/expands code pane (desktop), keeps split sizes.
- [x] Remove document-chrome slot from preview card.
- [x] Left column: remove DSL heading; bottom row Custom CSS + Report a bug; CSS strip label + chevron only.
- [x] Console: remove "No issues" badge; keep count, expand, Clear, errors.
- [x] Page tab: label and underline share center.
- [x] Preview tools: fit width, fit height, fit diagram, zoom out, real zoom %, zoom in (app-side); keep Download, Refresh; remove duplicate Present.
- [x] Geometry at 1440x960 matches targets; narrow viewport works.
- [x] Tests, typecheck, build, Playwright; screenshots light/dark desktop/mobile.
- [x] IMPLEMENTATION-REPORT.md.

## Status (2026-10-20)
All checklist items done. Follow-up pass: root `e2e/tests` specs updated (87 passed, 0 failed), dark-boot flash fixed, tab underline anchored to the label, dark Present screenshot added. See IMPLEMENTATION-REPORT.md for validation, screenshots and limitations.
