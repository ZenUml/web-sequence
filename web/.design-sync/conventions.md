# Drafting Table — how to build with this design system

The ZenUML Web Sequence UI kit. Compose from the real components on
`window.DraftingTable.*` (Button, IconButton, Dialog, TextInput, Textarea, Switch,
Select, SearchInput, Popover, Tooltip, Menu, BrandLogo) and style your own layout
glue with the Tailwind utilities below. Two fixed surfaces, one cobalt accent — never
a generic gray/blue palette.

## Setup
- Load `styles.css` — it `@import`s the tokens, the component CSS (`_ds_bundle.css`),
  and the brand fonts (Hanken Grotesk / IBM Plex Mono / Instrument Serif from Google
  Fonts). Without it everything renders unstyled in a fallback font.
- **No global wrapper is needed** for most components — they style themselves. The one
  exception: anything using `Tooltip` must be inside `<TooltipProvider>` (export it from
  `window.DraftingTable.TooltipProvider`, wrap once near the root).

## The two surfaces (the core idea)
Interactive components are **surface-aware** via a `surface` prop, not a runtime theme:
- `surface="dark"` (the **default**) — the **ink** chrome: charcoal-with-blue-undertone
  editor/header/toolbar/menus. Most of the app lives here.
- `surface="light"` — the warm **paper** surface (the diagram canvas / some popovers).
Pick the surface to match the panel you place the component on. `Button`, `IconButton`,
`TextInput`, `Textarea`, `SearchInput` all take `surface`; `SelectContent`/`MenuContent`
are dark ink, `PopoverContent` is light paper by design.

## Styling idiom — semantic Tailwind utilities
Utility classes from a custom palette (NOT Tailwind's default gray/blue). Use real names:

| role | classes |
|---|---|
| Dark surfaces (ink) | `bg-ink-950` (backdrop) · `bg-ink-900` (rail) · `bg-ink-800` (panel) · `bg-ink-700` (raised) · `border-ink-line` |
| Light surfaces (paper) | `bg-paper-50` · `bg-paper-100` · `bg-paper-200` · `border-paper-line` |
| Accent — the one cobalt signal | `bg-accent` · `bg-accent-press` (pressed) · `text-accent` (fills/rings); for accent TEXT on dark use `text-accent-onDark` (AA-safe) |
| Text on dark | `text-ondark-strong` · `text-ondark-muted` · `text-ondark-faint` |
| Text on light | `text-onlight-strong` · `text-onlight-muted` · `text-onlight-faint` |
| Intent | `text-danger` (use `text-danger-strong` for danger TEXT on light) · `text-ok` · `text-signal-amber` (sparingly) |
| Type | `font-sans` (Hanken Grotesk, default) · `font-mono` (IBM Plex Mono, code/DSL) · `font-serif` (Instrument Serif, display titles like the Dialog heading) |
| Shape | `rounded` (7px) · `rounded-lg` (11px) · `shadow-pop` / `shadow-pop-dark` for lifted surfaces |

Rules of thumb: dark panels pair `bg-ink-*` with `text-ondark-*`; light panels pair
`bg-paper-*` with `text-onlight-*`. Reach for `bg-accent` once per view, not everywhere.

## Where the real truth lives
- `styles.css` and its `@import` closure (`_ds_bundle.css`, tokens) — the compiled palette.
- Each component's `components/<group>/<Name>/<Name>.d.ts` (its prop API) and
  `<Name>.prompt.md` (usage). Read those before composing a component you're unsure of.

## One idiomatic snippet
```tsx
// A dark toolbar with the primary action + an icon control, on the ink surface.
<div className="flex items-center gap-2 bg-ink-800 border border-ink-line rounded-lg p-2">
  <Button variant="primary">Run diagram</Button>
  <Button variant="ghost">Export</Button>
  <IconButton aria-label="Add page"><PlusIcon /></IconButton>
</div>
```
`variant` on Button: `primary` (cobalt) · `subtle` · `ghost` · `danger`. Sizes `sm` / `md`.
