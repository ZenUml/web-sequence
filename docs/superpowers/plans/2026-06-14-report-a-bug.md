# Report a Bug — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prominent, persistent "Report a bug" floating button that opens an in-app modal and produces a prefilled GitHub issue with auto-captured context — and bootstrap Storybook in the `web/` rewrite with this feature's components as its first stories.

**Architecture:** A pure `buildIssueUrl` helper (no DOM/globals) turns user input + context into a GitHub `issues/new?title=&body=&labels=bug` URL with a length guard. `ReportBugModal` (Drafting Table `Dialog`) collects the description + a default-ON "include my diagram code (public)" toggle and shows exactly what will be attached. `ReportBugButton` is a fixed bottom-right FAB that owns the modal. `AppRoot` renders the FAB app-wide (hub + editor returns, not embed), feeding it the current DSL, app version, view, signed-in flag, and two Mixpanel events.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 3 (Drafting Table tokens), Vitest + Testing Library, Radix (Dialog/Switch via `web/src/ui`), Storybook (current latest major, `@storybook/react-vite`), Playwright. Package manager for `web/` is **pnpm**.

**Conventions:**
- All `pnpm` commands shown as `pnpm -C web …` (run from repo root; `-C web` sets the project dir).
- All `git` commands run from repo root; paths are `web/…`.
- Commit messages are one line.

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/services/bugReport.ts` (create) | Pure `buildIssueUrl(input)` → GitHub URL. Body markdown + title derivation + URL length guard/truncation. No DOM, no globals. |
| `web/src/services/bugReport.test.ts` (create) | Unit tests for the builder. |
| `web/src/components/feedback/ReportBugModal.tsx` (create) | The modal: description field, DSL toggle (default ON), attached-summary, submit, contact-us fallback. Calls `buildIssueUrl`, opens the URL via an injectable `openUrl` (defaults to `window.open`). |
| `web/src/components/feedback/ReportBugModal.test.tsx` (create) | Component tests. |
| `web/src/components/feedback/ReportBugButton.tsx` (create) | Fixed bottom-right FAB; owns modal open state; fires `onOpen`/`onSubmitted`. |
| `web/src/components/feedback/ReportBugButton.test.tsx` (create) | Component test. |
| `web/src/app/AppRoot.tsx` (modify) | Import + render the FAB in the hub and editor returns; wire DSL/version/view/auth + telemetry. |
| `web/.storybook/main.ts` (create) | Storybook config (framework, stories glob, a11y addon). |
| `web/.storybook/preview.ts` (create) | Global CSS import + dark ink decorator. |
| `web/package.json` (modify) | Add `storybook`/`build-storybook` scripts + dev deps. |
| `web/src/components/feedback/ReportBugButton.stories.tsx` (create) | Button stories. |
| `web/src/components/feedback/ReportBugModal.stories.tsx` (create) | Modal state stories. |
| `web/e2e/report-bug.spec.ts` (create) | Playwright journey + screenshot. |

---

## Task 1: `buildIssueUrl` pure helper

**Files:**
- Create: `web/src/services/bugReport.ts`
- Test: `web/src/services/bugReport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/services/bugReport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildIssueUrl, type BuildIssueInput } from './bugReport';

const base: BuildIssueInput = {
  description: 'Arrows render upside down',
  includeDsl: false,
  appVersion: '2026.6.7',
  userAgent: 'Mozilla/5.0 (Test)',
  view: 'editor',
  signedIn: false,
};

function body(url: string): string {
  return new URL(url).searchParams.get('body') ?? '';
}
function title(url: string): string {
  return new URL(url).searchParams.get('title') ?? '';
}

