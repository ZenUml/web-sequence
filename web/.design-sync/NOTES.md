# design-sync notes — Web Sequence (Drafting Table)

Repo-specific gotchas for syncing `web/src/ui` (the "Drafting Table" design system)
to the "Web Sequence Design System" claude.ai/design project.

## Shape & build
- **Package shape, synth-entry.** `web/` is a Vite *app*, not a published library — no
  `main`/`module`/`exports`, no library `dist/` with `.d.ts`. The converter synthesizes the
  entry from `srcDir: src/ui` (the barrel `src/ui/index.ts`). Run `package-build.mjs` WITHOUT
  `--entry`. `--node-modules ./node_modules` (web/'s own; react/radix resolve there).
- React 19 + Radix UI primitives + Tailwind 3. `@types/react` must be installed in `.ds-sync`.

## CSS (Tailwind) — must be recompiled on re-sync
- Component classes are Tailwind utilities; `tailwind.config.js` is the source of truth. The
  converter scrapes a *static* stylesheet, so we precompile one into `cssEntry`:
  ```sh
  cd web
  npx tailwindcss -i src/styles/globals.css -o .design-sync/.cache/ds-tailwind.css
  # then prepend the Google-Fonts @import (brand fonts load at runtime, like index.html):
  ```
  The `.design-sync/build-css.sh` helper does both. Re-run it before every build so new
  utility classes used by authored previews are included (extend its content glob to
  `.design-sync/previews` once previews exist).
- **Fonts: Google Fonts at runtime** (Hanken Grotesk / IBM Plex Mono / Instrument Serif), via
  a `<link>` in `index.html`. Not shipped as woff2. We inject the same `@import url(fonts.googleapis…)`
  at the top of the compiled CSS → `[FONT_REMOTE]` (loads at runtime, no woff2 to ship).
  `runtimeFontPrefixes` is set as a backstop so `[FONT_MISSING]` stays quiet.

## Preview authoring — calibration learnings (solo: Button/IconButton/Dialog)
- **Dark-surface DS → wrap preview content in a dark ink panel** (`background:#10141B`, padding,
  radius). The grading capture sheet uses a WHITE bg, so `surface="dark"` controls (muted
  neutrals: ondark-muted icons, ghost buttons) render as faint gray and grade poorly unless
  they sit on the ink panel they're designed for. `surface="light"` variants get a warm paper
  panel (`#FAF7F1`). Every dark-surface preview should follow this.
- Previews import from `'web-sequence-web'` (the converter aliases it to `window.DraftingTable`).
  esbuild auto-JSX runtime — no `import React` needed; `React.FC`/`React.CSSProperties` type
  annotations are fine (erased), the IDE's "Cannot find React" warnings are noise.
- Overlay components (Dialog, and likely Popover/Tooltip/Menu/Select open states) need
  `cfg.overrides.<Name>: {"cardMode":"single","viewport":"WxH"}` and render open via Radix
  `defaultOpen`/`open` so the floated content shows inside the card.
- Use realistic copy from the app (Save changes / Delete diagram / Run diagram), never foo/bar.

## Per-component authoring notes (folded from the wave fan-out)
- **TextInput / Textarea**: thin native wrappers; `surface` prop (default dark) + native attrs.
  Uncontrolled `defaultValue` works in previews (onChange is the raw DOM event).
- **SearchInput**: NOT a thin wrapper — `onChange(value: string)` is REQUIRED and value-style
  (string, not event); `value` is controlled. A static `value="…"` + a no-op `onChange` renders
  the populated state (with the clear ×). `style`/rest spread onto the inner `<input>`.
- **Switch**: on/off via `defaultChecked` (checked = cobalt fill); compose as labelled rows
  (mirrors SettingsModal's SwitchRow) on the ink panel.
- **Select / Menu / Popover** (overlays): render OPEN via Radix `defaultOpen` on the Root; the
  orchestrator-set `cfg.overrides.{…}` (cardMode single + viewport) lands the portaled content
  in the card. `SelectContent`/`MenuContent` are dark-ink; `PopoverContent` is light-paper (it
  brings its own surface even off a dark trigger). `MenuItem tone="danger"` = red Delete.
- **Tooltip** (the context-identity trap): the DS `Tooltip` wrapper self-provides a Radix Root
  with NO open-control prop, and the barrel exports only `Tooltip`+`TooltipProvider` (no raw
  Root/Trigger/Content). To show it open, the preview imports raw `@radix-ui/react-tooltip` AND
  supplies its OWN `<RadixTooltip.Provider>` — the bundle's `cfg.provider` TooltipProvider is a
  DIFFERENT module copy with a distinct React context, so a raw Root can't see it (renders blank
  + throws "must be used within TooltipProvider"). **General rule**: any overlay whose package
  wrapper self-provides but exposes no open prop → preview supplies its own matching Radix Provider.

## Known render warns (re-sync should treat these as expected, not new)
- `[RENDER_THIN]` on **BrandLogo** — false positive: the logo is a pure SVG with no text nodes.
  Grade `good` whenever the mark renders.

## Re-sync risks
- `.design-sync/.cache/ds-tailwind.css` is gitignored and regenerated — re-sync MUST run
  `build-css.sh` first or the bundle ships unstyled.
- Compound exports (DialogTrigger, SelectItem, MenuItem…) are PascalCase and may be discovered
  as separate components — they're real API parts, not standalone cards; previews compose them
  inside their parent (Dialog, Select, Menu).
