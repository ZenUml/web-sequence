# UI primitives report

Shared controls now use one semantic palette and one set of control sizes. This is a visual migration of the existing React and Radix primitives. No product feature was added, and no caller outside `web/src/ui` was edited.

Work stayed on the signed-in Cursor account with Grok 4.7. No model, provider, billing, or API-key change was made.

## What changed

Palette hex values live only as `--ui-*` custom properties in `web/src/ui/tokens.css`. Component rules read those variables. Surface colors are set on `.ui-surface-light` / `.ui-surface-dark` and on `[data-ui-surface="light"|"dark"]`. They are not set on `:root`, so the diagram and editor palettes are left alone.

Action colors are the same in both themes: primary `#217BB3`, on-primary white, hover `#1C6D9F`, pressed `#175D89`, brand `#2E94D4`.

Light surface: page `#EFF6FB`, surface `#FFFFFF`, pocket `#F7FAFD`, border `#E3E8ED`, text `#1C2024`, secondary text `#60646C`, secondary button `#FFFFFF` / border `#D5DCE5`, hover `#EAF2F8`, pressed `#DCE8F1`, selected `#E5F1FA`, control fill `#FFFFFF`, focus `#176593`, disabled fill `#E8EDF2` / text `#7A8794` / border `#DCE3EA`.

Dark surface: page `#303944`, surface `#343F4B`, pocket `#424F5E`, border `#516071`, text `#EEF2F6`, secondary text `#B8C3CF`, secondary button `#3B424E` / border `#444B57`, button text `#EDF0F5`, hover `#485465`, pressed `#526175`, selected `#304F69`, control fill `#2D3743`, focus `#9ACDFA`, disabled fill `#39424D` / text `#8794A3` / border `#46515F`.

Standard button: 36px height, 14px / 20px type, 6px radius, 18px icon, 8px gap, 16px horizontal padding. Compact `size="sm"` is 32px with 8px padding. Icon button default is 32×32. Icon button `sm` stays 24px, the existing toolbar hit target. Stroke on the gallery glyphs is 1.5.

Height, width, gap, and radius that callers override are in `:where()`. Paint and type stay on normal classes so they beat the browser reset (transparent button fill, `font-size: 100%`, inherited line-height, `padding: 0`). A caller `h-7` (28px) or `h-12` (48px) therefore wins over the 36px default in both the dev fixture and the production CSS, where `.h-7` and `.h-12` are later than `:where(.ui-button)`.

`data-ui-state="hover|pressed|focus"` paints the same colors as `:hover`, `:active`, and `:focus-visible`. It is a gallery review hook. It is not a new component prop.

## API compatibility

Exports in `web/src/ui/index.ts` are unchanged. `tokens.css` is imported there so a caller that imports a primitive gets the palette. `Dialog.tsx` was not edited.

Preserved:

- `Button` props: `variant` (`primary | subtle | ghost | danger`), `size` (`sm | md`), `surface` (`light | dark`). Defaults remain `subtle`, `md`, `dark`, `type="button"`.
- `buttonClassName()` still returns classes for an anchor. It includes `ui-surface-light` or `ui-surface-dark`. It does not wrap a button.
- `className`, `ref`, DOM and ARIA attributes, and native `type` still pass through.
- Disabled buttons keep `disabled:pointer-events-none`.
- Light danger still adds `text-danger-strong` and `border-danger-strong/40`, and does not add a bare `text-danger`. Dark danger still uses `text-danger` and not `text-danger-strong`. Primary, subtle, and ghost disabled buttons use the gray disabled fill. A disabled danger button keeps those red colors and is drawn at 40% opacity.
- Default surfaces are unchanged: Button, IconButton, TextInput, Textarea, SearchInput, Menu, and Tooltip default to dark. SelectTrigger, Popover, and Switch default to light. Select content defaults to dark.
- Menu, Select item, Popover, and Tooltip still portal. The portaled node sets `data-ui-surface` and `ui-surface-*` itself.