describe('buildIssueUrl', () => {
  it('targets the repo new-issue endpoint with a bug label', () => {
    const url = buildIssueUrl(base);
    expect(url.startsWith('https://github.com/ZenUml/web-sequence/issues/new?')).toBe(true);
    expect(new URL(url).searchParams.get('labels')).toBe('bug');
  });

  it('puts the first non-empty line in the title', () => {
    const url = buildIssueUrl({ ...base, description: '  \n  Arrows broken  \nmore detail' });
    expect(title(url)).toBe('Arrows broken');
  });

  it('falls back to a generic title when description is blank', () => {
    expect(title(buildIssueUrl({ ...base, description: '   \n  ' }))).toBe('Bug report');
  });

  it('includes environment lines and the description', () => {
    const b = body(buildIssueUrl(base));
    expect(b).toContain('Arrows render upside down');
    expect(b).toContain('App version: 2026.6.7');
    expect(b).toContain('Browser: Mozilla/5.0 (Test)');
    expect(b).toContain('View: editor · Signed in: no');
  });

  it('omits the DSL block when includeDsl is false', () => {
    expect(body(buildIssueUrl({ ...base, includeDsl: false, dsl: 'A -> B: x' }))).not.toContain('<details>');
  });

  it('includes the DSL block when includeDsl is true and dsl is present', () => {
    const b = body(buildIssueUrl({ ...base, includeDsl: true, dsl: 'A -> B: hello' }));
    expect(b).toContain('<details><summary>Diagram DSL</summary>');
    expect(b).toContain('A -> B: hello');
  });

  it('omits the DSL block when dsl is empty even if includeDsl is true', () => {
    expect(body(buildIssueUrl({ ...base, includeDsl: true, dsl: '   ' }))).not.toContain('<details>');
  });

  it('truncates an oversized DSL so the URL stays within budget', () => {
    const url = buildIssueUrl({ ...base, includeDsl: true, dsl: 'X'.repeat(20000) });
    expect(url.length).toBeLessThanOrEqual(6000);
    const b = body(url);
    expect(b).toContain('truncated');
    expect(b).toContain('Arrows render upside down'); // description is never dropped
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C web test src/services/bugReport.test.ts`
Expected: FAIL — `Failed to resolve import './bugReport'` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `web/src/services/bugReport.ts`:

```ts
// Pure builder for a prefilled GitHub "new issue" URL. No DOM, no globals — every
// input is passed in, so this is trivially unit-tested. The caller (ReportBugModal)
// supplies navigator.userAgent and the current editor DSL.

const REPO = 'https://github.com/ZenUml/web-sequence';

// Conservative cap on total URL length. GitHub returns 414 (URI Too Long) on
// oversized issue prefills; ~8 KB is the practical ceiling, so 6 KB leaves headroom.
const URL_BUDGET = 6000;

const TRUNCATION_MARKER = '\n… (truncated — please paste the rest)';

export interface BuildIssueInput {
  description: string;
  includeDsl: boolean;
  dsl?: string;
  appVersion: string;
  userAgent: string;
  view: string;
  signedIn: boolean;
}

function firstLine(description: string, max = 80): string {
  const line = description
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return 'Bug report';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function environmentBlock(input: BuildIssueInput): string {
  return [
    '**Describe the bug**',
    input.description.trim(),
    '',
    '**Environment**',
    `- App version: ${input.appVersion}`,
    `- Browser: ${input.userAgent}`,
    `- View: ${input.view} · Signed in: ${input.signedIn ? 'yes' : 'no'}`,
  ].join('\n');
}

function dslBlock(dsl: string): string {
  return ['', '<details><summary>Diagram DSL</summary>', '', '```', dsl, '```', '</details>'].join('\n');
}

function composeUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title, body, labels: 'bug' });
  return `${REPO}/issues/new?${params.toString()}`;
}

// Largest prefix of `dsl` whose composed URL still fits URL_BUDGET, with the
// truncation marker appended when the full DSL doesn't fit. Binary search keeps
// this O(log n) and deterministic.
function fitDsl(title: string, baseBody: string, dsl: string): string {
  const withDsl = (d: string) => `${baseBody}${dslBlock(d)}`;
  if (composeUrl(title, withDsl(dsl)).length <= URL_BUDGET) return withDsl(dsl);
  let lo = 0;
  let hi = dsl.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = dsl.slice(0, mid) + TRUNCATION_MARKER;
    if (composeUrl(title, withDsl(candidate)).length <= URL_BUDGET) lo = mid;
    else hi = mid - 1;
  }
  return withDsl(dsl.slice(0, lo) + TRUNCATION_MARKER);
}

export function buildIssueUrl(input: BuildIssueInput): string {
  const title = firstLine(input.description);
  const baseBody = environmentBlock(input);
  const dsl = input.dsl?.trim() ? input.dsl : '';
  if (!input.includeDsl || !dsl) return composeUrl(title, baseBody);
  return composeUrl(title, fitDsl(title, baseBody, dsl));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C web test src/services/bugReport.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/services/bugReport.ts web/src/services/bugReport.test.ts
git commit -m "feat(web/feedback): pure buildIssueUrl helper for prefilled GitHub bug reports"
```

---

## Task 2: `ReportBugModal` component

**Files:**
- Create: `web/src/components/feedback/ReportBugModal.tsx`
- Test: `web/src/components/feedback/ReportBugModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/src/components/feedback/ReportBugModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportBugModal } from './ReportBugModal';

const props = {
  open: true,
  onOpenChange: () => {},
  appVersion: '2026.6.7',
  view: 'editor',
  signedIn: false,
};

describe('ReportBugModal', () => {
  it('does not render content when closed', () => {
    render(<ReportBugModal {...props} open={false} dsl="A -> B: x" />);
    expect(screen.queryByTestId('report-bug-modal')).toBeNull();
  });

  it('disables submit until a description is entered', () => {
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    expect(screen.getByTestId('report-bug-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('report-bug-description'), {
      target: { value: 'RenderGlitch' },
    });
    expect(screen.getByTestId('report-bug-submit')).not.toBeDisabled();
  });

  it('defaults the DSL toggle to ON when there is editor content', () => {
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    expect(screen.getByTestId('report-bug-include-dsl').getAttribute('data-state')).toBe('checked');
  });

  it('hides the DSL toggle when there is no editor content', () => {
    render(<ReportBugModal {...props} dsl="" />);
    expect(screen.queryByTestId('report-bug-include-dsl')).toBeNull();
  });

  it('opens a GitHub URL containing the description on submit', () => {
    const openUrl = vi.fn();
    render(<ReportBugModal {...props} dsl="A -> B: x" openUrl={openUrl} />);
    fireEvent.change(screen.getByTestId('report-bug-description'), {
      target: { value: 'RenderGlitch' },
    });
    fireEvent.click(screen.getByTestId('report-bug-submit'));
    expect(openUrl).toHaveBeenCalledTimes(1);
    const url = openUrl.mock.calls[0][0] as string;
    expect(url).toContain('github.com/ZenUml/web-sequence/issues/new');
    expect(url).toContain('RenderGlitch');
  });

  it('offers a contact-us fallback for users without GitHub', () => {
    render(<ReportBugModal {...props} dsl="A -> B: x" />);
    const link = screen.getByRole('link', { name: /contact us/i });
    expect(link.getAttribute('href')).toBe('https://zenuml.com/docs/about/contact-us');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C web test src/components/feedback/ReportBugModal.test.tsx`
Expected: FAIL — cannot resolve `./ReportBugModal`.

- [ ] **Step 3: Write the implementation**

Create `web/src/components/feedback/ReportBugModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, Button, Textarea, Switch } from '../../ui';
import { buildIssueUrl } from '../../services/bugReport';

// Verified contact page (same URL the Help modal links to). Used as the fallback
// for reporters without a GitHub account.
const CONTACT_URL = 'https://zenuml.com/docs/about/contact-us';

export interface ReportBugModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  // Current editor source. Empty/whitespace => no DSL option (hub, or empty doc).
  dsl?: string;
  appVersion: string;
  view: string;
  signedIn: boolean;
  // Side-effect injected for testability; defaults to opening a new tab.
  openUrl?(url: string): void;
  onSubmitted?(meta: { includedDsl: boolean }): void;
}

export function ReportBugModal({
  open,
  onOpenChange,
  dsl,
  appVersion,
  view,
  signedIn,
  openUrl = (url) => window.open(url, '_blank', 'noopener,noreferrer'),
  onSubmitted,
}: ReportBugModalProps) {
  const hasDsl = !!(dsl && dsl.trim());
  const [description, setDescription] = useState('');
  const [includeDsl, setIncludeDsl] = useState(true);

  // Reset the form whenever the modal closes so a reopen starts clean.
  useEffect(() => {
    if (!open) {
      setDescription('');
      setIncludeDsl(true);
    }
  }, [open]);

  const canSubmit = description.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const included = hasDsl && includeDsl;
    const url = buildIssueUrl({
      description,
      includeDsl: included,
      dsl,
      appVersion,
      userAgent: navigator.userAgent,
      view,
      signedIn,
    });
    openUrl(url);
    onSubmitted?.({ includedDsl: included });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Report a bug"
        description="Opens a prefilled GitHub issue — review it before submitting."
      >
        <div data-testid="report-bug-modal" className="space-y-4">
          <Textarea
            data-testid="report-bug-description"
            aria-label="Describe the bug"
            placeholder="What went wrong? What did you expect to happen?"
            rows={5}
            className="w-full"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {hasDsl && (
            <label className="flex items-center justify-between gap-3 text-[13px] text-ondark-muted">
              <span>
                Include my diagram code{' '}
                <span className="text-ondark-faint">(will be public)</span>
              </span>
              <Switch
                data-testid="report-bug-include-dsl"
                aria-label="Include my diagram code"
                checked={includeDsl}
                onCheckedChange={setIncludeDsl}
              />
            </label>
          )}

          <div
            data-testid="report-bug-summary"
            className="rounded border border-ink-line/50 bg-ink-900/40 p-3 text-[12px] text-ondark-faint space-y-1"
          >
            <p className="font-mono uppercase tracking-[0.12em] text-[10px]">Attached</p>
            <p>
              App version {appVersion} · {view} · {signedIn ? 'signed in' : 'anonymous'}
            </p>
            <p>{hasDsl && includeDsl ? 'Your diagram code (public)' : 'No diagram code'}</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <a
              className="text-[12px] text-ondark-faint hover:text-ondark-muted underline underline-offset-2 rounded ring-draft"
              href={CONTACT_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              No GitHub account? Contact us
            </a>
            <Button
              variant="primary"
              size="md"
              data-testid="report-bug-submit"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Open GitHub issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C web test src/components/feedback/ReportBugModal.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/feedback/ReportBugModal.tsx web/src/components/feedback/ReportBugModal.test.tsx
git commit -m "feat(web/feedback): ReportBugModal — description + public-DSL toggle + GitHub submit"
```

---

## Task 3: `ReportBugButton` FAB

**Files:**
- Create: `web/src/components/feedback/ReportBugButton.tsx`
- Test: `web/src/components/feedback/ReportBugButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/src/components/feedback/ReportBugButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportBugButton } from './ReportBugButton';

const props = {
  appVersion: '2026.6.7',
  view: 'editor',
  signedIn: false,
  dsl: 'A -> B: x',
};

describe('ReportBugButton', () => {
  it('renders a labelled FAB and no modal initially', () => {
    render(<ReportBugButton {...props} />);
    expect(screen.getByTestId('report-bug-fab')).toHaveAttribute('aria-label', 'Report a bug');
    expect(screen.queryByTestId('report-bug-modal')).toBeNull();
  });

  it('opens the modal and fires onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<ReportBugButton {...props} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('report-bug-fab'));
    expect(screen.getByTestId('report-bug-modal')).toBeTruthy();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm -C web test src/components/feedback/ReportBugButton.test.tsx`
Expected: FAIL — cannot resolve `./ReportBugButton`.

- [ ] **Step 3: Write the implementation**

Create `web/src/components/feedback/ReportBugButton.tsx`:

```tsx
import { useState } from 'react';
import { Button, cn } from '../../ui';
import { ReportBugModal } from './ReportBugModal';

export interface ReportBugButtonProps {
  dsl?: string;
  appVersion: string;
  view: string;
  signedIn: boolean;
  onOpen?(): void;
  onSubmitted?(meta: { includedDsl: boolean }): void;
}

function BugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 9V5a3 3 0 0 1 6 0v4" />
      <rect x="8" y="9" width="8" height="10" rx="4" />
      <path d="M3 13h5M16 13h5M4 19l4-2M20 19l-4-2M4 7l4 2M20 7l-4 2" />
    </svg>
  );
}

// Persistent bottom-right FAB. position:fixed, so its DOM position within the app
// tree is irrelevant — only z-index matters (sits below the Dialog overlay z-40).
export function ReportBugButton({
  dsl,
  appVersion,
  view,
  signedIn,
  onOpen,
  onSubmitted,
}: ReportBugButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        size="md"
        data-testid="report-bug-fab"
        aria-label="Report a bug"
        className={cn('fixed bottom-4 right-4 z-30 shadow-pop')}
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
      >
        <BugIcon />
        <span className="hidden md:inline">Report a bug</span>
      </Button>
      <ReportBugModal
        open={open}
        onOpenChange={setOpen}
        dsl={dsl}
        appVersion={appVersion}
        view={view}
        signedIn={signedIn}
        onSubmitted={onSubmitted}
      />
    </>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C web test src/components/feedback/ReportBugButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/feedback/ReportBugButton.tsx web/src/components/feedback/ReportBugButton.test.tsx
git commit -m "feat(web/feedback): ReportBugButton fixed FAB owning the bug-report modal"
```

---

## Task 4: Wire the FAB into AppRoot (hub + editor, not embed)

**Files:**
- Modify: `web/src/app/AppRoot.tsx`

The FAB is rendered in two of AppRoot's three return branches: the **hub** return (`if (isHomeMode) return (…)`) and the **editor** return (the final `return (…)`). The **embed** return is intentionally left untouched.

- [ ] **Step 1: Add the import**

In `web/src/app/AppRoot.tsx`, add this import next to the other component imports (e.g., right after the `HomeView` import line `import { HomeView } from '../components/home/HomeView';`):

```tsx
import { ReportBugButton } from '../components/feedback/ReportBugButton';
```

- [ ] **Step 2: Render the FAB in the hub return**

Find the `<HomeView` element inside the hub-mode return and insert the FAB immediately before it. Replace:

```tsx
        <HomeView
```

with:

```tsx
        <ReportBugButton
          dsl=""
          appVersion={APP_VERSION}
          view="hub"
          signedIn={!!user}
          onOpen={() => track('bug_report_opened', { category: 'feedback', label: 'hub' })}
          onSubmitted={({ includedDsl }) =>
            track('bug_report_submitted', { category: 'feedback', label: 'hub', included_dsl: includedDsl })
          }
        />
        <HomeView
```

- [ ] **Step 3: Render the FAB in the editor return**

At the very end of the file, the editor return closes with this exact sequence:

```tsx
      </div>
    </div>
  );
}
```

Replace it with:

```tsx
      </div>
      <ReportBugButton
        dsl={item?.js ?? ''}
        appVersion={APP_VERSION}
        view="editor"
        signedIn={!!user}
        onOpen={() => track('bug_report_opened', { category: 'feedback', label: 'editor' })}
        onSubmitted={({ includedDsl }) =>
          track('bug_report_submitted', { category: 'feedback', label: 'editor', included_dsl: includedDsl })
        }
      />
    </div>
  );
}
```

(`item`, `user`, `APP_VERSION`, and `track` are all already in scope in this component — confirmed at `AppRoot.tsx` lines 93, 111, 161, and the `APP_VERSION` import.)

- [ ] **Step 4: Typecheck and run the full unit suite**

Run: `pnpm -C web typecheck`
Expected: no errors.

Run: `pnpm -C web test`
Expected: PASS — all existing suites plus the three new feedback suites. (No existing AppRoot test asserts the absence of a FAB, so nothing should break. If `AppRoot.test.tsx` fails because the FAB's modal portal adds DOM, scope the failing query — but expect green.)

- [ ] **Step 5: Commit**

```bash
git add web/src/app/AppRoot.tsx
git commit -m "feat(web/feedback): render Report-a-bug FAB app-wide (hub + editor) with telemetry"
```

---

## Task 5: Bootstrap Storybook

**Files:**
- Modify: `web/package.json`
- Create: `web/.storybook/main.ts`, `web/.storybook/preview.ts`

- [ ] **Step 1: Install Storybook dev dependencies**

Run (from repo root):

```bash
pnpm -C web add -D storybook@latest @storybook/react-vite@latest @storybook/addon-a11y@latest
```

Expected: three packages added to `web/package.json` devDependencies; `web/pnpm-lock.yaml` updated. (`@latest` guarantees the Vite-8-capable release; the lockfile pins the exact version. Both Storybook 9.x and 10.x support Vite 8 and use the same config shape below.)

- [ ] **Step 2: Add Storybook scripts**

In `web/package.json`, add these two entries to `"scripts"` (e.g., after `"preview": "vite preview",`):

```json
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
```

- [ ] **Step 3: Create the Storybook main config**

Create `web/.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite';

// react-vite inherits web/vite.config.ts automatically (Tailwind via postcss,
// path resolution, plugins), so no viteFinal override is needed for these
// components. In SB9+, viewport/controls/actions are part of core — only a11y is
// listed here.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
};

export default config;
```

- [ ] **Step 4: Create the Storybook preview config**

Create `web/.storybook/preview.ts`:

```ts
import type { Preview } from '@storybook/react-vite';
import { createElement, type ReactNode } from 'react';
import '../src/styles/globals.css';

// This UI lives on the dark "ink" chrome surface, so wrap every story in it and
// load the global stylesheet so Drafting Table tokens + fonts resolve.
const preview: Preview = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) =>
      createElement(
        'div',
        {
          className: 'bg-ink-900 text-ondark-strong font-sans',
          style: { minHeight: '100vh', width: '100%', padding: '2rem' },
        },
        createElement(Story as () => ReactNode),
      ),
  ],
};

