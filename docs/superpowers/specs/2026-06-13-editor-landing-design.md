# Editor as Landing Page — Design Spec

Branch: `rewrite/web-foundation`, target `web/` React 19 codebase.
Decision: bare `/` lands in the **editor** (resume last-opened diagram, else sample),
demoting the hub (HomeView) to an explicit `?view=diagrams` address. This restores the
legacy product's landing behavior on the rewrite's architecture.

## Why (data, 2026-06-13)

Mixpanel project Diagramly.Ai (3373228), web-sequence = `FireWeb` / `WA:*` events:

- `WA:create_diagram`: **26 unique users / 54 events in 30 days** (~12–15/week)
- `WA:download_png` 5–9 uniques/week; `WA:copy_png` 5–8/week; `WA:login_google` 1/30d
- `WA:*` instrumentation only began reporting week of 2026-06-01; legacy events
  (`pageView`, `userEdit`, `hasCode`) return zero rows — that pipeline is dead.

Implications:

1. **A/B testing is infeasible.** ~15 weekly actives split into two arms needs ~400
   users/arm to detect even a large effect at 80% power → ~a year per verdict.
2. **Essentially every visitor is new or occasional**, arriving to draw one diagram.
   A dashboard front door is a lobby in front of the tool. Dashboards pay off when
   users accumulate libraries; the data says almost nobody has one.

## Confirmed decisions

1. **Landing doc**: last-opened diagram (localStorage last-code), else the sample
   diagram for first-timers. Exactly the legacy chain.
2. **Hub address**: `?view=diagrams` search param (consistent with the existing
   single-route `?id=`/`?embed` style; no Firebase hosting changes). Hub UI unchanged.
3. **Validation**: pre/post telemetry, not A/B. Ship to 100%, compare 3–4 weeks
   before/after.

## Design

### Routing (`web/src/app/router.tsx`, `web/src/app/AppRoot.tsx`)

- `validateSearch` gains `view: s.view as string | undefined`.
- `isHomeMode = search.view === 'diagrams' && !idParam && !shareToken && !isEmbed &&
  !runtime.embedCode` — i.e. the hub is now opt-in; `id`/`share-token`/`embed` take
  precedence over `view` if both appear.
- `goHome()` navigates to `?view=diagrams` (today it clears params to `/`).
- All existing deep links (`?id=`, `?share-token=`, `?embed`, `?code=`) untouched.

### Boot on bare `/`

No new machinery. `useBootItem` (`web/src/hooks/useBootItem.ts`) already resolves:
share → `?code=` → `?id=` → last-code (`preserveLastCode`) → `newItem()` (sample).
The hub previously skipped boot on bare `/` (`skip = isHomeMode`); with `isHomeMode`
now opt-in, bare `/` flows through the chain. Returning users resume their last
diagram; first-timers get the sample in the editor.

### Hub stays, demoted

HomeView is unchanged and reachable via the editor's "Your diagrams" breadcrumb
(→ `?view=diagrams`), bookmarkable. Hub-internal navigation (card → `?id=`,
New → editor) already works.

### Telemetry (pre/post validation)

Through the existing `track()` helper:

- `landed_in_editor` `{ bootKind: 'lastcode'|'new'|'item'|'shared'|'code' }` — once
  per boot when the editor is the landing surface.
- `hub_opened` `{ source: 'landing-param'|'breadcrumb' }` — measures real demand for
  the dashboard.
- `first_edit` — once per session, on the first user-initiated code change.
  (Verified: `web/` has no edit tracking today — the legacy `userEdit` event was
  never ported — so this is a new event.)

Decision metrics: % of sessions reaching an edit; time-to-first-edit; `hub_opened`
rate. Compare 3–4 weeks pre/post alongside `WA:*` baselines.

### Tests

- AppRoot unit tests asserting `'/' → HomeView` flip to `'/' → editor` and
  `'?view=diagrams' → HomeView`.
- E2E helpers re-ground: `gotoHome` → `/?view=diagrams`; `openEditor` → `/` (the
  staging-gate specs that click through HomeView to reach the editor get simpler).
- `resolveBootItem` is pure and already unit-tested; landing logic needs no new
  resolver tests, only the `isHomeMode` gate tests.

## Risks / trade-offs

- First-timers land on an editor with sample code instead of an explanatory empty
  state — the original product's bet, restated deliberately. The sample is the
  explanation.
- Pre/post comparison has seasonal confounds; accepted at this traffic level.
- Any bookmarks/links to the hub-as-`/` (pre-change staging) silently become editor
  landings — acceptable; the hub was only the default for ~2 weeks on staging.