`surface.ts` (`UISurface`, `surfaceClass`) is internal. It is not exported from `index.ts`.

## Files

Edited:

- `web/src/ui/tokens.css` (new)
- `web/src/ui/tokens.test.ts` (new)
- `web/src/ui/surface.ts` (new)
- `web/src/ui/index.ts` (side-effect CSS import and a portal comment; export list unchanged)
- `web/src/ui/Button.tsx`, `Button.test.tsx`
- `web/src/ui/IconButton.tsx`, `IconButton.test.tsx` (new)
- `web/src/ui/TextInput.tsx`, `TextInput.test.tsx` (new)
- `web/src/ui/Textarea.tsx`, `Textarea.test.tsx`
- `web/src/ui/SearchInput.tsx`, `SearchInput.test.tsx`
- `web/src/ui/Select.tsx`, `Select.test.tsx`
- `web/src/ui/Switch.tsx`, `Switch.test.tsx`
- `web/src/ui/Menu.tsx`, `Menu.test.tsx` (new)
- `web/src/ui/Popover.tsx`, `Popover.test.tsx`
- `web/src/ui/Tooltip.tsx`, `Tooltip.test.tsx`
- `web/src/ui/PrimitivesGallery.tsx` (new)
- `web/src/ui/Primitives.stories.tsx` (new, Storybook title `UI/Primitives`)

Harness, outside `src` (no app route, `AppRoot` not edited):

- `web/fixtures/ui-primitives/index.html`
- `web/fixtures/ui-primitives/main.tsx`
- `web/fixtures/ui-primitives/vite.config.ts` (port 4473, cache `web/.cache/ui-primitives-vite`)
- `web/fixtures/ui-primitives/vitest.config.ts` (cache `web/.cache/ui-primitives-vitest`)
- `web/fixtures/ui-primitives/app-build.config.ts` (drops the plugin that writes `web/dist`)
- `web/fixtures/ui-primitives/capture.mjs`
- `web/fixtures/ui-primitives/screenshots/*.png`

Not edited: `Dialog.tsx`, `app/`, `components/`, `hooks/`, `state/`, `services/`, `globals.css`, package files, lockfiles, renderer. `web/.cache/ui-primitives-dist` is build output only.

## Checks that ran

From `web/`, Yarn 1.22.22. `web/node_modules` is a symlink and was not written. `node_modules/.vite` mtime stayed `1792481347` across the build.

| Check | Result |
| --- | --- |
| `yarn vitest run src/ui --config fixtures/ui-primitives/vitest.config.ts` | 12 files, 51 tests passed |
| `yarn typecheck` (`tsc --noEmit`) | passed |
| `yarn vite build --config fixtures/ui-primitives/app-build.config.ts` | passed. CSS `web/.cache/ui-primitives-dist/assets/index-Cwj_FJRV.css` (57.22 kB). 879 modules. Did not write `web/dist`. |

The unit run above is after the token and component edits. A later edit only changed a comment in `Button.tsx` and the gallery caption layout. Those do not change the assertions.

Stylus "module externalized for browser compatibility" lines during the build are the existing renderer imports, not this change.

Browser, fixture `http://127.0.0.1:4473/` (left running). Port 4411 was not used.

Chrome DevTools layout viewport after a 1440×900 resize was 1440×760. Playwright then used a real 1440×900 viewport and a 390×844 viewport against the same fixture, with system Chrome (`channel: 'chrome'`, headless, temporary profile). No browser binary was downloaded.

Computed styles on the fixture:

| Control | Result |
| --- | --- |
| Light primary default | 36px, 14px/20px, radius 6px, fill `rgb(33, 123, 179)`, text white |
| Light primary hover (`data-ui-state` and a real `:hover`) | fill `rgb(28, 109, 159)` |
| Light primary pressed | fill `rgb(23, 93, 137)` |
| Light primary focus | fill stays primary, outline `2px solid rgb(23, 101, 147)` |
| Light primary disabled | fill `rgb(232, 237, 242)`, text `rgb(122, 135, 148)`, border `rgb(220, 227, 234)` |
| Light secondary default | fill white, text `rgb(28, 32, 36)`, border `rgb(213, 220, 229)` |
| Light secondary hover / pressed | `rgb(234, 242, 248)` / `rgb(220, 232, 241)` |
| Dark secondary default | fill `rgb(59, 66, 78)`, text `rgb(237, 240, 245)`, border `rgb(68, 75, 87)` |
| Dark primary disabled | fill `rgb(57, 66, 77)`, text `rgb(135, 148, 163)`, border `rgb(70, 81, 95)` |
| Dark focus | outline `2px solid rgb(154, 205, 250)` |
| Light page / dark page | `rgb(239, 246, 251)` / `rgb(48, 57, 68)` |
| Light text field | 36px, 14px/20px, radius 6px, white, border `rgb(227, 232, 237)` |
| Standard button | 36px |
| Compact `size="sm"` | 32px |
| Card caller `h-7` | 70×28px |
| Provider caller `h-12` | 280×48px |
| Icon button | 32×32, glyph 18px, stroke 1.5 |
| Anchor from `buttonClassName` | same 36px secondary treatment, no nested button |

Keyboard on the fixture: typing `Hello` into `#kb-input` kept that value. Arrow Down opened the select listbox (`ui-select-content ui-surface-light`), Enter selected `One` and closed it. Enter opened the menu (`ui-menu ui-surface-light`). Escape closed it. In the Chrome DevTools session, focus returned to `#kb-menu`. The Menu unit test asserts the same return. One headless capture read an empty `activeElement.id` after Escape; the unit test and the DevTools session are the evidence for focus return.

Screenshots:

- `web/fixtures/ui-primitives/screenshots/1440-light-dark.png` (1440×1434, both themes, fields, overrides)
- `web/fixtures/ui-primitives/screenshots/1440-primary-hover.png` (real hover)
- `web/fixtures/ui-primitives/screenshots/1440-select-open.png`
- `web/fixtures/ui-primitives/screenshots/1440-menu-open.png`
- `web/fixtures/ui-primitives/screenshots/1440-overrides.png`
- `web/fixtures/ui-primitives/screenshots/390-light-dark.png` (390×3790)
- `web/fixtures/ui-primitives/screenshots/390-dark.png`
- `web/fixtures/ui-primitives/screenshots/390-overrides.png` (28px Open, 48×280 provider, 32px icon, 36px Sponsor anchor)

## Checks that did not run

- ESLint. `web/` has no `eslint.config.js`. `yarn eslint src/ui` cannot start. No config was added.
- The full `yarn test` suite outside `src/ui`.
- Playwright end-to-end tests.
- Storybook. `Primitives.stories.tsx` is in place; the Storybook server was not started.
- The Playwright browser extension. It did not connect. Checks used Chrome DevTools and headless system Chrome instead.

## Caller and portal notes (not applied)

These stay with the workers who own the callers.

- A portal does not inherit an ancestor surface. Menu, Select, Popover, and Tooltip set `data-ui-surface` and `ui-surface-*` on the portaled node. Pass the same `surface` to the content that the trigger uses. Select content still defaults to dark when the prop is omitted, even if the trigger is light.
- Anchors that use `buttonClassName({ surface: 'light' })` must keep the returned `ui-surface-light` class. That class is the palette. `SupportPledgeModal` and `HomeView` already use the helper, so they pick up the class without an edit. They do not get a `data-ui-surface` attribute unless they add one.
- Card actions that must stay 28px need `className="h-7"`. Provider buttons that must stay 48px need `h-12` (Login modal buttons are still full width at the 36px default until that caller adds `h-12`).
- `size="sm"` on Button is 32px. Callers that used `sm` and expected the old 28px height need `h-7` instead. Share stop, import/export, and folder "New folder" are in that group if they pass `sm` without a height class.
- Icon button `sm` stays 24px. Page-tab close `h-4 w-4` and the unlayered `editor-page-add` rule in `globals.css` still outrank this file. A dark add button that uses `size="sm"` and no size class stays 24px.
- Do not put these surface variables on `:root`. Diagram style is unchanged.
- Editor menus that use `editor-hifi-select-menu` / `editor-hifi-menu` still take their look from `globals.css`.
- Light and dark danger menu highlight text is `--ui-danger-highlight-text` on the menu surface. See the correction section below.
- `BrandLogo` still uses `#2E94D4` inside its own SVG. That matches the brand token and was not rewritten.
- Padding on a button is a normal class so it beats the button reset. A later unlayered rule can beat a same-specificity `px-*` utility in dev. In the production build, utilities are later in the file, so `px-*` wins. Height overrides do not depend on that order because they use `:where()`.

