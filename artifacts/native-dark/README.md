# Native dark rendering verification — 21 October 2026

Baseline: master `359951636f9f4fb952f0d1a6ca7fe7196656c121` (PR #840). New branch: `codex/native-dark-rendering`.

## Version and API evidence

- npm registry `https://registry.npmjs.org/@zenuml%2fcore` reported `latest: 4.8.1`, published `2026-10-20T21:32:06.025Z` (21 October 08:32 Melbourne).
- Before: root/web manifests requested `^4.7.2`; both pnpm lockfiles resolved 4.7.2. The isolated browser reported `window.zenuml.default.version === '4.7.2'`.
- After: both manifests and lockfiles pin official 4.8.1. Installed web package and actual iframe runtime report 4.8.1. No core source modifications or local patched dependency.
- [4.8.0 release](https://github.com/mermaid-js/zenuml-core/releases/tag/v4.8.0): new unified `theme-dark`, DOM/SVG parity, dark PNG canvas fill. `theme-darcula` and `theme-clean-dark` are aliases.
- [4.8.1 release](https://github.com/mermaid-js/zenuml-core/releases/tag/v4.8.1): architecture icons inherit participant text color, fixing dark visibility.
- Published 4.8.1 types include `theme-dark` in `SvgTheme`. HTML uses `app.render(code, {theme: 'theme-dark'})`; mobile SVG uses `renderToSvg(code, {theme: 'theme-dark'})`.

## Visual checks

Real Chromium browser against this worktree at `http://127.0.0.1:4458`. Local, signed-out fixture documents only. The original Advanced document on port 4441 was not opened or modified.

| Check | Evidence | Result |
| --- | --- | --- |
| Old renderer | [Before](before-4.7.2.png) | 4.7.2 Darcula; dark lifelines/icons have poor visibility |
| Desktop native dark | [After](after-dark-4.8.1.png) | Text, architecture icons, arrows, lifelines and nested activation bars visible |
| Desktop light | [Light](after-light-4.8.1.png) | Same DSL and layout; light colors retained |
| Mobile native SVG dark | [Dark](mobile-dark.png) | Native SVG icons, arrows and bars visible; surrounding iframe dark |
| Mobile light toggle | [Light](mobile-light.png) | Same mounted preview switches to light |
| Dark PNG | [Downloaded PNG](export-dark.png) | Opened and visually inspected; dark canvas through edge |
| Dark SVG | [Downloaded SVG](export-dark.svg), [browser view](export-dark-svg-view.png) | Opened in a real browser; dark readable diagram |
| Advanced Blue CustomCSS | [Preview](blue-template-dark-chrome.png), [downloaded PNG](export-blue-custom-css.png) | Explicit light base and blue custom palette retained in dark app chrome |

Observed dark HTML values: canvas `rgb(31,31,31)`, participant/message text `rgb(251,251,251)`, activation fill `rgb(129,129,129)`, activation border `rgb(225,225,225)`. Blue template retained 2686 characters of compiled CSS and participant text `rgb(3,44,114)`.

The host colors only the iframe page outside the diagram; native core themes control diagram elements. No inversion filter or diagram-color patch. SVG export continues to require empty custom CSS; PNG preserves custom CSS.

## Automated validation

- Full web Vitest suite: 131 files passed, 1663 tests passed, 1 skipped (before final mobile gutter refinement).
- Focused tests after mobile gutter refinement: passed; dark SVG page background and light reset covered.
- TypeScript check and production Vite build: passed.
- Template CSS browser suite: 5/5 Chromium checks passed (Blue, Black & White, Classic UML).
- ESLint could not run: installed ESLint 10 requires `eslint.config.*`, which this project does not provide. This is an existing configuration gap.

Local telemetry proxy requests fail without the optional backend emulator; rendering and export checks do not depend on that endpoint. No production release or deployment was performed.
- Final preview/export Chromium suite: 10 passed, 1 pre-existing skip. Localhost PW_BASE_URL now runs local-only assertions; deployed targets retain skips.
- Permanent native-dark browser regression: 1/1 passed; checks actual runtime version, native theme class and native canvas/text/lifeline/arrow colors.
- Final production rebuild after mobile page-background fix: passed.
