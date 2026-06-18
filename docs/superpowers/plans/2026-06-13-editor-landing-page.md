# Editor as Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bare `/` land in the editor (resume last-opened diagram, else sample), demoting the hub (HomeView) to an explicit `?view=diagrams` address, and add pre/post telemetry to validate the change.

**Architecture:** Invert one routing condition — `isHomeMode` becomes opt-in via a new `?view=diagrams` search param instead of being the default for bare `/`. The existing `useBootItem` boot chain (share → `?code=` → `?id=` → last-code → sample) already produces the resume-or-sample landing, so no resolver work is needed; we just stop skipping it on bare `/`. Three telemetry events ride the existing `track()` helper.

**Tech Stack:** React 19, TanStack Router (search-param routing), Zustand stores, Vitest + Testing Library (unit), Playwright (e2e). Package manager: Yarn for unit/build, pnpm for e2e.

Spec: `docs/superpowers/specs/2026-06-13-editor-landing-design.md`.

**Working directory for all commands:** `web/` (the rewrite app). Run `cd web` first.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `web/src/app/router.tsx` | Route + search-param schema | Add `view` to `validateSearch` |
| `web/src/app/AppRoot.tsx` | App shell, home/editor gating, navigation, telemetry | Flip `isHomeMode` to opt-in; `goHome` → `?view=diagrams`; wire 3 events |
| `web/src/hooks/useBootItem.ts` | Boot item resolution | Add optional `onResolved(kind)` callback so AppRoot can fire `landed_in_editor` with the resolved `bootKind` |
| `web/src/app/AppRoot.test.tsx` | AppRoot unit tests | Re-ground 5 home-view tests `/` → `/?view=diagrams`; add editor-on-`/` + telemetry tests |
| `web/src/hooks/useBootItem.test.tsx` | Boot hook tests | Add `onResolved` callback test |
| `web/e2e/helpers/editor.ts` | E2E seed helper | Simplify `seedAndOpen` comment; verify still green (already tolerant) |

---

## Task 1: Router — add `?view` search param

**Files:**
- Modify: `web/src/app/router.tsx:8-15` (the `validateSearch` object)

- [ ] **Step 1: Write the failing test**

Create `web/src/app/router.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { indexRoute } from './router';

describe('indexRoute.validateSearch', () => {
  const validate = indexRoute.options.validateSearch as (s: Record<string, unknown>) => Record<string, unknown>;

  it('parses view=diagrams into the search shape', () => {
    expect(validate({ view: 'diagrams' }).view).toBe('diagrams');
  });

  it('leaves view undefined when absent (bare /)', () => {
    expect(validate({}).view).toBeUndefined();
  });

  it('still parses the existing id param', () => {
    expect(validate({ id: 'abc' }).id).toBe('abc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && yarn vitest run src/app/router.test.tsx`
Expected: FAIL — `validate({ view: 'diagrams' }).view` is `undefined` (router does not yet read `view`).

- [ ] **Step 3: Add the `view` param to validateSearch**

In `web/src/app/router.tsx`, add the `view` line to the returned object (after `id`):

```tsx
  validateSearch: (s: Record<string, unknown>) => ({
    id: s.id as string | undefined,
    view: s.view as string | undefined,
    'share-token': s['share-token'] as string | undefined,
    embed: s.embed !== undefined ? true : undefined,
    code: s.code as string | undefined,
    title: s.title as string | undefined,
    stickyOffset: s.stickyOffset !== undefined ? Number(s.stickyOffset) : undefined,
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && yarn vitest run src/app/router.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/app/router.tsx web/src/app/router.test.tsx
git commit -m "feat(web/router): add ?view search param (hub address for editor-landing change)"
```

---

## Task 2: AppRoot — flip `isHomeMode` to opt-in, redirect bare `/` to the editor

**Files:**
- Modify: `web/src/app/AppRoot.tsx:352-358` (read `view`, redefine `isHomeMode`)
- Modify: `web/src/app/AppRoot.tsx:667-681` (`goHome` → `?view=diagrams`)
- Modify: `web/src/app/AppRoot.test.tsx` — re-ground 5 home-view tests + add an editor-on-`/` test

