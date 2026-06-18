# Report a Bug — prefilled GitHub issue (+ Storybook bootstrap)

**Date:** 2026-06-14
**Branch:** `rewrite/web-foundation`
**Status:** Design — pending implementation plan

## Summary

The web/ rewrite is a full redesign. New UI means new rough edges, and the only
current path to report anything is buried three clicks deep (App menu → Help →
"Contact us" / GitHub link). This adds a **prominent, persistent "Report a bug"
entry point** that produces an **actionable, prefilled GitHub issue** — zero new
backend, structured context auto-attached.

It also **bootstraps Storybook** in the rewrite (none exists today), with the
Report-a-bug components as its first inhabitants, establishing the pattern for the
rest of the rewrite's UI primitives.

## Goal & success criteria

- A user who hits a bug can report it in **≤2 clicks** from any screen.
- The resulting GitHub issue contains enough context (description + app version +
  browser/OS + view + optional DSL) to **reproduce without a back-and-forth**.
- No proprietary diagram leaks **without informed consent** (public-issue warning).
- Storybook runs in `web/` (`pnpm storybook`) showing the new components' states
  against the real Drafting Table tokens + dark ink surface.

## Context & constraints

- **Stack:** React 19 + Vite 8 + Tailwind 3 + Vitest/Testing Library. UI built
  from `web/src/ui/*` primitives (Drafting Table design system: semantic tokens,
  dark "ink" surfaces for chrome/modals, "paper" for the canvas).
- **Backend is frozen** — no new Firebase cloud functions. This rules out a
  server-side report sink and is *why* we use a client-only GitHub-prefill flow.
- **Audience is developers**; the repo is public and already linked in Help
  (`github.com/ZenUml/web-sequence`), so GitHub issues are a natural, zero-infra
  destination.
