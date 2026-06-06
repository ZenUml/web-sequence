# ZenUML web-sequence — Design System ("Drafting Table")

> **Status:** Adopted 2026-06-07 (M02). Established via the `frontend-design` skill.
> **Scope:** the rewrite in `web/` (React 19 + TS + Tailwind 3 + Radix). All UI
> built from M02 onward MUST consume these tokens + primitives. Editor/preview
> *mechanics* (CodeMirror, `@zenuml/core` canvas) are out of scope — this governs
> the app **chrome** (header, modals, menus, tabs, lists, empty states).

## Direction

A **precision-instrument** aesthetic — the app should feel like a well-made
drafting tool for engineers who write diagrams as code. Calm, exact, confident.
Not a generic SaaS dashboard; not "AI slop" (no Inter/Roboto, no purple-on-white
gradients, no evenly-timid palettes).

Three ideas carry it:
1. **Two fixed surfaces.** The editor lives on **ink** (dark charcoal with a blue
   undertone); the preview lives on **paper** (warm vellum, never pure white).
   This is not a runtime light/dark toggle — the two surfaces coexist on screen.
2. **One decisive signal.** A single cobalt **accent** does the pointing
   (primary actions, active states, focus, selection). **Amber** appears only as a
   rare highlight (unsaved dot, active-page marker). Everything else is neutral.
3. **Technical typography.** A characterful grotesque for UI, monospace for
   code-adjacent metadata (tab numbers, zoom %, version, nav labels), and an
   editorial serif for the occasional large moment (modal titles, empty states).

## Tokens (source of truth: `web/tailwind.config.js`)

**Color** (Tailwind semantic names — use these, never `gray-*`):
- `ink-950/900/850/800/750/700` — dark surfaces (backdrop → raised control); `ink-line` hairline.
- `paper-50/100/200` — light surfaces; `paper-line` hairline.
- `accent` / `accent-press` — cobalt signal; `accent-soft` (tint on dark), `accent-tint` (tint on light).
- `signal-amber` / `signal-amberSoft` — sparing highlight.
- `ondark-strong/muted/faint`, `onlight-strong/muted/faint` — text.
- `ok`, `danger` — status.

**Type** (`font-sans` / `font-mono` / `font-serif`):
- `font-sans` → **Hanken Grotesk** — all UI text.
- `font-mono` → **IBM Plex Mono** — metadata, nav labels, counts, code-adjacent chrome. Often `uppercase tracking-[0.12em] text-[11px]`.
- `font-serif` → **Instrument Serif** — modal titles, empty-state headlines (large, tight tracking).
- Fonts loaded via `<link>` in `index.html` (Google Fonts; no bundler dep).

**Shape / depth / motion:**
- Radii: `rounded` = 7px (controls), `rounded-lg` = 11px (cards/modals). Crisp, small — precision over softness.
- Shadows: `shadow-pop` (menus/modals on light), `shadow-pop-dark`, `shadow-inset`.
- Easing: `ease-draft` = `cubic-bezier(.2,.8,.2,1)`. Durations 150ms (hover) / 180–260ms (enter).
- Entrances: `animate-rise-in`, `animate-pop-in`, `animate-overlay-in`. Favor ONE orchestrated reveal over scattered micro-animations.

**Utilities (`web/src/styles/globals.css`):**
- `.surface-ink` / `.surface-paper` — apply a surface's bg+text in one class.
- `.bg-blueprint` — faint cobalt grid texture for dark chrome (header, rail, empty states).
- `.bg-vellum` — paper grain for light empty states.
- `.ring-draft` / `.ring-draft-light` — the standard keyboard focus ring (dark / light surface).
- `.gutter` styling + on-brand scrollbars are global.

## Primitives (`web/src/ui/` — import from `../ui`)

Build new UI from these; do not hand-roll buttons/dialogs.
- `Button` — variants `primary | subtle | ghost | danger`, sizes `sm | md`, `surface="dark|light"`.
- `IconButton` — square icon-only control; requires `aria-label`.
- `Dialog` + `DialogContent` (+ `DialogTrigger`/`DialogClose`) — Radix modal shell on the paper surface, serif title, built-in overlay/animation/a11y description.
- `cn(...)` — class-merge helper (clsx).

When a needed primitive doesn't exist yet (e.g. `Tabs`, `Menu`, `TextInput`,
`Tooltip`), ADD it to `web/src/ui/` (wrapping the matching Radix part where one
exists) rather than styling inline — so the next task reuses it.

## Rules for milestone UI tasks

1. Compose from `web/src/ui/` primitives + Tailwind semantic tokens. No raw hex,
   no `gray-*`/`white/10` literals, no ad-hoc fonts.
2. App header, rail, and empty states sit on **ink** (`.bg-blueprint` for
   atmosphere); modals/menus/popovers sit on **paper** with `shadow-pop`.
3. One primary action per surface (`Button variant="primary"`). Everything else
   `subtle`/`ghost`.
4. Metadata + labels → `font-mono` uppercase tracked. Headlines → `font-serif`.
5. Every interactive element gets the design-system focus ring and an accessible
   name. Keep existing `data-testid`s.
6. Respect `prefers-reduced-motion` for non-essential animation when you add it.

## Process

Per the user's 2026-06-07 direction: **UI-bearing tasks run through the
`frontend-design` skill / this system.** For M02 that means Tasks 11 (header +
login modal + profile menu), 14 (page tabs), 16 (saved-items list). For M03/M04
(library panel, share UI, settings, subscription, modal inventory) the same
applies — extend `web/src/ui/` first, then build the feature on top.