export default preview;
```

- [ ] **Step 5: Boot Storybook once to confirm the Vite 8 builder starts**

Run: `pnpm -C web storybook`
Expected: Storybook builds and serves on `http://localhost:6006` with no Vite/Rolldown builder error. (There are no stories yet — an empty sidebar is fine. Stop the server with Ctrl-C.)

If the dev server fails to boot due to a missing core package, run `pnpm -C web dlx storybook@latest init --builder vite` to let Storybook reconcile its own packages, then re-apply the minimal `main.ts`/`preview.ts` above and delete any generated example stories under `web/src/stories/`.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/.storybook/main.ts web/.storybook/preview.ts
git commit -m "chore(web): bootstrap Storybook (react-vite) on the dark ink surface"
```

---

## Task 6: Stories for the feedback components

**Files:**
- Create: `web/src/components/feedback/ReportBugButton.stories.tsx`
- Create: `web/src/components/feedback/ReportBugModal.stories.tsx`

- [ ] **Step 1: Write the button stories**

Create `web/src/components/feedback/ReportBugButton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReportBugButton } from './ReportBugButton';

const meta: Meta<typeof ReportBugButton> = {
  title: 'Feedback/ReportBugButton',
  component: ReportBugButton,
  args: {
    appVersion: '2026.6.7',
    view: 'editor',
    signedIn: false,
    dsl: 'Alice -> Bob: Hello',
  },
};
export default meta;

