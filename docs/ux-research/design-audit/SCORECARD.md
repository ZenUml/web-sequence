# ZenUML `web/` rewrite — Design scorecard (baoyu-design craft standards)

**Date:** 2026-06-07 · **Mean score: 4.21 / 5** across 22 surfaces · **Method:** 22 surfaces each scored on 7 dimensions, then each score adversarially re-verified by a second agent (uncited findings rejected; "house-style" excuses challenged). See [`FEATURE-MAP.md`](./FEATURE-MAP.md) for navigation and [`screenshots/`](./screenshots) for evidence.

> **Basis & caveat.** baoyu-design is a design-*creation* skill with **no built-in scoring rubric**. The 7 dimensions below are derived from its craft standards in `system-prompt.md` (fetched verbatim). Scope is the **web app's own chrome** — the sequence-diagram SVG rendered by the separate, frozen `@zenuml/core` package (shield icon, "1.2.3" checkbox, zoom/"ZenUML.com" footer) is out of scope.

**Dimensions:** D1 Hierarchy/composition · D2 Typography/scale · D3 Color/contrast · D4 Spacing/layout mechanics · D5 Restraint/anti-slop · D6 Interaction states · D7 Design-system consistency.

## Scoreboard

| Score | Surface | Type | High | Med | Low |
|------:|---------|------|:---:|:---:|:---:|
| 5.0 | ConfirmDialog (saved-locally / import-failed) | code | – | – | 1 |
| 4.7 | Header overflow menu | shot | – | – | 2 |
| 4.7 | Share-error notice | shot | – | – | 2 |
| 4.6 | Limit-reached notice | code | – | – | 2 |
| 4.5 | DSL Cheat-Sheet modal | shot | – | – | 1 |
| 4.5 | Share popover | code | – | 1 | 1 |
| 4.5 | Ask-to-import modal | code | – | – | 2 |
| 4.4 | Support-pledge modal | shot | – | – | 2 |
| 4.4 | Profile menu (signed-in) | code | – | – | 2 |
| 4.3 | First-run Onboarding | shot | – | – | 2 |
| 4.3 | Create-New (templates) | shot | – | – | 3 |
| 4.3 | Sign-in modal | shot | – | 1 | 2 |
| 4.2 | Settings modal | shot | – | 2 | 1 |
| 4.0 | Keyboard Shortcuts | shot | – | 1 | 1 |
| 4.0 | Help / About | shot | – | 2 | 1 |
| 4.0 | Pricing / subscription | shot | – | 1 | 3 |
| 4.0 | Console drawer | shot | – | 1 | 2 |
| 4.0 | Atomic-CSS settings | code | – | 1 | 1 |
| 3.9 | Library panel | shot | – | 1 | 3 |
| 3.5 | **Main editor (default)** | shot | – | 1 | 3 |
| 2.5 | **Fullscreen preview** | shot | **2** | 1 | 1 |

**Headline:** a deliberate, principled design system ("Drafting Table") that scores high on structure and restraint, with **two real weak points** — (1) a systemic **WCAG-AA contrast** gap where components use fill-tuned tokens for *text* despite AA-safe tokens existing, and (2) the **preview/fullscreen composition** that strands a small natural-size diagram in a large empty surface.

---

## Systemic themes (ranked by impact)

### 1. AA contrast: text uses fill-tuned tokens — affects ~9 surfaces (HIGHEST LEVERAGE)
The system *documents* AA-safe text tokens (`accent.onDark`, `danger.strong`, `accent.press`) but components repeatedly use the fill/dark-tuned default for **text on the light paper surface or faint text on ink**. Ratios below are **script-verified** (WCAG formula, see note); AA needs **4.5:1** for body text — every fix target clears it:

| Surface | Offender | Measured | Fix (clears AA) |
|---|---|---|---|
| Help | links `text-accent` #2F6BFF on paper | **4.21:1** | → `text-accent-press` (6.15:1) |
| Pricing | `text-signal-amber` savings copy on paper | **2.18:1** | new `amber.strong` text token |
| Pricing | ProBadge amber 10px on amber/15 tint | **1.95:1** | darker amber on stronger tint |
| Sign-in | error `text-danger` on `bg-danger/10` paper | **3.19:1** | → `text-danger-strong` (5.54:1) |
| Atomic-CSS | validation `text-danger` on paper | **3.59:1** | → `text-danger-strong` (5.54:1) |
| Console | placeholder `text-ondark-faint` on ink | **2.94:1** | → `text-ondark-muted` (5.56:1) |
| Main editor | "JS" label `text-ondark-faint` on ink | **2.94:1** | → `text-ondark-muted` (sibling "CSS" already does) |
| Profile menu | (same family — faint text on ink) | <4.5:1 | promote to muted |