**Context:** Today `isHomeMode = !idParam && !shareToken && !runtime.embedCode && !isEmbed` (`AppRoot.tsx:358`) — bare `/` is the hub. We make the hub opt-in: it requires `view === 'diagrams'`. Bare `/` then falls through to `useBootItem` (the boot is skipped only when `isHomeMode || embedByValue`, `AppRoot.tsx:383`), which resumes last-code or seeds the sample.

- [ ] **Step 1: Write the failing test — bare `/` renders the editor**

In `web/src/app/AppRoot.test.tsx`, add inside `describe('AppRoot', …)` (near the existing "renders editor and preview regions" test):

```tsx
  it("bare '/' lands in the editor, not the hub", async () => {
    window.history.replaceState({}, '', '/');
    render(<AppRoot />);
    expect(await screen.findByTestId('editor-region')).toBeInTheDocument();
    expect(screen.queryByTestId('home-view')).toBeNull();
  });

  it("'?view=diagrams' renders the hub", async () => {
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    expect(await screen.findByTestId('home-view')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd web && yarn vitest run src/app/AppRoot.test.tsx -t "lands in the editor"`
Expected: FAIL — bare `/` still renders `home-view` (no `editor-region`), so `findByTestId('editor-region')` times out.

- [ ] **Step 3: Redefine `isHomeMode` as opt-in**

In `web/src/app/AppRoot.tsx`, replace the `isHomeMode` definition (around line 352-358). Add `viewParam` next to `idParam`:

```tsx
  const idParam = search.id ?? null;
  const viewParam = search.view ?? null;
  const shareToken = search['share-token'] ?? null;

  // Editor-as-landing (2026-06-13): the hub is now OPT-IN via ?view=diagrams.
  // Bare "/" falls through to useBootItem (resume last-code, else sample) — the
  // legacy landing behavior. id/share-token/embed still take precedence: a deep
  // link with both ?view=diagrams and ?id= opens the diagram, not the hub.
  const isHomeMode =
    viewParam === 'diagrams' && !idParam && !shareToken && !runtime.embedCode && !isEmbed;
```

- [ ] **Step 4: Point `goHome` at `?view=diagrams`**

Replace `goHome` (around line 667-681). It must SET `view: 'diagrams'` and clear the editor params:

```tsx
  // Editor-as-landing: return to the hub by setting ?view=diagrams (and clearing
  // the editor params). Previously this cleared everything to bare "/", which now
  // lands in the editor.
  function goHome() {
    void navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        view: 'diagrams',
        id: undefined,
        'share-token': undefined,
        embed: undefined,
        code: undefined,
        title: undefined,
        stickyOffset: undefined,
      }),
    });
  }
```

- [ ] **Step 5: Re-ground the 5 home-view unit tests**

In `web/src/app/AppRoot.test.tsx`, these 5 tests navigate to bare `/` expecting the hub. Change each `window.history.replaceState({}, '', '/')` that is immediately followed by a `home-view`/`home-grid`/`lib-export-all`/`lib-import-input` assertion to `'/?view=diagrams'`. The lines (before your edits shift them) are:

- ~311 (import-failed dialog on home) → `'/?view=diagrams'`
- ~326 (ask-to-import on home) → `'/?view=diagrams'`
- ~901 (`'exportItems' uses legacy category 'fn'`) → `'/?view=diagrams'`
- ~921 (`'itemsImported' uses legacy category 'fn'`) → `'/?view=diagrams'`
- ~955 (`'itemsImported' label is the newly-added count`) → `'/?view=diagrams'`

Leave the `afterEach` reset at line ~200 (`replaceState({}, '', '/')`) and the `beforeEach` default `'/?id=t-boot'` (line ~160) UNCHANGED — the default editor URL still works because `id` takes precedence.

Verify you caught them all:

```bash
cd web && grep -n "replaceState({}, '', '/')" src/app/AppRoot.test.tsx
```