type Story = StoryObj<typeof ReportBugButton>;

// The FAB anchors bottom-right of the canvas. Click it to open the modal.
export const Default: Story = {};
export const Anonymous: Story = { args: { signedIn: false } };
export const SignedIn: Story = { args: { signedIn: true } };
// No active diagram (hub / empty doc): the modal hides the DSL toggle.
export const NoEditorContent: Story = { args: { dsl: '', view: 'hub' } };
```

(The FAB collapses to icon-only below the `md` breakpoint; preview that with Storybook's built-in viewport toolbar — no separate story needed.)

- [ ] **Step 2: Write the modal stories**

Create `web/src/components/feedback/ReportBugModal.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReportBugModal } from './ReportBugModal';

const meta: Meta<typeof ReportBugModal> = {
  title: 'Feedback/ReportBugModal',
  component: ReportBugModal,
  args: {
    open: true,
    onOpenChange: () => {},
    // Don't actually open a tab from a story.
    openUrl: (url: string) => console.log('[story] would open', url),
    appVersion: '2026.6.7',
    view: 'editor',
    signedIn: false,
    dsl: 'Alice -> Bob: Hello\nBob -> Alice: Hi back',
  },
};
export default meta;

type Story = StoryObj<typeof ReportBugModal>;

// Submit is disabled until the user types a description.
export const Empty: Story = {};
// With editor content, the public-DSL toggle defaults ON.
export const WithDsl: Story = {};
// Anonymous vs signed-in changes the attached-summary line.
export const Anonymous: Story = { args: { signedIn: false } };
export const SignedIn: Story = { args: { signedIn: true } };
// No active diagram: the DSL toggle is hidden and the summary says "No diagram code".
export const NoEditorContent: Story = { args: { dsl: '', view: 'hub' } };
```

- [ ] **Step 3: Verify the stories render**

Run: `pnpm -C web storybook`
Expected: the sidebar shows **Feedback/ReportBugButton** (4 stories) and **Feedback/ReportBugModal** (5 stories); each renders against the dark ink background. Stop the server with Ctrl-C.

- [ ] **Step 4: Confirm the unit suite is unaffected by the new files**

Run: `pnpm -C web test`
Expected: PASS (stories are not collected by Vitest; the suite is green).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/feedback/ReportBugButton.stories.tsx web/src/components/feedback/ReportBugModal.stories.tsx
git commit -m "docs(web/feedback): Storybook stories for ReportBugButton + ReportBugModal states"
```