> Ratios computed with the standard WCAG relative-luminance formula over the exact token hexes (tint backgrounds alpha-blended onto paper-50). The documented `accent.onDark` #7AA2FF on ink-900 verifies at **7.42:1** (config claims ~7.4) — the system's *self-documented* tokens are correct; the gap is components not *using* them for text.

**One coordinated pass swapping `text-*` to the documented `*-strong`/`*-press`/`-onDark` tokens, plus adding an `amber.strong` text token, closes most of these.**

### 2. Hit targets below a comfortable baseline — ~4 surfaces
`Switch` 20×36px, `Button size="sm"` h-7 (28px), Toolbox controls ~24px tall, Share-popover Copy/Stop (sm). baoyu's baseline is 44px (mobile) / "comfortably clickable" (desktop). Promote primary actions (Copy, the Settings switches) and widen the toolbox row's tappable area.

### 3. At-rest affordance gaps — main editor, Help
The 9 **Toolbox insert controls render as bare muted text** with no resting chip/border — visually identical to the non-interactive "DSL"/"CSS" labels; the button look only appears on hover (`Toolbox.tsx:12`). Help links have hover but **no `focus-visible`** state (keyboard/AT users get no focus ring on the modal's only interactive content).

### 4. Preview/fullscreen composition — main editor (Med) → fullscreen (the 2.5 outlier)
Both panes center a *fixed-size* iframe rather than scaling the diagram, so a small diagram is stranded in a large void. **Fullscreen is the worst surface in the app** (details below).

### 5. baoyu named anti-pattern: rounded + left-border accent — Library (real), Sidebar (borderline)
`FolderList.tsx:103/110-111` pairs `rounded` **with** `border-l-2 border-accent` on the active folder entry — a direct hit of baoyu's explicitly named AI-slop anti-pattern. The verifier judged the **Sidebar/PageTabs** active markers *borderline-acceptable* (small designed nav toggles, not callout cards). **Fix the FolderList one:** keep the `bg-accent-soft` tint with rounded and drop the left border, OR use the left-accent rail on a square full-bleed entry — not both.

---

## The outlier: Fullscreen preview (2.5/5)

Two **high-severity** issues — its core purpose is unmet:

1. **No zoom-to-fit.** Footer reads "100%"; the diagram renders at the same ~380px natural height it has in the split-pane, on an ~1800px viewport. The shrink-wrap/sizing path in `PreviewFrame.tsx:147-150` is gated behind embed mode, so fullscreen never scales.
2. **Stranded top-left.** `PreviewFrame.tsx:158` renders the iframe `h-full w-full` (non-embed path), so it fills its parent — the card visually sits top-left in ~90% empty vellum.

**Both symptoms share one root cause, and the fix is *not* "add a centering wrapper."** A centering wrapper **already exists**: `AppRoot.tsx:1063` (`fixed inset-0 … flex flex-col`) → `:1076` (`flex-1 min-h-0 flex items-center justify-center p-4`) wraps `PreviewFrame` in both the split-pane and fullscreen branches. It can't center anything because the iframe is `h-full w-full` and consumes the whole flex box. **Real fix:** make the iframe size to its content (reuse the embed `contentSize` shrink-wrap path currently gated behind embed mode) and/or zoom-to-fit — *then the existing wrapper centers it automatically.* This is the **same root cause** as the split-pane "stranded diagram" Med (Theme 4) — one fix resolves both.

Plus (Med) no layout system — card, "Exit" chip, and the dark "CONSOLE (4)/CLEAR" debug bar pin to opposite edges around a void; and (Low) the **debug console stays docked in this presentation view** with failing-contrast faint text — hide or collapse it in fullscreen.

---

## What's genuinely strong (don't regress these)

- **Design-system adherence (D7)** is high almost everywhere — ink/paper surfaces, accent-soft active tints, shared `ui/` primitives, consistent radius/shadow/motion vocabulary.
- **Layout mechanics (D4)** are clean: flex/grid + `gap` used throughout (`Toolbox`, `Sidebar`, `PageTabs`, `AppRoot`, modals) — none of baoyu's fragile inline-flow.
- **Restraint:** no banned fonts (Hanken Grotesk / IBM Plex Mono / Instrument Serif), no decorative gradients, no emoji-as-decoration, no SVG-drawn imagery, no data-slop.
- **Empty states are a highlight:** Library "No diagrams / START YOUR FIRST DIAGRAM" (serif display), the embed "Diagram unavailable" card, and the share-error notice are all intentionally composed — exactly baoyu's "solve emptiness with composition, not filler."
- The small notices/dialogs (ConfirmDialog 5.0, Limit-reached 4.6, Share-error 4.7) are the cleanest surfaces.

---

## Prioritized fix list

1. **[High value, low effort] AA contrast token pass** — swap text usages to `accent-press` / `danger-strong` / `ondark-muted`, add an `amber.strong` text token. Closes ~9 surfaces' D3 misses. *(Theme 1)*
2. **[High] Fix preview sizing (Fullscreen + split-pane, one root cause)** — content-size the iframe (reuse the embed `contentSize` shrink-wrap path) and/or zoom-to-fit so the existing centering wrapper works; hide the debug console in fullscreen. Moves the app's worst surface (2.5) up materially and resolves Theme 4. *(Fullscreen + Theme 4)*
3. **[Med] Toolbox resting affordance** — give the 9 insert controls a persistent subtle chip so they read as buttons. *(Theme 3)*
4. **[Med] Hit targets** — Switch, sm buttons (Copy), toolbox row. *(Theme 2)*
5. **[Med] Library FolderList** — resolve the rounded + left-border-accent anti-pattern. *(Theme 5)*
6. **[Low] Help/modal links** — add `focus-visible` ring to match the focus affordance `IconButton` already provides.

_Raw per-feature scores, dimension breakdowns, evidence, and verifier notes: workflow `wf_41af3ba1-caa` (44 agents). Capture script: `web/scripts/design-audit-shots.mjs`._

---

## Post-fix record — 2026-08-31 (scores pending independent re-review)

This append-only record preserves the 2026-06-07 audit above. It does not recalculate its 1–5 scores; a second independent review is still required.

| Milestone | Commit | Implemented fact | Evidence |
|---|---|---|---|
| M1 — contrast | `e3187922` | Added `danger.onDark`; promoted Help, login, console, and CSS hint text to AA-safe ink-surface tokens. | `accent.onDark`/ink-800 **6.47:1**; `danger.onDark`/ink-800 **5.86:1**; `ondark.muted`/ink-900 **6.37:1**; existing `amber.strong`/paper-50 **4.71:1**. Screenshot: `web/tmp/design-audit/m1-20260828/`. |
| M2 — preview composition | `da8afe86` | Present fit now scales small diagrams up as well as shrinking oversized diagrams; fullscreen keeps the console hidden. | Regression test exercises 400×300 content in 800×600 canvas → `scale(2)`. Screenshot: `web/tmp/design-audit/m2-20260828/fullscreen-preview.png`. |
| M3 — Toolbox rest state | `e9cf50da` | Each shipped insert control has a persistent bordered ink chip. | Component screenshot: `web/tmp/design-audit/m3-20260828/toolbox-resting.png`. |
| M4 — hit targets | `6738dc09` | Switch, compact buttons, icon buttons, and Stop sharing control use larger targets. | Settings screenshot: `web/tmp/design-audit/m4-20260828/settings-switches.png`. |
| M5 — FolderList treatment | `f2efa420` | Active folder uses rounded `bg-accent-soft` treatment without a left accent rail. | Component screenshot: `web/tmp/design-audit/m5-20260828/active-folder.png`. |
| M6 — Help focus | `37756cc4` | All Help links retain the established `ring-draft` focus-visible affordance. | Focused-link screenshot: `web/tmp/design-audit/m6-20260828/help-link-focused.png`. |

Focused test evidence during implementation: `yarn test --` against the ten in-scope files passed **103/103**; `yarn build` passed. In the isolated closeout worktree, full `yarn test` passed **107 files / 1091 tests / 1 skipped**; `yarn build` passed. Earlier non-isolated runs observed failures in `useItems` refresh cases and `cjkAutocorrect` compose-mid-session; they did not reproduce in the isolated closeout run, so they are recorded as working-tree-context observations rather than attributed defects. Screenshot paths above are local capture artifacts and are not committed with this audit copy.