Expected after edits: only the `afterEach` (line ~200) and the harness helper at line ~53 (`qs ? ... : '/'`) remain on bare `/`. Every test that then asserts `home-view`/`home-grid`/`lib-*` must be on `/?view=diagrams`.

- [ ] **Step 6: Run the full AppRoot suite**

Run: `cd web && yarn vitest run src/app/AppRoot.test.tsx`
Expected: PASS (all tests, including the 2 new gating tests and the 5 re-grounded ones).

- [ ] **Step 7: Commit**

```bash
git add web/src/app/AppRoot.tsx web/src/app/AppRoot.test.tsx
git commit -m "feat(web/hub)!: editor is the landing page — hub moves to ?view=diagrams; bare / resumes last diagram or seeds sample via existing boot chain"
```

---

## Task 3: Telemetry — `landed_in_editor` with `bootKind`

**Files:**
- Modify: `web/src/hooks/useBootItem.ts` (add `onResolved` callback to `BootDeps` + call it in the hook)
- Modify: `web/src/hooks/useBootItem.test.tsx` (test the callback)
- Modify: `web/src/app/AppRoot.tsx:369-383` (pass `onResolved` that fires the event)

**Context:** `useBootItem` resolves a `BootResult` with a `.kind` (`'shared' | 'item' | 'code' | 'lastcode' | 'share-error' | 'new'`) but only returns `{ shareError, clearShareError }`. We surface the resolved kind via an optional `onResolved(kind)` callback so AppRoot can fire `landed_in_editor` with `bootKind`. The callback is the minimal seam — the pure `resolveBootItem` stays untouched.

- [ ] **Step 1: Write the failing test for `onResolved`**

In `web/src/hooks/useBootItem.test.tsx`, add a new `describe` block (the hook needs a React renderer — use `@testing-library/react`'s `renderHook`):

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useBootItem } from './useBootItem';