## Correction — light danger menu text and disabled danger buttons

Reviewed against `acceptance-final/css-evidence.json` (highlight contrast about 1.11, foreground `232,238,247` on the pale danger wash) and `hash-verification.json` (26/26 files matched before this correction). `Button.tsx` is still `f0ff654aad1d5d29af43f497e5b7f0e1ef189b7ba56627bb7518662bd1da1344`. `Dialog.tsx` was not edited.

Failing tests were added first. They load `tokens.css` and then the later Tailwind utilities, and they read computed color, opacity, and contrast. jsdom leaves `background: var(--token)` unresolved, so a `var()` color is resolved from the custom property on that element.

Before the style change:

- Menu, light surface: resting danger text contrast was **3.84** (below 4.5). An earlier run also showed the highlighted label as channel **232**, which is `#E8EEF7`.
- Button, danger, both surfaces: disabled opacity was **1**, so the control looked enabled.

After the style change, the same tests pass.

- A light danger item uses `--ui-danger-strong` (`#B23A33`) at rest. Highlighted text uses `--ui-danger-highlight-text` (`#B23A33` on light, `#E8EEF7` on dark). The danger wash class `data-[highlighted]:bg-danger/20` is unchanged, and it still replaces the default selected highlight instead of stacking on it. Keyboard Arrow Down highlights the item, Enter selects it, and a disabled danger item uses the surface disabled text (`122,135,148` light, `135,148,163` dark).
- A disabled danger button stays the enabled danger color (`178,58,51` light, `224,82,74` dark) at opacity **0.4**. It remains natively disabled, is not focusable, and has `pointer-events: none`, so click and Enter do not fire. Primary and subtle disabled buttons stay opacity 1 with disabled fill `232,237,242`. A disabled danger button with `h-12` computes to `3rem` (48px). A disabled primary button with `h-7` computes to `1.75rem` (28px).

`yarn vitest run src/ui --config fixtures/ui-primitives/vitest.config.ts`: 12 files, **53** tests passed. `yarn typecheck` passed. No full app suite, no build, no caller edit, ports 4411 and 4442 left running.

Changed for this correction:

| File | sha256 |
| --- | --- |
| `web/src/ui/tokens.css` | `bb3d0e79227f1690d0e92b3c24322539fdad3117f030021d6a2dccc0d29599ca` |
| `web/src/ui/tokens.test.ts` | `e039789e22dabe17ec29d60f4dba69eec53430b6599976ca3840eac5fd382bb2` |
| `web/src/ui/Menu.tsx` | `2bdb627996c84d56f713e6e8d2752dbacfb92ea0a434210dd4a4a38161698dfc` |
| `web/src/ui/Menu.test.tsx` | `71812e3d515752fc75fa967d7c98b83e3cb84d7fe7b86f7931282b6701122e44` |
| `web/src/ui/Button.test.tsx` | `689caae1019197ff179ea56043abf06f4a32d69233bcfe2d5a506b070be1deae` |
| `web/src/ui/computedCascade.ts` (new, tests only) | `df37bc17753e2cb4932c3ce0e2deda4cddb3b0c532db26a3b2e4cdd48d875f3c` |