- **Global stylesheet:** `web/src/styles/globals.css` (imported in `main.tsx`).
- **No Storybook today:** no `.storybook/`, no `*.stories.*`, no SB deps. Vite 8
  needs **Storybook 9.x** (SB 8 topped out at Vite 6; Vite 8 / Rolldown support
  landed and shipped — storybook#33789, closed "Done", Feb 2026).

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Purpose | **Bug reports for the redesign rollout** — optimized for actionable, context-rich reports. |
| Destination | **Prefilled GitHub issue** (client-only; no backend). |
| Include diagram DSL? | **Yes, via an opt-in checkbox defaulted ON**, clearly labeled "will be public." |
| Placement | **Floating button, bottom-right** (keeps the header's three-verb group pure). |
| Storybook | **Bootstrap Storybook 9 in this feature**; ship the first stories here. |

Reversible calls made by the author (not separately confirmed; cheap to change):
- **FAB is app-wide** (editor + hub), so breakage on any screen is reportable.
  DSL capture is only offered when there is editor content.
- **Fallback links to the existing Contact us page** (`zenuml.com/docs/about/contact-us`),
  not a `mailto:` — there is no verified support email to hardcode.

## Architecture & components

All new code under `web/src/`.

| File | Responsibility |
|---|---|
| `services/bugReport.ts` | **Pure** `buildIssueUrl(input): string`. The only piece with real logic → the most-tested. Builds title + markdown body + `labels`, URL-encodes, and enforces the length budget (truncates DSL last). No DOM, no globals — takes everything as input. |
| `components/feedback/ReportBugButton.tsx` | The FAB — fixed bottom-right pill (🐞 "Report a bug"), built from `ui/Button` + tokens. Icon-only below `md`. Opens the modal. |
| `components/feedback/ReportBugModal.tsx` | `Dialog`/`DialogContent` (dark ink surface) holding: description `Textarea`; DSL toggle (`ui/Switch`, default **on**, "Include my diagram code — will be public"); an "Attached:" summary listing exactly what goes in the issue; primary **Open GitHub issue** button; quiet "No GitHub account? **Contact us**" link. |
| `app/AppRoot.tsx` (wiring) | Renders `ReportBugButton` app-wide; supplies current DSL (from the editor store), `APP_VERSION`, current view, signed-in flag, and the analytics hook. On submit: `window.open(url, '_blank', 'noopener,noreferrer')`. |

**Boundaries:** the button knows nothing about GitHub; the modal collects intent;
`buildIssueUrl` is a pure transform; AppRoot is the only place that touches the
store/window. Each is understandable and testable in isolation.

## `buildIssueUrl` contract

Input:

```ts
interface BuildIssueInput {
  description: string;       // required, non-empty (UI gates this)
  includeDsl: boolean;
  dsl?: string;             // current editor source; omitted when no content
  appVersion: string;       // e.g. "2026.6.7"
  userAgent: string;        // navigator.userAgent
  view: 'editor' | 'hub' | string;
  signedIn: boolean;
}
```

Output URL:
`https://github.com/ZenUml/web-sequence/issues/new?title=<t>&body=<b>&labels=bug`

- **Title** = first non-empty line of `description`, trimmed to ~80 chars.
- **Body** (markdown):

  ```markdown
  **Describe the bug**
  <description>

  **Environment**
  - App version: 2026.6.7
  - Browser: <userAgent>
  - View: editor · Signed in: no

  <details><summary>Diagram DSL</summary>

  ```
  <dsl — only when includeDsl && dsl>
  ```
  </details>
  ```

- **`labels=bug`** — best-effort. GitHub applies it only if the label exists on
  the repo and is ignored otherwise (never errors). (Plan: confirm a `bug` label
  exists; if not, either create it once or drop the param.)

### Edge cases

- **URL length (414 URI Too Long).** GitHub rejects oversized prefills. The
  builder caps the encoded URL to a safe budget (~6 KB). DSL is the elastic part:
  if it overflows, it is truncated with a `… (truncated — please paste the rest)`
  marker so the report still goes through. Description + environment are never
  dropped.
- **Empty description.** UI disables Open until there is text; `buildIssueUrl` is
  not called.
- **No DSL available.** When `dsl` is empty/whitespace, the modal hides the DSL
  toggle entirely and the body omits the `<details>` block.

## Visibility & telemetry

- FAB rendered app-wide; styled quiet (low-emphasis until hover) so it doesn't
  fight the diagram. Not dismissable — prominence is the point.
- Two Mixpanel events via the existing `useAnalytics`:
  - `bug_report_opened` — modal opened.
  - `bug_report_submitted` — `{ included_dsl: boolean, view: string }`.
  This tells us whether the redesign-QA channel is actually used.

## Storybook bootstrap

First Storybook in the rewrite. Keep it minimal and token-faithful.

- **Deps (devDependencies):** `storybook`, `@storybook/react-vite` (latest 9.x),
  `@storybook/addon-a11y` (cheap, useful for a contrast-sensitive design system).
  Pin exact versions at install; **boot `storybook dev` once** to confirm the
  Rolldown/Vite 8 builder starts before claiming done.
- **`web/.storybook/main.ts`:** framework `@storybook/react-vite`; stories glob
  `../src/**/*.stories.@(ts|tsx)`; addons `[a11y]`. Inherits the project Vite
  config (Tailwind via the existing `postcss.config.js`, so utilities + tokens
  resolve with no extra wiring).
- **`web/.storybook/preview.ts`:** `import '../src/styles/globals.css'` so tokens
  load; a global decorator that wraps every story in the **dark ink surface**
  (matching where this UI lives) with the app base font; `parameters.backgrounds`
  offering ink (default) + paper.
- **Scripts (`web/package.json`):**
  - `"storybook": "storybook dev -p 6006"`
  - `"build-storybook": "storybook build"`
- **Risk note:** Vite 8 is new; if an addon lags, drop to core + react-vite only.
  CI wiring for `build-storybook` is **out of scope** here (left for a follow-up)
  — this feature only stands up local Storybook + the first stories.

### Stories to ship (colocated `*.stories.tsx`, matching the test-colocation pattern)

`components/feedback/ReportBugButton.stories.tsx`:
- **Default** — desktop pill.
- **Compact** — icon-only (mobile viewport).

`components/feedback/ReportBugModal.stories.tsx` (rendered `open`):
- **Empty** — Open disabled.
- **Filled** — description present, Open enabled.
- **DslIncluded** — toggle on, summary shows DSL will be attached.
- **DslExcluded** — toggle off.
- **NoEditorContent** — DSL toggle hidden.
- **Anonymous** vs **SignedIn** — environment summary differs.

These stories double as the visual documentation of every state.

## Build sequence

1. **`buildIssueUrl` + unit tests** (TDD) — pure, no UI dependency. Lock the
   contract (encoding, DSL on/off, truncation, title derivation, label) first.
2. **`ReportBugModal`** — wired to `buildIssueUrl`; component tests.
3. **`ReportBugButton`** — FAB; component test.
4. **AppRoot wiring** — store/version/analytics/`window.open`; telemetry.
5. **Storybook bootstrap** — deps, `.storybook/`, scripts; boot once.
6. **Stories** for both components.
7. **E2E + screenshot** — one Playwright pass: FAB visible → open modal → fill →
   assert the opened URL contains the description (intercept `window.open`).
   Capture the milestone screenshot.

## Testing & acceptance

- **Unit** `services/bugReport.test.ts`: URL encoding; DSL included vs excluded;
  truncation past budget keeps description + appends marker; title from first
  line; `labels=bug` present.
- **Component** `ReportBugModal.test.tsx`: DSL toggle defaults on; Open disabled
  when empty; Open calls the opener with a URL containing the description; DSL
  toggle hidden when no editor content; Contact-us link present.
  `ReportBugButton.test.tsx`: renders, opens modal on click.
- **E2E** (`web/e2e/`): the journey above + screenshot (per the
  ≥1-screenshot-per-milestone convention).
- **Storybook**: `storybook dev` boots; both stories render against ink tokens.

## Out of scope (YAGNI)

- Server-side report sink / triage dashboard (backend frozen).
- Screenshot attachment (GitHub prefill is URL-only; no file upload via query).
- Category dropdowns / separate "steps to reproduce" field (body template carries
  light structure instead).
- Feature-request path (this entry point is bug-only).
- `build-storybook` in CI (follow-up).

## Risks & open questions

- **Vite 8 ↔ Storybook addon lag.** Mitigation: minimal addon set; core +
  react-vite is the floor.
- **`bug` label may not exist** on the repo → param silently ignored. Plan
  resolves: create the label once or drop the param.
- **URL budget tuning** — 6 KB is a conservative starting point; verify against a
  real long-DSL case during E2E.