describe('useBootItem onResolved callback', () => {
  it('calls onResolved with the resolved kind once auth is ready', async () => {
    const onResolved = vi.fn();
    const deps = {
      idParam: null,
      shareToken: null,
      codeParam: null,
      codeTitle: null,
      preserveLastCode: false,
      getItem: vi.fn(),
      getSharedItem: vi.fn(),
      getLastCode: vi.fn(),
      onResolved,
    };
    renderHook(() => useBootItem(deps, true, false));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('new'));
  });

  it('does not call onResolved when skipped (embed-by-value)', async () => {
    const onResolved = vi.fn();
    const deps = {
      idParam: null, shareToken: null, codeParam: null, codeTitle: null,
      preserveLastCode: false,
      getItem: vi.fn(), getSharedItem: vi.fn(), getLastCode: vi.fn(),
      onResolved,
    };
    renderHook(() => useBootItem(deps, true, true)); // skip=true
    // Give any pending microtasks a chance, then assert it never fired.
    await new Promise((r) => setTimeout(r, 0));
    expect(onResolved).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && yarn vitest run src/hooks/useBootItem.test.tsx -t "onResolved"`
Expected: FAIL — `onResolved` is not part of `BootDeps` (TS error) and never called.

- [ ] **Step 3: Add `onResolved` to `BootDeps` and call it in the hook**

In `web/src/hooks/useBootItem.ts`, add to the `BootDeps` interface (after `getLastCode`):

```tsx
  getLastCode: () => Promise<Item | null>;
  /**
   * Editor-as-landing telemetry seam: fired once with the resolved boot kind after
   * resolution completes (NOT on skip). AppRoot uses it to emit `landed_in_editor`
   * with bootKind. Optional so the pure resolver and existing callers are unaffected.
   */
  onResolved?: (kind: BootResult['kind']) => void;
```

In the hook's `.then((result) => { … })` block, call `onResolved` after the switch, before the closing brace of `.then`:

```tsx
    resolveBootItem(deps).then((result) => {
      switch (result.kind) {
        case 'shared':
        case 'item':
        case 'code':
        case 'lastcode':
          loadItem(result.item);
          break;
        case 'share-error':
          setShareError(true);
          break;
        case 'new':
          newItem();
          break;
      }
      deps.onResolved?.(result.kind);
    }).catch(() => {
      newItem();
    });
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && yarn vitest run src/hooks/useBootItem.test.tsx`
Expected: PASS (existing resolver tests + 2 new onResolved tests).

- [ ] **Step 5: Wire `landed_in_editor` in AppRoot**

In `web/src/app/AppRoot.tsx`, in the `useBootItem({ … })` deps object (around line 369-382), add an `onResolved` handler after `getLastCode`:

```tsx
    getLastCode: () => localStore.get<Item | null>(LS_KEYS.code, null),
    // Editor-as-landing telemetry: one event per editor boot, tagged with how the
    // diagram was resolved. Skipped on the hub (boot is skipped when isHomeMode) and
    // on embed-by-value — so this fires only when the editor is the landing surface.
    onResolved: (bootKind) =>
      track('landed_in_editor', { category: 'navigation', label: bootKind }),
  // Hub: skip boot when on home — we don't want newItem() seeding a blank diagram there.
  }, authReady, isHomeMode || embedByValue);
```

- [ ] **Step 6: Add an AppRoot telemetry test**

In `web/src/app/AppRoot.test.tsx`, add (the file already has `lastEnvelope(eventName)` + `trackMock`):

```tsx
  it("fires 'landed_in_editor' with bootKind on a bare '/' editor landing", async () => {
    window.history.replaceState({}, '', '/');
    render(<AppRoot />);
    await screen.findByTestId('editor-region');
    const env = await waitFor(() => {
      const e = lastEnvelope('landed_in_editor');
      expect(e).toBeDefined();
      return e!;
    });
    // getItem is mocked to reject in this suite → boot resolves kind 'new'.
    expect(env.label).toBe('new');
    expect(env.category).toBe('navigation');
  });
```

- [ ] **Step 7: Run the AppRoot + hook suites**

Run: `cd web && yarn vitest run src/app/AppRoot.test.tsx src/hooks/useBootItem.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/hooks/useBootItem.ts web/src/hooks/useBootItem.test.tsx web/src/app/AppRoot.tsx web/src/app/AppRoot.test.tsx
git commit -m "feat(web/telemetry): emit landed_in_editor{bootKind} via useBootItem onResolved seam"
```

---

## Task 4: Telemetry — `hub_opened` and `first_edit`

**Files:**
- Modify: `web/src/app/AppRoot.tsx` — `goHome` (`hub_opened` source breadcrumb); a mount effect (`hub_opened` source landing-param); a `setDsl` wrapper (`first_edit`)
- Modify: `web/src/app/AppRoot.test.tsx` — 2 tests

**Context:**
- `hub_opened` fires when the hub becomes the active surface, with `source`: `'breadcrumb'` (user clicked "Your diagrams" → `goHome`) or `'landing-param'` (arrived directly at `?view=diagrams`).
- `first_edit` fires once per AppRoot mount on the first user-initiated DSL change. `setDsl` is wired to `CodeEditor onChange` at `AppRoot.tsx:1162` and `1252`. We wrap it.

- [ ] **Step 1: Write the failing tests**

In `web/src/app/AppRoot.test.tsx`:

```tsx
  it("fires 'hub_opened' with source 'landing-param' when arriving at ?view=diagrams", async () => {
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const env = await waitFor(() => {
      const e = lastEnvelope('hub_opened');
      expect(e).toBeDefined();
      return e!;
    });
    expect(env.label).toBe('landing-param');
  });

  it("fires 'first_edit' once on the first DSL change", async () => {
    window.history.replaceState({}, '', '/?id=t-boot');
    render(<AppRoot />);
    await screen.findByTestId('editor-region');
    const editor = screen.getByTestId('dsl-editor');
    const textbox = editor.querySelector('[contenteditable], textarea, input') ?? editor;
    await act(async () => { await userEvent.click(textbox); await userEvent.type(textbox, 'A.b'); });
    await waitFor(() => expect(lastEnvelope('first_edit')).toBeDefined());
    // Count: exactly one first_edit despite multiple keystrokes.
    const count = trackMock.mock.calls.filter(
      ([payload]) => (payload as { event?: string }).event === 'first_edit',
    ).length;
    expect(count).toBe(1);
  });
```

NOTE: If the `dsl-editor`'s CodeMirror surface does not accept `userEvent.type` cleanly in jsdom, drive the change through the store action the editor calls instead: replace the type block with a direct invocation of the wrapped handler by simulating two `setDsl` calls. Inspect how existing tests in this file edit the DSL (search for `setDsl`, `dsl-editor`, or `fireEvent` usage) and mirror that exact mechanism — do not invent a new one.

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && yarn vitest run src/app/AppRoot.test.tsx -t "hub_opened|first_edit"`
Expected: FAIL — neither event is emitted yet.

- [ ] **Step 3: Add the `first_edit` wrapper**

In `web/src/app/AppRoot.tsx`, near the other handlers (after `goHome`), add a once-per-mount ref and a wrapped DSL handler. First, ensure `useRef` is imported (it is used elsewhere — confirm `import { … useRef … } from 'react'` at the top). Add:

```tsx
  const firstEditFired = useRef(false);
  function handleDslChange(next: string) {
    if (!firstEditFired.current) {
      firstEditFired.current = true;
      track('first_edit', { category: 'fn' });
    }
    setDsl(next);
  }
```

Then replace the two `onChange={setDsl}` usages on the DSL `CodeEditor` (lines ~1162 and ~1252) with `onChange={handleDslChange}`. Verify there are exactly two:

```bash
cd web && grep -n "onChange={setDsl}\|onCodeChange={setDsl}" src/app/AppRoot.tsx
```

Match the prop name actually present (`onChange` at 1162, `onCodeChange` at 1252) and swap each to `handleDslChange`. CSS/HTML editors use different handlers (`handleSetCss`) — do NOT touch those; `first_edit` tracks DSL edits only.

- [ ] **Step 4: Add the `hub_opened` events**

For the breadcrumb source, add the track call inside `goHome` (first line of the function body):

```tsx
  function goHome() {
    track('hub_opened', { category: 'navigation', label: 'breadcrumb' });
    void navigate({ /* …unchanged… */ });
  }
```

For the landing-param source, add an effect that fires once when `isHomeMode` is true on mount. Place it near other effects, after `isHomeMode` is defined:

```tsx
  // Editor-as-landing telemetry: arriving directly at ?view=diagrams (not via the
  // breadcrumb) — fire once. goHome covers the breadcrumb path with its own source.
  const hubLandingFired = useRef(false);
  useEffect(() => {
    if (isHomeMode && !hubLandingFired.current) {
      hubLandingFired.current = true;
      track('hub_opened', { category: 'navigation', label: 'landing-param' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHomeMode]);
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd web && yarn vitest run src/app/AppRoot.test.tsx -t "hub_opened|first_edit"`
Expected: PASS.

- [ ] **Step 6: Run the full AppRoot suite (guard against double-count regressions)**

Run: `cd web && yarn vitest run src/app/AppRoot.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/AppRoot.tsx web/src/app/AppRoot.test.tsx
git commit -m "feat(web/telemetry): emit hub_opened{source} and first_edit (once/mount) for editor-landing pre/post validation"
```

---

## Task 5: E2E helper re-ground + full green

**Files:**
- Modify: `web/e2e/helpers/editor.ts:43-63` (`seedAndOpen` — update stale comment; the click-through is already tolerant)

**Context:** `seedAndOpen` goes to `/`, and IF a `home-view` is visible clicks through to the editor, ELSE waits for editor content. After this change bare `/` lands in the editor directly, so the `home-view` branch is dead but harmless. Keep the tolerant branch (it documents intent and survives a revert), fix the comment.

- [ ] **Step 1: Update the `seedAndOpen` doc comment**

In `web/e2e/helpers/editor.ts`, replace the "Hub routing (PR #800/#801)" comment block (lines ~43-46) with:

```ts
 * Editor-as-landing (2026-06-13): "/" now lands directly in the editor (resume
 * last diagram, else sample). The home-view click-through below is kept as a
 * tolerant fallback — it no-ops on the current default but survives a revert and
 * still works for any flow that opens the hub first (?view=diagrams).
```

- [ ] **Step 2: List the e2e specs to confirm collection is unaffected**

Run: `cd web && pnpm exec playwright test --list 2>&1 | tail -20`
Expected: the spec list prints without collection errors (no network needed). If `pnpm exec playwright` is unavailable, use `npx playwright test --list`.

- [ ] **Step 3: Run the full unit suite (whole-app regression gate)**

Run: `cd web && yarn test`
Expected: PASS — all unit + integration tests green. Pay attention to `AppRoot.editorWiring.test.tsx` (it boots the editor and may have assumed bare `/`); if any test there navigated to bare `/` expecting the hub, re-ground it to `/?view=diagrams` the same way as Task 2 Step 5, then re-run.

- [ ] **Step 4: Typecheck**

Run: `cd web && yarn typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/e2e/helpers/editor.ts
git commit -m "test(web/e2e): re-ground seedAndOpen comment for editor-as-landing; tolerant hub fallback retained"
```

---

## Task 6: Live verification (Playwright screenshot, real browser)

**Context:** Per the project's acceptance rule (memory: "Final acceptance = Playwright + screenshots"), capture the real landing behavior against the local dev server.

**Files:** none (verification only).

- [ ] **Step 1: Confirm the dev server is up**

Run: `curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/`
Expected: `200`. If not 200, start it: `cd web && yarn dev` (check CLAUDE.md — do not start a second server if one is already running).

- [ ] **Step 2: Capture bare `/` (should be the editor)**

Run:
```bash
cd /Users/pengxiao/workspaces/zenuml/web-sequence
agent-browser set viewport 1440 900 && agent-browser open http://localhost:3000/ && agent-browser wait --load networkidle && agent-browser wait 1500 && agent-browser screenshot tmp/editor-landing/bare-root.png
```
Expected: editor chrome (DSL panel + preview), NOT the hub empty-state.

- [ ] **Step 3: Capture `?view=diagrams` (should be the hub)**

Run:
```bash
agent-browser open "http://localhost:3000/?view=diagrams" && agent-browser wait --load networkidle && agent-browser wait 1500 && agent-browser screenshot tmp/editor-landing/hub.png && agent-browser close
```
Expected: HomeView library grid / empty-state.

- [ ] **Step 4: Read both screenshots and confirm**

Read `tmp/editor-landing/bare-root.png` and `tmp/editor-landing/hub.png`. Confirm bare `/` shows the editor and `?view=diagrams` shows the hub. If either is wrong, STOP and diagnose before claiming done.

- [ ] **Step 5: Final report**

Summarize: behavior change, telemetry events added, test counts (unit pass count), and attach the two screenshot paths. Do NOT commit screenshots (they live under `tmp/`, which is gitignored).

---

## Self-Review notes (author)

- **Spec coverage:** routing flip (Task 2) ✓; `?view=diagrams` hub (Tasks 1–2) ✓; resume-last/sample via existing boot (Task 2, no resolver change — confirmed `useBootItem.ts` already does this) ✓; `landed_in_editor` (Task 3) ✓; `hub_opened` (Task 4) ✓; `first_edit` as a NEW event (Task 4 — spec confirms `web/` has no edit tracking) ✓; test re-grounding (Tasks 2, 5) ✓; e2e helper (Task 5) ✓; live screenshot acceptance (Task 6) ✓.
- **Precedence rule** (`id`/`share-token`/`embed` beat `view`) is encoded in the `isHomeMode` conjunction (Task 2 Step 3) and asserted indirectly by the unchanged `beforeEach` default `/?id=t-boot` staying in the editor.
- **Naming consistency:** event names `landed_in_editor` / `hub_opened` / `first_edit`; `bootKind` label values match `BootResult['kind']`; handler `handleDslChange`; refs `firstEditFired` / `hubLandingFired` — used identically across tasks.
- **Known soft spot:** Task 4 Step 1's `first_edit` test drives CodeMirror via `userEvent.type`, which can be flaky in jsdom — the step includes an explicit fallback instruction to mirror the file's existing DSL-edit mechanism.