---

## Task 7: E2E journey + milestone screenshot

**Files:**
- Create: `web/e2e/report-bug.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `web/e2e/report-bug.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { seedAndOpen } from './helpers/editor';

test('Report-a-bug FAB opens the modal and builds a prefilled GitHub URL', async ({ page }) => {
  // Capture window.open instead of spawning a real tab. addInitScript must run
  // before navigation, so register it before seedAndOpen (which calls page.goto).
  await page.addInitScript(() => {
    (window as unknown as { __lastOpen?: string }).__lastOpen = undefined;
    window.open = ((url?: string | URL) => {
      (window as unknown as { __lastOpen?: string }).__lastOpen = String(url);
      return null;
    }) as typeof window.open;
  });

  await seedAndOpen(page);

  const fab = page.getByTestId('report-bug-fab');
  await expect(fab).toBeVisible();
  await fab.click();

  const modal = page.getByTestId('report-bug-modal');
  await expect(modal).toBeVisible();

  // Screenshot the open modal for the milestone gallery.
  await page.screenshot({ path: 'test-results/report-bug-modal.png' });

  await page.getByTestId('report-bug-description').fill('Arrows render upside down on page 2');
  const submit = page.getByTestId('report-bug-submit');
  await expect(submit).toBeEnabled();
  await submit.click();

  const opened = await page.evaluate(
    () => (window as unknown as { __lastOpen?: string }).__lastOpen,
  );
  expect(opened).toContain('github.com/ZenUml/web-sequence/issues/new');
  expect(opened).toContain('Arrows');
});
```

- [ ] **Step 2: Confirm the spec is collected (no network needed)**

Run: `pnpm -C web exec playwright test --list e2e/report-bug.spec.ts`
Expected: lists exactly one test — "Report-a-bug FAB opens the modal and builds a prefilled GitHub URL".

- [ ] **Step 3: Run the spec against the dev server**

Run: `pnpm -C web exec playwright test e2e/report-bug.spec.ts`
Expected: PASS (Playwright boots the dev server per `playwright.config.ts`). A screenshot is written to `web/test-results/report-bug-modal.png`.

If the dev server is already running on :3000, Playwright reuses it; otherwise it starts one.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/report-bug.spec.ts
git commit -m "test(web/feedback): e2e — FAB opens modal and builds prefilled GitHub URL"
```

---

## Task 8: Final validation

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm -C web lint`
Expected: no errors in the new files. Fix any reported issues, then re-run.

- [ ] **Step 2: Typecheck**

Run: `pnpm -C web typecheck`
Expected: no errors.

- [ ] **Step 3: Full unit suite**

Run: `pnpm -C web test`
Expected: PASS (all suites, including the three new feedback suites).

- [ ] **Step 4: Production build**

Run: `pnpm -C web build`
Expected: build succeeds. (Confirms the new modules + AppRoot wiring compile under the production Vite pipeline.)

- [ ] **Step 5: Capture the screenshot deliverable**

Confirm `web/test-results/report-bug-modal.png` exists from Task 7. This is the milestone screenshot (per the ≥1-screenshot-per-milestone convention). If it's missing, re-run `pnpm -C web exec playwright test e2e/report-bug.spec.ts`.

- [ ] **Step 6: Final commit (if lint/typecheck required fixes)**

```bash
git add -A web/
git commit -m "chore(web/feedback): lint/typecheck fixups for Report-a-bug"
```

(Skip if Steps 1–4 needed no changes.)

---

## Self-Review

**Spec coverage** — every spec section maps to a task:
- Prefilled GitHub issue destination → Task 1 (`buildIssueUrl`).
- DSL opt-in, default ON, public label → Task 2 (modal toggle + summary).
- FAB, bottom-right, app-wide → Task 3 (FAB) + Task 4 (hub + editor wiring, embed excluded).
- Auto-captured context (version/browser/view/signed-in) → Task 1 body + Task 2 (`navigator.userAgent`) + Task 4 (`view`, `user`, `APP_VERSION`).
- URL 414 length guard / truncation → Task 1 `fitDsl` + truncation test.
- "No GitHub account" fallback → Task 2 Contact-us link.
- Telemetry `bug_report_opened` / `bug_report_submitted{included_dsl}` → Task 4.
- Storybook bootstrap (SB + react-vite + a11y, dark ink decorator, scripts) → Task 5.
- Stories for both components (all states incl. NoEditorContent, anon/signed-in) → Task 6.
- E2E + screenshot → Task 7; lint/typecheck/build/screenshot gate → Task 8.

**Placeholder scan** — no TBD/TODO; every code step shows complete code; every command has expected output.

**Type consistency** — `BuildIssueInput` (Task 1) matches the object passed in Task 2; `ReportBugModalProps` (Task 2) matches usage in Task 3; `ReportBugButtonProps` (Task 3) matches the JSX in Task 4 (`dsl`, `appVersion`, `view`, `signedIn`, `onOpen`, `onSubmitted`). `onSubmitted` payload `{ includedDsl }` is consistent across Tasks 2–4. `openUrl` injectable prop name is consistent across the modal impl, its test, and the stories.

**Out of scope (unchanged from spec):** server-side sink, screenshot attachment to the issue, category/steps fields, feature-request path, `build-storybook` in CI.
