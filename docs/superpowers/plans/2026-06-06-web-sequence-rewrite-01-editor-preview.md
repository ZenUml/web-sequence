# Milestone 01 — Editor + Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read the roadmap first: `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md` (canonical types §3, service interfaces §4, **preview protocol §5**). M00 (foundation) is complete and committed on branch `rewrite/web-foundation`; this milestone builds on it.

**Goal:** Make the new `web/` app a working ZenUML editor: a CodeMirror 6 DSL editor + CSS editor drive an isolated `@zenuml/core` iframe preview via `postMessage`, with live debounced rendering, a console, lazy transpilers, curated themes, snippet toolbox, error display, CSS-only fast path, and fullscreen — reaching parity with the legacy editor/preview per REQ-ED-\*, REQ-PRV-\*, REQ-LAY-1.

**Architecture:** The preview is a **same-origin `srcdoc` iframe**. `previewHtml.getCompleteHtml()` assembles the document: `<style id="zenumlstyle">`, the `@zenuml/core` bundle injected via the M00 Vite **asset-URL shim** (`@zenuml/core/dist/zenuml?url`), and a constant **bootstrap** string that instantiates the engine on `#mounting-point` and speaks a **typed postMessage protocol** (roadmap §5). The DSL is never inlined — it arrives via `render` messages, so the iframe is built once and re-rendered by message (keystroke → debounced `render`; CSS-only → `updateCss`). The editor is CodeMirror 6 via `@uiw/react-codemirror` with **Compartments** for runtime theme/keymap/mode switching. Client state (current item, code, modes, UI toggles) lives in Zustand; pure transforms (snippet insertion, transpiler dispatch, settings→config) are tested in isolation.

**Tech Stack:** React 19, TypeScript (strict), Vite 8, CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/*` + `@codemirror/legacy-modes` + `@replit/codemirror-vim` + `@emmetio/codemirror6-plugin` + `@uiw/codemirror-theme-monokai`), Prettier 3, Zustand, Vitest + RTL, Playwright.

---

## Pre-flight (read once)

- **Working directory:** all commands run from `web/`. Pin the package manager to the dir to avoid cwd drift: **`pnpm -C web <cmd>`** from the repo root, or `cd web` first. Installs MUST use **`pnpm add --ignore-workspace`** (the `web/.npmrc` sets `ignore-workspace=true`; the flag keeps it explicit and avoids the root pnpm-workspace v10/v11 store collision discovered in M00).
- **Branch:** continue on `rewrite/frontend`/`rewrite/web-foundation` (whichever M00 used — do not branch again). Do NOT touch the legacy `src/` or repo-root configs.
- **M00 gives you:** `src/domain/{types,item,plan}.ts`, `src/config/{firebaseConfig,constants}.ts`, `src/app/{runtimeMode,router}.tsx`, `src/services/{firebase,storage,types}.ts`, `src/app/AppRoot.tsx` (two empty regions `data-testid="editor-region"` / `"preview-region"`), the Vite asset-URL shim + 6 proxies, Vitest setup. Reuse the canonical `Item`/`Page`/`Settings`/`DEFAULT_SETTINGS` types verbatim — do not redefine them.

### Critical traps (do NOT port these legacy bugs)

1. **`stickyOffset` comes from the `render` message, NOT `window.location.search`.** The legacy bootstrap reads `new URLSearchParams(window.location.search).get('stickyOffset')`. Our iframe is `srcdoc`, whose location is `about:srcdoc` with **no search params** — that read always yields 0. The host reads `stickyOffset` from the router search params and passes it in `RenderOptions`; the bootstrap uses `msg.options.stickyOffset`. Do not port the `window.location.search` line.
2. **Do NOT run Prettier-with-babel on the DSL editor.** Legacy sets `prettierParser:'babel'` on the DSL editor, but ZenUML DSL is not JavaScript — babel/Prettier would corrupt it. Prettier(css) on the **CSS** editor only. The DSL "format" command is omitted (no-op) in this rewrite.
3. **Unit tests cannot exercise real iframe rendering.** jsdom does not execute `srcdoc` scripts or instantiate `@zenuml/core`. Scope `PreviewFrame`/bootstrap Vitest to **message + string logic only** (builds the srcdoc; posts `render` on `ready`; routes inbound messages to callbacks). The actual render path is proven by the Playwright **dsl-spot-check** + **production-build asset** specs in Task 20 — that is the real verification (same philosophy as M00's "render in a real browser" check). Don't chase a green unit test that proves rendering.
4. **`zenumlLanguage.ts` is a CM6 `StreamLanguage` with token regexes, not a Lezer/ANTLR grammar port.** Lightweight highlighting only; a full grammar mirror of core's ANTLR is out of scope.
5. **Runtime switching needs CM6 Compartments.** `@uiw/react-codemirror` does not reconfigure theme/keymap/language/tabSize for you. Wrap each switchable extension in a `Compartment` and `dispatch` `compartment.reconfigure(...)` (Tasks 14–15).

### Deferred to M04 (recorded, not silently dropped)

- **REQ-ED-6 cheat sheet** modal, **Atomic-CSS settings** modal (edits `cssSettings`), and **REQ-KB-1 shortcuts-help** modal are modals → M04 (modal inventory). Add these to roadmap §9 as a carry-forward in Task 1.
- Consequence (a stated partial, per "surface gaps, don't shrink"): in M01, **ACSS mode renders against whatever `cssSettings` already exist on the item but cannot be edited** until M04. The CSS editor correctly goes read-only in ACSS mode now.

---

## File structure (created across this milestone)

```
web/src/
  preview/
    previewProtocol.ts      # typed HostMessage/FrameMessage + isFrameMessage guard (roadmap §5)
    previewBootstrap.ts     # constant string: in-iframe engine bootstrap + message handler
    previewHtml.ts          # getCompleteHtml() — assembles srcdoc (style + core asset + bootstrap)
    PreviewFrame.tsx        # React iframe host: srcdoc, debounced render, css fast-path, getPng, fullscreen
    Console.tsx             # console panel (logs, count, clear, toggle, eval input)
    transpilers.ts          # computeHtml/computeCss/computeJs — lazy mode transpilers
  editor/
    CodeEditor.tsx          # CM6 wrapper (value/onChange + compartments)
    zenumlLanguage.ts       # StreamLanguage highlight for ZenUML DSL
    themes.ts               # curated theme registry (monokai default)
    keymap.ts               # keybindings (sublime-ish defaults + vim compartment) + commands
    snippets.ts             # 9 DSL snippet strings + addCode() insertion rule
    modes.ts                # JsMode/CssMode/HtmlMode → CM language + transpiler dispatch metadata
  state/
    editorStore.ts          # Zustand: currentItem, code mirror of current page, modes, dirty
    uiStore.ts              # Zustand: panels, console open, fullscreen
  components/
    Layout.tsx              # split (editor | preview) + code sub-pane, persisted sizes
    Sidebar.tsx             # left icon bar: Library / Editor toggle
  test/                     # (existing M00 setup.ts) + new msw/raf helpers as needed
e2e/ (repo root, legacy specs re-pointed in Task 20)
```

---

### Task 1: Install CodeMirror 6 + preview/editor dependencies

**Files:** `web/package.json`, `web/pnpm-lock.yaml`; `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md` (carry-forward note)

- [ ] **Step 1: Install runtime deps** (from repo root)

```bash
pnpm -C web add --ignore-workspace @uiw/react-codemirror @codemirror/state @codemirror/view @codemirror/commands @codemirror/search @codemirror/autocomplete @codemirror/lint @codemirror/language @codemirror/lang-javascript @codemirror/lang-css @codemirror/legacy-modes @replit/codemirror-vim @emmetio/codemirror6-plugin @uiw/codemirror-theme-monokai @uiw/codemirror-themes prettier split.js
```

- [ ] **Step 2: Record the M04 modal deferrals** in roadmap §9

Append to `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md` under "## 9. Adversarial-review carry-forward":
```markdown
- **M04 — editor modals deferred from M01.** REQ-ED-6 cheat sheet, the Atomic-CSS settings modal (edits `cssSettings`), and REQ-KB-1 shortcuts-help modal are built in M04 (modal inventory). Consequence: in M01, ACSS mode renders against existing `cssSettings` but they are not editable until M04 (CSS editor is read-only in ACSS, matching legacy).
```

- [ ] **Step 3: Verify install + commit**

Run: `pnpm -C web typecheck` → no errors (no source changed yet).
```bash
git add web/package.json web/pnpm-lock.yaml docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md
git commit -m "chore(m01): add CodeMirror 6 + preview deps; record M04 modal deferrals"
```

---

### Task 2: Preview protocol types + guard (roadmap §5)

**Files:** Create `web/src/preview/previewProtocol.ts`, Test `web/src/preview/previewProtocol.test.ts`

- [ ] **Step 1: Write the failing test**

`web/src/preview/previewProtocol.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isFrameMessage } from './previewProtocol';

describe('isFrameMessage', () => {
  it('accepts known frame messages', () => {
    expect(isFrameMessage({ type: 'ready' })).toBe(true);
    expect(isFrameMessage({ type: 'codeChange', code: 'A.b' })).toBe(true);
    expect(isFrameMessage({ type: 'png', id: 1, dataUrl: null })).toBe(true);
  });
  it('rejects non-objects and unknown/foreign messages', () => {
    expect(isFrameMessage(null)).toBe(false);
    expect(isFrameMessage('ready')).toBe(false);
    expect(isFrameMessage({ type: 'somethingElse' })).toBe(false);
    expect(isFrameMessage({ noType: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm -C web test src/preview/previewProtocol.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `web/src/preview/previewProtocol.ts`**

```ts
// Typed host<->iframe protocol for the ZenUML preview (roadmap §5).
// The iframe is a same-origin srcdoc; messages are validated by `type`.
export interface RenderOptions {
  enableMultiTheme: false;
  theme: 'theme-default';
  stickyOffset: number; // from the host router search params — NOT window.location inside the iframe
}

// host → iframe
export type HostMessage =
  | { type: 'render'; code: string; options: RenderOptions }
  | { type: 'updateCss'; css: string }
  | { type: 'getPng'; id: number }
  | { type: 'evalConsole'; id: number; expr: string };

// iframe → host
export type FrameMessage =
  | { type: 'ready' }
  | { type: 'rendered' }
  | { type: 'codeChange'; code: string }
  | { type: 'png'; id: number; dataUrl: string | null }
  | { type: 'console'; level: string; args: string[] }
  | { type: 'evalResult'; id: number; ok: boolean; value: string }
  | { type: 'error'; message: string };

const FRAME_TYPES = new Set([
  'ready', 'rendered', 'codeChange', 'png', 'console', 'evalResult', 'error',
]);

export function isFrameMessage(data: unknown): data is FrameMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string' &&
    FRAME_TYPES.has((data as { type: string }).type)
  );
}
```

- [ ] **Step 4: Run** — `pnpm -C web test src/preview/previewProtocol.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/preview/previewProtocol.ts web/src/preview/previewProtocol.test.ts
git commit -m "feat(m01): typed preview postMessage protocol (roadmap §5)"
```

---

### Task 3: Preview bootstrap string (in-iframe engine driver)

**Files:** Create `web/src/preview/previewBootstrap.ts`, Test `web/src/preview/previewBootstrap.test.ts`

> This is a **constant string** injected into the iframe `srcdoc`. It cannot be a module (it runs in the iframe with `window.zenuml` from the injected core bundle). It is the **#1 adversarial-review target** of this milestone (see Task 21). Note trap #1: `stickyOffset` is read from `msg.options.stickyOffset`, never `window.location.search`.

- [ ] **Step 1: Write the failing test** (string-shape only — see trap #3)

`web/src/preview/previewBootstrap.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PREVIEW_BOOTSTRAP } from './previewBootstrap';

describe('PREVIEW_BOOTSTRAP', () => {
  it('instantiates the engine on #mounting-point and posts ready', () => {
    expect(PREVIEW_BOOTSTRAP).toContain("new window.zenuml.default('#mounting-point')");
    expect(PREVIEW_BOOTSTRAP).toContain("type: 'ready'");
  });
  it('renders with the fixed theme and reads stickyOffset from the message, not window.location', () => {
    expect(PREVIEW_BOOTSTRAP).toContain("theme: 'theme-default'");
    expect(PREVIEW_BOOTSTRAP).toContain('msg.options');
    expect(PREVIEW_BOOTSTRAP).not.toContain('window.location.search');
  });
  it('handles updateCss, getPng and evalConsole, and forwards codeChange', () => {
    expect(PREVIEW_BOOTSTRAP).toContain("'updateCss'");
    expect(PREVIEW_BOOTSTRAP).toContain("'getPng'");
    expect(PREVIEW_BOOTSTRAP).toContain("'evalConsole'");
    expect(PREVIEW_BOOTSTRAP).toContain("type: 'codeChange'");
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (module not found).

- [ ] **Step 3: Implement `web/src/preview/previewBootstrap.ts`**

```ts
// Runs INSIDE the srcdoc iframe (plain ES5-ish string, no bundler). Speaks the
// typed protocol in previewProtocol.ts. `window.zenuml` is provided by the
// injected @zenuml/core bundle. stickyOffset comes from the render message
// (the srcdoc iframe has no useful window.location.search — trap #1).
export const PREVIEW_BOOTSTRAP = `
(function () {
  var app = null;
  function post(msg) { parent.postMessage(msg, '*'); }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      try {
        post({ type: 'console', level: level, args: [].slice.call(arguments).map(function (a) {
          try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); }
        }) });
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });

  window.addEventListener('error', function (e) {
    post({ type: 'error', message: String((e && e.message) || e) });
  });

  window.addEventListener('load', function () {
    try {
      app = new window.zenuml.default('#mounting-point');
      post({ type: 'ready' });
    } catch (e) {
      post({ type: 'error', message: String((e && e.message) || e) });
    }
  });

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'render' && app) {
      try {
        app.render(msg.code, {
          enableMultiTheme: false,
          theme: 'theme-default',
          onContentChange: function (code) { post({ type: 'codeChange', code: code }); },
          stickyOffset: Number((msg.options && msg.options.stickyOffset) || 0)
        });
        post({ type: 'rendered' });
      } catch (err) {
        post({ type: 'error', message: String((err && err.message) || err) });
      }
    } else if (msg.type === 'updateCss') {
      var styleEl = document.getElementById('zenumlstyle');
      if (styleEl) styleEl.textContent = msg.css || '';
    } else if (msg.type === 'getPng') {
      (async function () {
        try {
          var dataUrl = app ? await app.getPng() : null;
          post({ type: 'png', id: msg.id, dataUrl: dataUrl });
        } catch (err) {
          post({ type: 'png', id: msg.id, dataUrl: null });
        }
      })();
    } else if (msg.type === 'evalConsole') {
      try {
        /* eslint-disable no-eval */
        var result = eval(msg.expr);
        /* eslint-enable no-eval */
        post({ type: 'evalResult', id: msg.id, ok: true, value: String(result) });
      } catch (err) {
        post({ type: 'evalResult', id: msg.id, ok: false, value: String(err) });
      }
    }
  }, false);
})();
`;
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/preview/previewBootstrap.ts web/src/preview/previewBootstrap.test.ts
git commit -m "feat(m01): in-iframe preview bootstrap (engine mount + typed protocol)"
```

---

### Task 4: Assemble the iframe document (`getCompleteHtml`)

**Files:** Create `web/src/preview/previewHtml.ts`, Test `web/src/preview/previewHtml.test.ts`

> Uses the M00 asset-URL shim import `@zenuml/core/dist/zenuml?url`. This is the import whose **build path** M00 left unproven — Task 20's production-build spec finally exercises it.

- [ ] **Step 1: Write the failing test**

`web/src/preview/previewHtml.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

import { getCompleteHtml, MOUNT_HTML } from './previewHtml';

describe('getCompleteHtml', () => {
  it('includes the zenuml style hook, mount point, core script, and bootstrap', () => {
    const html = getCompleteHtml({ css: '.x{color:red}' });
    expect(html).toContain('<style id="zenumlstyle">');
    expect(html).toContain('.x{color:red}');
    expect(html).toContain('id="mounting-point"');
    expect(html).toContain('<script src="/zenuml-test-url.js"></script>');
    expect(html).toContain("new window.zenuml.default('#mounting-point')");
  });
  it('defaults css to empty and still produces a valid doc', () => {
    const html = getCompleteHtml({});
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain(MOUNT_HTML);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/preview/previewHtml.ts`**

```ts
import zenumlUrl from '@zenuml/core/dist/zenuml?url';
import { PREVIEW_BOOTSTRAP } from './previewBootstrap';

// The fixed ZenUML mount structure (ported from legacy computes.js). The DSL is
// NOT inlined — it arrives via `render` postMessages, so the iframe is built
// once and re-rendered by message.
export const MOUNT_HTML =
  '<main id="demo"><div id="diagram"><div id="mounting-point"><seq-diagram></seq-diagram></div></div></main>';

export interface PreviewParts {
  css?: string;
}

export function getCompleteHtml(parts: PreviewParts): string {
  const css = parts.css ?? '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style id="zenumlstyle">
${css}
</style>
</head>
<body>
${MOUNT_HTML}
<script src="${zenumlUrl}"></script>
<script>
${PREVIEW_BOOTSTRAP}
</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/preview/previewHtml.ts web/src/preview/previewHtml.test.ts
git commit -m "feat(m01): assemble preview srcdoc (style + core asset + bootstrap)"
```

---

### Task 5: PreviewFrame host component

**Files:** Create `web/src/preview/PreviewFrame.tsx`, Test `web/src/preview/PreviewFrame.test.tsx`

> Unit test scope per trap #3: srcdoc is set, `render` is posted after a synthetic `ready`, inbound `codeChange`/`console` are routed to callbacks. No real rendering.

- [ ] **Step 1: Write the failing test**

`web/src/preview/PreviewFrame.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

import { PreviewFrame, type PreviewHandle } from './PreviewFrame';

describe('PreviewFrame', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sets srcdoc with the assembled document', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
    const iframe = container.querySelector('iframe')!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('srcdoc')).toContain('id="mounting-point"');
  });

  it('posts a render message after the iframe reports ready', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={7} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', code: 'A.b', options: expect.objectContaining({ stickyOffset: 7 }) }),
      '*',
    );
  });

  it('routes codeChange and console messages to callbacks', () => {
    const onCodeChange = vi.fn();
    const onConsole = vi.fn();
    const { container } = render(
      <PreviewFrame code="A.b" css="" stickyOffset={0} onCodeChange={onCodeChange} onConsole={onConsole} />,
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'codeChange', code: 'C.d' } }));
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'console', level: 'log', args: ['hi'] } }));
    });
    expect(onCodeChange).toHaveBeenCalledWith('C.d');
    expect(onConsole).toHaveBeenCalledWith({ level: 'log', args: ['hi'] });
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/preview/PreviewFrame.tsx`**

```tsx
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { getCompleteHtml } from './previewHtml';
import { isFrameMessage, type RenderOptions } from './previewProtocol';
import { PREVIEW_DEBOUNCE } from '../config/constants';

export interface PreviewHandle {
  getPng(): Promise<string | null>;
}

export interface PreviewFrameProps {
  code: string;
  css: string;
  stickyOffset: number;
  autoPreview?: boolean;
  onCodeChange?: (code: string) => void;
  onConsole?: (entry: { level: string; args: string[] }) => void;
  onError?: (message: string) => void;
}

export const PreviewFrame = forwardRef<PreviewHandle, PreviewFrameProps>(function PreviewFrame(
  { code, css, stickyOffset, autoPreview = true, onCodeChange, onConsole, onError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pngWaiters = useRef(new Map<number, (v: string | null) => void>());
  const pngId = useRef(0);
  // Build srcdoc once per CSS identity; DSL changes go via postMessage.
  const srcdoc = useMemo(() => getCompleteHtml({ css }), [css]);

  const renderOptions = (): RenderOptions => ({ enableMultiTheme: false, theme: 'theme-default', stickyOffset });

  const post = (msg: unknown) => iframeRef.current?.contentWindow?.postMessage(msg, '*');

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isFrameMessage(e.data)) return;
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          readyRef.current = true;
          post({ type: 'render', code, options: renderOptions() });
          break;
        case 'codeChange': onCodeChange?.(msg.code); break;
        case 'console': onConsole?.({ level: msg.level, args: msg.args }); break;
        case 'error': onError?.(msg.message); break;
        case 'png': {
          const w = pngWaiters.current.get(msg.id);
          if (w) { w(msg.dataUrl); pngWaiters.current.delete(msg.id); }
          break;
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-render on DSL change (only once ready + autoPreview on).
  useEffect(() => {
    if (!readyRef.current || !autoPreview) return;
    const t = setTimeout(() => post({ type: 'render', code, options: renderOptions() }), PREVIEW_DEBOUNCE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stickyOffset, autoPreview]);

  // Rebuilding srcdoc resets readiness; the new doc posts `ready` again.
  useEffect(() => { readyRef.current = false; }, [srcdoc]);

  useImperativeHandle(ref, () => ({
    getPng() {
      return new Promise((resolve) => {
        const id = ++pngId.current;
        pngWaiters.current.set(id, resolve);
        post({ type: 'getPng', id });
        setTimeout(() => { if (pngWaiters.current.delete(id)) resolve(null); }, 5000);
      });
    },
  }));

  return (
    <iframe
      ref={iframeRef}
      data-testid="preview-iframe"
      title="ZenUML preview"
      srcDoc={srcdoc}
      className="h-full w-full border-0"
      allowFullScreen
    />
  );
});
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/preview/PreviewFrame.tsx web/src/preview/PreviewFrame.test.tsx
git commit -m "feat(m01): PreviewFrame host — srcdoc, debounced render, getPng, message routing"
```

---

### Task 6: CodeMirror 6 editor wrapper

**Files:** Create `web/src/editor/CodeEditor.tsx`, Test `web/src/editor/CodeEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/src/editor/CodeEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeEditor } from './CodeEditor';

describe('CodeEditor', () => {
  it('renders the initial value', () => {
    render(<CodeEditor value="A.method()" language="dsl" onChange={() => {}} testId="dsl-editor" />);
    expect(screen.getByTestId('dsl-editor')).toBeInTheDocument();
    expect(screen.getByText(/A\.method/)).toBeInTheDocument();
  });
  it('fires onChange when the user types', async () => {
    const onChange = vi.fn();
    render(<CodeEditor value="" language="dsl" onChange={onChange} testId="dsl-editor" />);
    const area = screen.getByTestId('dsl-editor').querySelector('.cm-content') as HTMLElement;
    await userEvent.click(area);
    await userEvent.keyboard('A');
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/editor/CodeEditor.tsx`**

```tsx
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { forwardRef, useMemo } from 'react';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { languageExtension, type EditorLanguage } from './modes';

export interface CodeEditorProps {
  value: string;
  language: EditorLanguage;       // 'dsl' | 'css' (+ mode variants resolved in modes.ts)
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId?: string;
}

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(function CodeEditor(
  { value, language, onChange, readOnly = false, testId },
  ref,
) {
  const extensions = useMemo(() => [EditorView.lineWrapping, ...languageExtension(language)], [language]);
  return (
    <div data-testid={testId} className="h-full overflow-hidden">
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme={monokai}
        readOnly={readOnly}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: true, bracketMatching: true, closeBrackets: true, highlightActiveLine: true, autocompletion: language !== 'dsl' }}
      />
    </div>
  );
});
```

> `basicSetup.autocompletion: language !== 'dsl'` enforces REQ-ED-3's "autocomplete suppressed for the ZenUML DSL editor by design." Theme/keymap/mode become Compartment-driven in Tasks 14–15; for now monokai is fixed.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/editor/CodeEditor.tsx web/src/editor/CodeEditor.test.tsx web/src/editor/modes.ts
git commit -m "feat(m01): CodeMirror 6 editor wrapper (DSL autocomplete suppressed)"
```

> Note: this task also creates a minimal `modes.ts` (Task 12 expands it). Minimal version:
> ```ts
> // web/src/editor/modes.ts (minimal; expanded in Task 12)
> import { javascript } from '@codemirror/lang-javascript';
> import { css } from '@codemirror/lang-css';
> import type { Extension } from '@codemirror/state';
> export type EditorLanguage = 'dsl' | 'css';
> export function languageExtension(lang: EditorLanguage): Extension[] {
>   return lang === 'css' ? [css()] : [javascript()];
> }
> ```

---

### Task 7: Lightweight ZenUML DSL highlighting

**Files:** Create `web/src/editor/zenumlLanguage.ts`, Test `web/src/editor/zenumlLanguage.test.ts`

> `StreamLanguage` with token regexes (trap #4) — not a grammar port.

- [ ] **Step 1: Write the failing test**

`web/src/editor/zenumlLanguage.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { StreamLanguage } from '@codemirror/language';
import { zenumlStream } from './zenumlLanguage';

function tokenAt(src: string, col: number): string | null {
  const lang = StreamLanguage.define(zenumlStream);
  // exercise the tokenizer directly via the stream parser
  const stream = lang.streamParser;
  const state = stream.startState!();
  const { StringStream } = require('@codemirror/language');
  const ss = new StringStream(src, 2, 2);
  let tok: string | null = null;
  while (!ss.eol()) { const t = stream.token(ss, state); if (ss.pos >= col) { tok = t; break; } }
  return tok;
}

describe('zenumlStream', () => {
  it('flags keywords as keyword tokens', () => {
    expect(tokenAt('if (x) {', 1)).toBe('keyword');
  });
  it('flags comments', () => {
    expect(tokenAt('// note', 1)).toBe('comment');
  });
});
```

> If the direct-`StringStream` harness proves brittle across CM versions, simplify the test to assert `zenumlStream.token` returns `'comment'` for a line starting with `//` and `'keyword'` for `if`/`while`/`return`/`new` via a tiny hand-rolled fake stream. The point is to lock the token categories, not CM internals.

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/editor/zenumlLanguage.ts`**

```ts
import { StreamLanguage, type StreamParser } from '@codemirror/language';

const KEYWORDS = /^(if|else|while|for|par|opt|alt|loop|return|new|try|catch|finally|group)\b/;

// Lightweight ZenUML DSL highlighter (trap #4: regex tokens, not a grammar port).
export const zenumlStream: StreamParser<unknown> = {
  token(stream) {
    if (stream.match(/^\s+/)) return null;
    if (stream.match(/^\/\/.*/)) return 'comment';
    if (stream.match(KEYWORDS)) return 'keyword';
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^->|^-->|^=|^\.|^:/)) return 'operator';
    if (stream.match(/^[A-Za-z_][\w]*(?=\s*\()/)) return 'function';
    if (stream.match(/^[A-Za-z_][\w]*/)) return 'variableName';
    stream.next();
    return null;
  },
};

export const zenumlLanguage = StreamLanguage.define(zenumlStream);
```

- [ ] **Step 4: Run** — PASS. (Adjust the test harness per the Step-1 note if needed.)

- [ ] **Step 5: Commit**
```bash
git add web/src/editor/zenumlLanguage.ts web/src/editor/zenumlLanguage.test.ts
git commit -m "feat(m01): lightweight ZenUML DSL highlighting (CM6 StreamLanguage)"
```

---

### Task 8: Editor store (Zustand)

**Files:** Create `web/src/state/editorStore.ts`, Test `web/src/state/editorStore.test.ts`

> Wraps the M00 pure helpers (`applyPageEdit`, `switchPage`, `addPage`, etc.) — do not reimplement page logic here.

- [ ] **Step 1: Write the failing test**

`web/src/state/editorStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

const sample = (): Item => migrateToPages({
  id: 'i1', title: 'T', js: 'A.b', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '',
});

describe('editorStore', () => {
  beforeEach(() => useEditorStore.getState().reset());
  it('loads an item and exposes current DSL/CSS', () => {
    useEditorStore.getState().loadItem(sample());
    expect(useEditorStore.getState().currentItem?.js).toBe('A.b');
  });
  it('setDsl applies a dual-write edit to the current page', () => {
    useEditorStore.getState().loadItem(sample());
    useEditorStore.getState().setDsl('C.d');
    const it = useEditorStore.getState().currentItem!;
    expect(it.js).toBe('C.d');
    expect(it.pages[0].js).toBe('C.d');
    expect(useEditorStore.getState().dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/state/editorStore.ts`**

```ts
import { create } from 'zustand';
import type { Item, HtmlMode, CssMode, JsMode } from '../domain/types';
import { applyPageEdit, switchPage, addPage, deletePage, migrateToPages } from '../domain/item';

interface EditorState {
  currentItem: Item | null;
  dirty: boolean;
  loadItem(item: Item): void;
  setDsl(js: string): void;
  setCss(css: string): void;
  setJsMode(m: JsMode): void;
  setCssMode(m: CssMode): void;
  setHtmlMode(m: HtmlMode): void;
  addPage(title?: string): void;
  deletePage(pageId: string): void;
  switchPage(pageId: string): void;
  reset(): void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentItem: null,
  dirty: false,
  loadItem: (item) => set({ currentItem: migrateToPages(item), dirty: false }),
  setDsl: (js) => set((s) => s.currentItem
    ? { currentItem: applyPageEdit(s.currentItem, s.currentItem.currentPageId, { js }), dirty: true } : s),
  setCss: (css) => set((s) => s.currentItem
    ? { currentItem: applyPageEdit(s.currentItem, s.currentItem.currentPageId, { css }), dirty: true } : s),
  setJsMode: (jsMode) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, jsMode }, dirty: true } : s),
  setCssMode: (cssMode) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, cssMode }, dirty: true } : s),
  setHtmlMode: (htmlMode) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, htmlMode }, dirty: true } : s),
  addPage: (title) => set((s) => s.currentItem ? { currentItem: addPage(s.currentItem, title), dirty: true } : s),
  deletePage: (pageId) => set((s) => s.currentItem ? { currentItem: deletePage(s.currentItem, pageId), dirty: true } : s),
  switchPage: (pageId) => set((s) => s.currentItem ? { currentItem: switchPage(s.currentItem, pageId) } : s),
  reset: () => set({ currentItem: null, dirty: false }),
}));
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/state/editorStore.ts web/src/state/editorStore.test.ts
git commit -m "feat(m01): editor Zustand store over pure page helpers"
```

---

### Task 9: Wire DSL editor ↔ preview (the tracer bullet)

**Files:** Modify `web/src/app/AppRoot.tsx`, Test `web/src/app/AppRoot.test.tsx` (extend)

> After this task, typing DSL re-renders the diagram (proven end-to-end by Playwright in Task 20). The `codeChange` back-sync writes engine edits back into the editor.

- [ ] **Step 1: Extend the failing shell test**

Append to `web/src/app/AppRoot.test.tsx`:
```tsx
import { vi } from 'vitest';
vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

it('seeds the DSL editor and mounts the preview iframe', async () => {
  const { container } = render(<AppRoot />);
  expect(container.querySelector('[data-testid="dsl-editor"]')).toBeTruthy();
  expect(container.querySelector('[data-testid="preview-iframe"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (no editor/iframe yet).

- [ ] **Step 3: Implement the wiring in `web/src/app/AppRoot.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle } from '../preview/PreviewFrame';
import { useEditorStore } from '../state/editorStore';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

const STARTER: Item = migrateToPages({
  id: 'starter', title: 'Untitled', js: 'A.SyncMessage\nA->B: AsyncMessage', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '',
});

export function AppRoot() {
  const item = useEditorStore((s) => s.currentItem);
  const loadItem = useEditorStore((s) => s.loadItem);
  const setDsl = useEditorStore((s) => s.setDsl);
  const previewRef = useRef<PreviewHandle>(null);

  useEffect(() => { if (!item) loadItem(STARTER); }, [item, loadItem]);
  if (!item) return null;

  return (
    <div className="flex h-full w-full">
      <section data-testid="editor-region" className="w-1/2 border-r border-gray-200" aria-label="Editor">
        <CodeEditor value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" />
      </section>
      <section data-testid="preview-region" className="w-1/2" aria-label="Preview">
        <PreviewFrame ref={previewRef} code={item.js} css={item.css} stickyOffset={0} onCodeChange={setDsl} />
      </section>
    </div>
  );
}
```

> `stickyOffset={0}` for now; Task 10/router integration can thread the real search param later (the protocol already supports it). The legacy starter snippet keeps the tracer meaningful.

- [ ] **Step 4: Run** — `pnpm -C web test src/app/AppRoot.test.tsx` → PASS.

- [ ] **Step 5: Manual end-to-end check**

Run `pnpm -C web dev`, open the served port, type DSL, confirm the diagram updates and there are no console errors (favicon 404 is benign). Stop the server.

- [ ] **Step 6: Commit**
```bash
git add web/src/app/AppRoot.tsx web/src/app/AppRoot.test.tsx
git commit -m "feat(m01): wire DSL editor to preview (live render + codeChange back-sync)"
```

---

### Task 10: Split layout + sidebar icon bar

**Files:** Create `web/src/components/Layout.tsx`, `web/src/components/Sidebar.tsx`, `web/src/state/uiStore.ts`; Test `web/src/state/uiStore.test.ts`; Modify `web/src/app/AppRoot.tsx`

- [ ] **Step 1: Write the failing test (UI store)**

`web/src/state/uiStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState({ activePanel: 'editor', consoleOpen: false, fullscreen: false }));
  it('toggles the active left panel', () => {
    useUiStore.getState().setActivePanel('library');
    expect(useUiStore.getState().activePanel).toBe('library');
  });
  it('toggles console and fullscreen', () => {
    useUiStore.getState().toggleConsole();
    expect(useUiStore.getState().consoleOpen).toBe(true);
    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().fullscreen).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/state/uiStore.ts`**

```ts
import { create } from 'zustand';

export type LeftPanel = 'editor' | 'library';

interface UiState {
  activePanel: LeftPanel;
  consoleOpen: boolean;
  fullscreen: boolean;
  setActivePanel(p: LeftPanel): void;
  toggleConsole(): void;
  toggleFullscreen(): void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'editor',
  consoleOpen: false,
  fullscreen: false,
  setActivePanel: (activePanel) => set({ activePanel }),
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
}));
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Implement `Layout.tsx` (split.js) + `Sidebar.tsx`**

`web/src/components/Layout.tsx`:
```tsx
import Split from 'split.js';
import { useEffect, useRef } from 'react';
import { useEditorStore } from '../state/editorStore';

export function Layout({ editor, preview }: { editor: React.ReactNode; preview: React.ReactNode }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const item = useEditorStore((s) => s.currentItem);
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    const sizes = item?.mainSizes ?? [40, 60];
    const inst = Split([leftRef.current, rightRef.current], {
      sizes, minSize: 240, gutterSize: 6, direction: 'horizontal',
      onDragEnd: (s) => { if (item) item.mainSizes = s; }, // persisted on save in M02
    });
    return () => inst.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex h-full w-full">
      <div ref={leftRef} data-testid="editor-region" aria-label="Editor" className="h-full overflow-hidden">{editor}</div>
      <div ref={rightRef} data-testid="preview-region" aria-label="Preview" className="h-full overflow-hidden">{preview}</div>
    </div>
  );
}
```

`web/src/components/Sidebar.tsx`:
```tsx
import { useUiStore } from '../state/uiStore';

export function Sidebar() {
  const active = useUiStore((s) => s.activePanel);
  const setActive = useUiStore((s) => s.setActivePanel);
  const btn = (panel: 'editor' | 'library', label: string) => (
    <button
      data-testid={`sidebar-${panel}`}
      aria-pressed={active === panel}
      onClick={() => setActive(panel)}
      className={`p-2 rounded ${active === panel ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
    >{label}</button>
  );
  return (
    <nav aria-label="Primary" className="flex flex-col gap-2 bg-gray-900 p-2 border-r border-white/10">
      {btn('editor', 'Editor')}
      {btn('library', 'Library')}
    </nav>
  );
}
```

- [ ] **Step 6: Use Layout + Sidebar in `AppRoot.tsx`** (replace the inline flex split from Task 9 with `<div className="flex h-full"><Sidebar /><Layout editor={...} preview={...} /></div>`; keep the `data-testid`s). Run `pnpm -C web test` → all green.

- [ ] **Step 7: Commit**
```bash
git add web/src/components/Layout.tsx web/src/components/Sidebar.tsx web/src/state/uiStore.ts web/src/state/uiStore.test.ts web/src/app/AppRoot.tsx
git commit -m "feat(m01): split layout + sidebar icon bar (REQ-LAY-1)"
```

---

### Task 11: CSS editor + CSS-only fast path

**Files:** Modify `web/src/app/AppRoot.tsx`, `web/src/preview/PreviewFrame.tsx`; Test extend `web/src/preview/PreviewFrame.test.tsx`

- [ ] **Step 1: Write the failing test (fast path posts updateCss, not a new render)**

Append to `web/src/preview/PreviewFrame.test.tsx`:
```tsx
it('posts updateCss (not a full render) when only css changes after ready', () => {
  const { container, rerender } = render(<PreviewFrame code="A.b" css=".a{}" stickyOffset={0} />);
  const iframe = container.querySelector('iframe') as HTMLIFrameElement;
  const post = vi.fn();
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
  act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
  post.mockClear();
  rerender(<PreviewFrame code="A.b" css=".b{}" stickyOffset={0} />);
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'updateCss', css: '.b{}' }), '*');
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (CSS change currently rebuilds srcdoc).

- [ ] **Step 3: Implement the fast path in `PreviewFrame.tsx`**

Change the srcdoc to build from a **ref of the initial css** (so CSS changes don't rebuild the doc), and push CSS via `updateCss`:
```tsx
  // Build srcdoc ONCE from the css present at mount; later css updates use the
  // fast path (REQ-PRV-5) rather than rebuilding the iframe.
  const initialCss = useRef(css);
  const srcdoc = useMemo(() => getCompleteHtml({ css: initialCss.current }), []);

  // CSS-only fast path: patch #zenumlstyle in-place after ready.
  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: 'updateCss', css });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [css]);
```
Remove the earlier `useMemo(... [css])` and the `readyRef reset on [srcdoc]` effect (srcdoc is now stable). Keep the DSL debounced-render effect keyed on `[code, stickyOffset, autoPreview]`.

- [ ] **Step 4: Add the CSS editor to `AppRoot.tsx`**

Below the DSL editor in the editor region, add a second `CodeEditor`:
```tsx
const setCss = useEditorStore((s) => s.setCss);
// ...
<div className="flex flex-col h-full">
  <div className="flex-1 min-h-0"><CodeEditor value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" /></div>
  <div className="flex-1 min-h-0 border-t border-gray-200"><CodeEditor value={item.css} language="css" onChange={setCss} testId="css-editor" readOnly={item.cssMode === 'acss'} /></div>
</div>
```

- [ ] **Step 5: Run** — `pnpm -C web test` → all green.

- [ ] **Step 6: Commit**
```bash
git add web/src/preview/PreviewFrame.tsx web/src/preview/PreviewFrame.test.tsx web/src/app/AppRoot.tsx
git commit -m "feat(m01): CSS editor + CSS-only fast path (REQ-PRV-5)"
```

---

### Task 12: Mode metadata + lazy transpilers

**Files:** Expand `web/src/editor/modes.ts`; Create `web/src/preview/transpilers.ts`, Test `web/src/preview/transpilers.test.ts`

> Replace legacy `loadJS` script injection with npm deps + dynamic `import()` (REQ-PRV-4). Test the **dispatch/mapping** with mocked transpilers (trap #3 — don't load real Babel in jsdom).

- [ ] **Step 1: Write the failing test**

`web/src/preview/transpilers.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { computeCss, computeJs } from './transpilers';

describe('computeCss', () => {
  it('passes plain CSS through unchanged', async () => {
    expect(await computeCss('.a{color:red}', 'css', undefined)).toEqual({ code: '.a{color:red}' });
  });
  it('returns empty for ACSS when no settings present', async () => {
    const r = await computeCss('<div class="D(b)">', 'acss', undefined);
    expect(r.code).toBe('');
  });
});

describe('computeJs', () => {
  it('passes plain JS/DSL through (no transpile for js mode)', async () => {
    expect(await computeJs('A.b', 'js')).toEqual({ code: 'A.b' });
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/preview/transpilers.ts`**

```ts
import type { CssMode, JsMode } from '../domain/types';

export interface TranspileResult {
  code: string;
  errors?: { lineNumber: number; message: string }[];
}

// CSS: plain passes through; SCSS/SASS/LESS/Stylus/ACSS lazy-load their compiler.
export async function computeCss(code: string, mode: CssMode, settings: unknown): Promise<TranspileResult> {
  switch (mode) {
    case 'css':
      return { code };
    case 'scss':
    case 'sass': {
      const sass = await import('sass'); // add dep when SCSS support is enabled
      try {
        const out = sass.compileString(code, { syntax: mode === 'sass' ? 'indented' : 'scss' });
        return { code: out.css };
      } catch (e) {
        return { code: '', errors: [{ lineNumber: 0, message: String(e) }] };
      }
    }
    case 'less': {
      const less = (await import('less')).default;
      try { return { code: (await less.render(code)).css }; }
      catch (e) { return { code: '', errors: [{ lineNumber: 0, message: String(e) }] }; }
    }
    case 'stylus': {
      const stylus = (await import('stylus')).default;
      return await new Promise((resolve) =>
        stylus(code).render((err: Error | null, out: string) =>
          resolve(err ? { code: '', errors: [{ lineNumber: 0, message: String(err) }] } : { code: out })));
    }
    case 'acss': {
      const s = settings as { acssConfig?: string } | undefined;
      if (!s?.acssConfig) return { code: '' };
      const atomizer = (await import('atomizer')).default;
      const found = atomizer.findClassNames(code);
      const config = atomizer.getConfig(found, JSON.parse(s.acssConfig));
      return { code: atomizer.getCss(config) };
    }
    default:
      return { code };
  }
}

// JS/DSL: 'js' passes through (ZenUML DSL is sent as-is). ES6/TS/Coffee transpile.
export async function computeJs(code: string, mode: JsMode): Promise<TranspileResult> {
  switch (mode) {
    case 'js':
      return { code };
    case 'es6': {
      const Babel = await import('@babel/standalone');
      return { code: Babel.transform(code, { presets: ['env'] }).code ?? '' };
    }
    case 'typescript': {
      const ts = (await import('typescript')).default;
      return { code: ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ES2015 } }).outputText };
    }
    case 'coffeescript': {
      const coffee = (await import('coffeescript')).default;
      return { code: coffee.compile(code) };
    }
    default:
      return { code };
  }
}
```

> Transpiler libs (`sass`, `less`, `stylus`, `atomizer`, `@babel/standalone`, `typescript`, `coffeescript`) are added to `package.json` only as the corresponding mode is wired (YAGNI). For M01, the tested paths are `css`/`js`/`acss(no-settings)`; the others are dynamically imported and proven when their mode is exercised. If a dep is not yet installed, guard with a try/catch returning `{ code, errors:[…'transpiler unavailable'] }` so the build never breaks — **and `log`/surface that the mode is pending** (do not silently swallow).

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add web/src/preview/transpilers.ts web/src/preview/transpilers.test.ts web/src/editor/modes.ts
git commit -m "feat(m01): lazy transpiler dispatch (REQ-PRV-4, REQ-ED-2)"
```

---

### Task 13: Mode switching UI + ACSS read-only

**Files:** Modify `web/src/app/AppRoot.tsx` (mode selectors), `web/src/editor/modes.ts` (Compartment language switch); Test extend `editorStore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `web/src/state/editorStore.test.ts`:
```ts
it('switching to acss marks css editor read-only via cssMode', () => {
  useEditorStore.getState().loadItem(sample());
  useEditorStore.getState().setCssMode('acss');
  expect(useEditorStore.getState().currentItem!.cssMode).toBe('acss');
});
it('css mode feeds the preview css pipeline (computeCss handles acss from html)', () => {
  // documents intent: ACSS computes from item.html, not item.css (see transpilers.ts)
  expect(true).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure** — the first assertion fails only if `setCssMode` is missing (it exists from Task 8); if both pass immediately, that is acceptable — proceed to wire UI.

- [ ] **Step 3: Add mode `<select>`s in `AppRoot.tsx`** above each editor, bound to `setJsMode`/`setCssMode`, options from the canonical unions. The CSS editor's `readOnly` is already `item.cssMode === 'acss'` (Task 11). Feed the preview from transpiled output:
```tsx
// derive rendered css from the mode pipeline (debounced in PreviewFrame already)
// minimal: pass item.css for 'css', else compute on change and store in local state.
```
Keep it minimal: for `css` mode pass `item.css` directly; for other modes, compute via `computeCss` in an effect and pass the result to `PreviewFrame`. Document that full transpiled-mode E2E is covered when those modes are used.

- [ ] **Step 4: Run** — `pnpm -C web test` → green. Manual: switch CSS mode to Atomic CSS, confirm the CSS editor becomes read-only.

- [ ] **Step 5: Commit**
```bash
git add web/src/app/AppRoot.tsx web/src/editor/modes.ts web/src/state/editorStore.test.ts
git commit -m "feat(m01): language mode switching + ACSS read-only (REQ-ED-2)"
```

---

### Task 14: Curated themes + font/size + Compartment switching

**Files:** Create `web/src/editor/themes.ts`, Test `web/src/editor/themes.test.ts`; Modify `web/src/editor/CodeEditor.tsx`

> Curated subset, monokai default (REQ-ED-4). Theme/font/size switch at runtime via a **Compartment** (trap #5).

- [ ] **Step 1: Write the failing test**

`web/src/editor/themes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { THEMES, DEFAULT_THEME, resolveTheme } from './themes';

describe('themes', () => {
  it('exposes a curated set with monokai default', () => {
    expect(DEFAULT_THEME).toBe('monokai');
    expect(THEMES.map((t) => t.id)).toContain('monokai');
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    expect(THEMES.length).toBeLessThanOrEqual(12); // curated, not all 47
  });
  it('resolveTheme falls back to monokai for unknown ids', () => {
    expect(resolveTheme('does-not-exist')).toBe(resolveTheme('monokai'));
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/editor/themes.ts`**

```ts
import type { Extension } from '@codemirror/state';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubLight } from '@uiw/codemirror-theme-github';
import { solarizedLight } from '@uiw/codemirror-theme-solarized';

export interface ThemeDef { id: string; label: string; extension: Extension; }

export const THEMES: ThemeDef[] = [
  { id: 'monokai', label: 'Monokai', extension: monokai },
  { id: 'dracula', label: 'Dracula', extension: dracula },
  { id: 'github-light', label: 'GitHub Light', extension: githubLight },
  { id: 'solarized-light', label: 'Solarized Light', extension: solarizedLight },
];

export const DEFAULT_THEME = 'monokai';

export function resolveTheme(id: string): Extension {
  return (THEMES.find((t) => t.id === id) ?? THEMES[0]).extension;
}
```

> Install the extra theme packages: `pnpm -C web add --ignore-workspace @uiw/codemirror-theme-dracula @uiw/codemirror-theme-github @uiw/codemirror-theme-solarized`.

- [ ] **Step 4: Convert `CodeEditor.tsx` to Compartment-based theme** (so theme changes don't remount):
```tsx
import { Compartment } from '@codemirror/state';
// inside the component:
const themeCompartment = useRef(new Compartment());
// extensions: [...prev, themeCompartment.current.of(resolveTheme(themeId)), fontTheme(fontFamily, fontSize)]
// on themeId change: view.dispatch({ effects: themeCompartment.current.reconfigure(resolveTheme(themeId)) })
```
Add a `fontTheme(family, size)` helper using `EditorView.theme({ '&': { fontSize: size+'px' }, '.cm-content': { fontFamily: family } })`. Accept `themeId`, `fontFamily`, `fontSize` props (defaults from `DEFAULT_SETTINGS`).

- [ ] **Step 5: Run** — green.

- [ ] **Step 6: Commit**
```bash
git add web/src/editor/themes.ts web/src/editor/themes.test.ts web/src/editor/CodeEditor.tsx web/package.json web/pnpm-lock.yaml
git commit -m "feat(m01): curated editor themes + font/size via Compartment (REQ-ED-4)"
```

---

### Task 15: Keymap, find/replace, comment/indent, Prettier(css), Emmet(css), Vim

**Files:** Create `web/src/editor/keymap.ts`, Test `web/src/editor/keymap.test.ts`; Modify `web/src/editor/CodeEditor.tsx`

> Bindings per §11 with modern key identifiers (REQ-KB-2). Vim via a Compartment (trap #5). Prettier(css) + Emmet(css) **only** — never babel-Prettier on the DSL (trap #2).

- [ ] **Step 1: Write the failing test** (pure binding table)

`web/src/editor/keymap.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { editorKeymap, formatCss } from './keymap';

describe('editorKeymap', () => {
  it('binds the spec shortcuts with modern key identifiers', () => {
    const keys = editorKeymap.map((k) => k.key);
    expect(keys).toContain('Mod-f');      // find
    expect(keys).toContain('Mod-/');      // toggle comment
    expect(keys).toContain('Mod-]');      // indent more
    expect(keys).toContain('Mod-[');      // indent less
    expect(keys).toContain('Mod-Alt-f');  // find & replace
  });
});

describe('formatCss', () => {
  it('formats CSS with prettier', async () => {
    expect((await formatCss('.a{color:red}')).trim()).toBe('.a {\n  color: red;\n}'.trim());
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/editor/keymap.ts`**

```ts
import { openSearchPanel, findNext, findPrevious, replaceAll } from '@codemirror/search';
import { toggleComment, indentMore, indentLess } from '@codemirror/commands';
import type { KeyBinding } from '@codemirror/view';
import * as prettier from 'prettier/standalone';
import cssPlugin from 'prettier/plugins/postcss';

export const editorKeymap: KeyBinding[] = [
  { key: 'Mod-f', run: openSearchPanel },
  { key: 'Mod-g', run: findNext },
  { key: 'Mod-Shift-g', run: findPrevious },
  { key: 'Mod-Alt-f', run: (v) => { openSearchPanel(v); return true; } }, // find & replace panel
  { key: 'Mod-/', run: toggleComment },
  { key: 'Mod-]', run: indentMore },
  { key: 'Mod-[', run: indentLess },
];

export async function formatCss(code: string): Promise<string> {
  return prettier.format(code, { parser: 'css', plugins: [cssPlugin] });
}
```

> `replaceAll` imported to keep the search module tree-shake-stable; the dedicated replace UI is CM's search panel (Mod-Alt-f opens it). The DSL editor gets NO Prettier command (trap #2).

- [ ] **Step 4: Wire into `CodeEditor.tsx`**: add `keymap.of([...editorKeymap, ...defaultKeymap])` to extensions; add a `vimCompartment` that holds `vim()` from `@replit/codemirror-vim` when `keymap === 'vim'` else `[]`; expose a Prettier-format command only when `language === 'css'` (e.g. a small format button or `Ctrl-Shift-f` binding that calls `formatCss` and sets the value). Run `pnpm -C web test`.

- [ ] **Step 5: Commit**
```bash
git add web/src/editor/keymap.ts web/src/editor/keymap.test.ts web/src/editor/CodeEditor.tsx
git commit -m "feat(m01): editor keymap, find/replace, Prettier(css), Emmet(css), Vim (§11, REQ-KB-2)"
```

---

### Task 16: Snippet toolbox

**Files:** Create `web/src/editor/snippets.ts`, Test `web/src/editor/snippets.test.ts`; Create `web/src/components/Toolbox.tsx`; Modify `web/src/app/AppRoot.tsx`

> Exact 9 snippet strings + the legacy `addCode` rule (new participant is prepended after leading comments; others appended). Ported from `src/services/code_service.js` + `src/components/Toolbox.jsx`.

- [ ] **Step 1: Write the failing test**

`web/src/editor/snippets.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SNIPPETS, addCode, NEW_PARTICIPANT } from './snippets';

describe('SNIPPETS', () => {
  it('contains the 9 DSL snippets with exact payloads', () => {
    const byId = Object.fromEntries(SNIPPETS.map((s) => [s.id, s.code]));
    expect(byId.participant).toBe('NewParticipant');
    expect(byId.async).toBe('A->B:message');
    expect(byId.sync).toBe('A.message {\n}');
    expect(byId.return).toBe('result = A.message {\n}');
    expect(byId.self).toBe('A.message() {\n  selfMessage()\n}');
    expect(byId.instance).toBe('a = new A()');
    expect(byId.if).toBe('if(condition) {\n  A.method()\n}');
    expect(byId.while).toBe('while(condition) {\n  A.method()\n}');
    expect(byId.comment).toBe('//Note\nA.message()');
  });
});

describe('addCode', () => {
  it('appends a normal snippet on a new line', () => {
    expect(addCode('A.b', 'a = new A()')).toBe('A.b\na = new A()');
  });
  it('prepends NewParticipant after leading comments', () => {
    expect(addCode('// title\nA.b', NEW_PARTICIPANT)).toBe('// title\nNewParticipant\nA.b');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/editor/snippets.ts`**

```ts
export const NEW_PARTICIPANT = 'NewParticipant';

export interface Snippet { id: string; label: string; code: string; }

export const SNIPPETS: Snippet[] = [
  { id: 'participant', label: 'New participant', code: NEW_PARTICIPANT },
  { id: 'async', label: 'Async message', code: 'A->B:message' },
  { id: 'sync', label: 'Sync message', code: 'A.message {\n}' },
  { id: 'return', label: 'Return value', code: 'result = A.message {\n}' },
  { id: 'self', label: 'Self message', code: 'A.message() {\n  selfMessage()\n}' },
  { id: 'instance', label: 'New instance', code: 'a = new A()' },
  { id: 'if', label: 'Conditional', code: 'if(condition) {\n  A.method()\n}' },
  { id: 'while', label: 'Loop', code: 'while(condition) {\n  A.method()\n}' },
  { id: 'comment', label: 'Comment + message', code: '//Note\nA.message()' },
];

const isComment = (line: string) => line.trimStart().startsWith('//');
const isEmpty = (s: string) => s.trim().length === 0;

// Ported from legacy code_service.addCode: NewParticipant is inserted after any
// leading comment block; every other snippet is appended on a new line.
export function addCode(code: string, snippet: string): string {
  if (isEmpty(code)) return snippet;
  if (snippet === NEW_PARTICIPANT) {
    const lines = code.split('\n');
    let i = 0;
    while (i < lines.length && (isEmpty(lines[i]) || isComment(lines[i]))) i++;
    return [...lines.slice(0, i), NEW_PARTICIPANT, ...lines.slice(i)].join('\n');
  }
  return `${code}\n${snippet}`;
}
```

> Edge note vs legacy: legacy `addCode` `ensure()`s non-empty `code`; here empty `code` returns the snippet directly (safer, no throw). The leading-comment scan also skips blank lines, matching `until(!isEmpty && !isComment)`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Implement `Toolbox.tsx`** (buttons calling `onInsert(addCode(current, snippet.code))`) and wire into `AppRoot.tsx` (hidden on small screens via `hidden md:flex`). Use `data-testid={`snippet-${id}`}`. Run `pnpm -C web test`.

- [ ] **Step 6: Commit**
```bash
git add web/src/editor/snippets.ts web/src/editor/snippets.test.ts web/src/components/Toolbox.tsx web/src/app/AppRoot.tsx
git commit -m "feat(m01): snippet toolbox with exact DSL snippets + addCode rule (REQ-ED-5)"
```

---

### Task 17: Inline error display

**Files:** Modify `web/src/editor/CodeEditor.tsx` (lint gutter), `web/src/app/AppRoot.tsx` (collect errors); Test `web/src/editor/CodeEditor.test.tsx` (extend)

> CM6 `lint`/`linter` diagnostics replace the legacy `error-gutter` DOM markers (REQ-ED-7). Errors come from the transpiler results (`TranspileResult.errors`) and from preview `error` messages.

- [ ] **Step 1: Write the failing test**

Append to `web/src/editor/CodeEditor.test.tsx`:
```tsx
it('renders a lint diagnostic gutter marker for provided errors', async () => {
  const { container } = render(
    <CodeEditor value={'A.b\nbad'} language="css" onChange={() => {}} testId="css-editor"
      diagnostics={[{ lineNumber: 1, message: 'boom' }]} />,
  );
  // CM renders lint markers asynchronously; assert the lint gutter exists
  await Promise.resolve();
  expect(container.querySelector('.cm-gutter.cm-lint-marker, .cm-lintRange, .cm-gutters')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (no `diagnostics` prop).

- [ ] **Step 3: Implement** a `diagnostics?: {lineNumber:number;message:string}[]` prop on `CodeEditor`, mapped through `@codemirror/lint`'s `linter()` + `lintGutter()` in a Compartment that re-reports when `diagnostics` changes (convert lineNumber → document position via `view.state.doc.line(lineNumber+1)`). In `AppRoot.tsx`, hold the latest transpile/preview errors per language in local state and pass them down.

- [ ] **Step 4: Run** — green.

- [ ] **Step 5: Commit**
```bash
git add web/src/editor/CodeEditor.tsx web/src/editor/CodeEditor.test.tsx web/src/app/AppRoot.tsx
git commit -m "feat(m01): inline error display via CM6 lint gutter (REQ-ED-7)"
```

---

### Task 18: Console panel

**Files:** Create `web/src/preview/Console.tsx`, Test `web/src/preview/Console.test.tsx`; Modify `web/src/app/AppRoot.tsx`

> Logs arrive via the typed `console` messages already routed by `PreviewFrame.onConsole` (a real improvement over the dead legacy screenlog path). Count, clear (Ctrl+L), toggle (double-click header), eval input → `evalConsole`/`evalResult`, `preserveConsoleLogs`.

- [ ] **Step 1: Write the failing test**

`web/src/preview/Console.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Console } from './Console';

describe('Console', () => {
  it('shows the log count and entries', () => {
    render(<Console open entries={[{ level: 'log', args: ['hello'] }]} onClear={() => {}} onEval={() => {}} onToggle={() => {}} />);
    expect(screen.getByTestId('console-count')).toHaveTextContent('1');
    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });
  it('clear button calls onClear; eval submits on Enter', async () => {
    const onClear = vi.fn(); const onEval = vi.fn();
    render(<Console open entries={[]} onClear={onClear} onEval={onEval} onToggle={() => {}} />);
    await userEvent.click(screen.getByTestId('console-clear'));
    expect(onClear).toHaveBeenCalled();
    await userEvent.type(screen.getByTestId('console-eval'), '1+1{enter}');
    expect(onEval).toHaveBeenCalledWith('1+1');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement `web/src/preview/Console.tsx`**

```tsx
import { useState } from 'react';

export interface ConsoleEntry { level: string; args: string[]; }
export interface ConsoleProps {
  open: boolean;
  entries: ConsoleEntry[];
  onClear(): void;
  onEval(expr: string): void;
  onToggle(): void;
}

export function Console({ open, entries, onClear, onEval, onToggle }: ConsoleProps) {
  const [expr, setExpr] = useState('');
  return (
    <div data-testid="console" className={`border-t border-white/10 bg-black text-gray-200 ${open ? '' : 'h-8 overflow-hidden'}`}>
      <div className="flex items-center justify-between px-2 py-1 cursor-pointer select-none" onDoubleClick={onToggle}>
        <span>Console (<span data-testid="console-count">{entries.length}</span>)</span>
        <button data-testid="console-clear" onClick={onClear} className="text-xs text-gray-400 hover:text-white">Clear</button>
      </div>
      {open && (
        <>
          <div className="max-h-40 overflow-auto px-2 font-mono text-xs">
            {entries.map((e, i) => (<div key={i} className={e.level === 'error' ? 'text-red-400' : ''}>{e.args.join(' ')}</div>))}
          </div>
          <input
            data-testid="console-eval"
            value={expr}
            onChange={(ev) => setExpr(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' && expr.trim()) { onEval(expr); setExpr(''); } }}
            placeholder="Evaluate expression…"
            className="w-full bg-transparent px-2 py-1 font-mono text-xs outline-none border-t border-white/10"
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `AppRoot.tsx`**: keep a `ConsoleEntry[]` in local state appended from `PreviewFrame.onConsole`; `preserveConsoleLogs` (from settings, default true) decides whether to clear on each render start; Ctrl+L clears; double-click toggles via `uiStore.toggleConsole`; eval input calls a `PreviewFrame` `evalConsole` method (add an imperative `evalConsole(expr)` to `PreviewHandle` mirroring `getPng`, resolving on `evalResult`). Run `pnpm -C web test`.

- [ ] **Step 5: Commit**
```bash
git add web/src/preview/Console.tsx web/src/preview/Console.test.tsx web/src/preview/PreviewFrame.tsx web/src/app/AppRoot.tsx
git commit -m "feat(m01): console panel (logs, count, clear, eval) (REQ-PRV-6)"
```

---

### Task 19: Fullscreen present mode

**Files:** Modify `web/src/app/AppRoot.tsx` / `web/src/components/Layout.tsx`; Test `web/src/state/uiStore.test.ts` already covers the toggle

- [ ] **Step 1: Implement** a fullscreen button on the preview region that calls `uiStore.toggleFullscreen()`, and when `fullscreen` is true expands the preview region to fill the viewport (`fixed inset-0 z-50`) with an exit control. Use `data-testid="preview-fullscreen"`.

- [ ] **Step 2: Add a focused RTL test** in `web/src/app/AppRoot.test.tsx`:
```tsx
it('fullscreen button toggles the fullscreen ui state', async () => {
  const { getByTestId } = render(<AppRoot />);
  const { useUiStore } = await import('../state/uiStore');
  await userEvent.click(getByTestId('preview-fullscreen'));
  expect(useUiStore.getState().fullscreen).toBe(true);
});
```
(Import `userEvent` at top of the test file if not already.)

- [ ] **Step 3: Run** — green.

- [ ] **Step 4: Commit**
```bash
git add web/src/app/AppRoot.tsx web/src/components/Layout.tsx web/src/app/AppRoot.test.tsx
git commit -m "feat(m01): fullscreen present mode (REQ-PRV-7)"
```

---

### Task 20: Re-green E2E — smoke, dsl-spot-check, production-build asset

**Files:** Modify `playwright.config.js` (point at `web/`), `e2e/tests/*.spec.js` (selectors → `data-testid`); Create `web/e2e/` specs if a clean split is preferred (decide during execution — keep ONE Playwright project pointed at the new app)

> This is the **real** render verification (trap #3). The production-build asset spec finally exercises the M00 shim **build path** — the thing M00 explicitly deferred.

- [ ] **Step 1: Point Playwright at the new app**

Update `playwright.config.js` `webServer` to boot the new app: `command: 'pnpm -C web dev'`, `url: 'http://localhost:3000'` (or the port it binds). Keep chromium project.

- [ ] **Step 2: Update `smoke.spec.js`** to target the new DOM: assert `[data-testid="dsl-editor"]` and `[data-testid="preview-iframe"]` are visible, and the iframe's `#mounting-point` exists. Run: `pnpm -C web exec playwright test smoke --project=chromium` (install browsers first if needed: `pnpm -C web exec playwright install chromium`). Expected: PASS.

- [ ] **Step 3: Update `dsl-spot-check.spec.js`** to type DSL into the CM6 editor (`.cm-content`) and assert the iframe renders a `<seq-diagram>` / SVG inside `#mounting-point`. This proves the full editor→postMessage→`@zenuml/core` path. Expected: PASS.

- [ ] **Step 4: Production-build asset spec (the M00 shim build-path proof)**

Add/point a spec that runs against `pnpm -C web build` output (`web/dist`): serve `web/dist`, load it, and assert (a) a hashed `assets/zenuml-*.js` exists, (b) the diagram renders from the built bundle (no `/@fs/` URL, no 404 for the core asset). Run: build, then the spec. Expected: PASS — this is the assertion M00 could only stub.

- [ ] **Step 5: Full gate**

Run: `pnpm -C web typecheck && pnpm -C web test && pnpm -C web build`. All green. Run the Playwright suite green.

- [ ] **Step 6: Commit**
```bash
git add playwright.config.js e2e web/e2e 2>/dev/null; git add -A
git commit -m "test(m01): re-green smoke + dsl-spot-check + production-build asset E2E against web/"
```

---

### Task 21: Adversarial review of the integration-risk surfaces

**Files:** none (review + fix)

> Per the M00 pattern (and the user's standing instruction to adversarially review complex steps), run an independent review **before** declaring M01 done. The author-blind bugs hide at the integration seams.

- [ ] **Step 1: Dispatch independent reviewers** (parallel) over, each against ground truth (legacy `src/` + the specs):
  1. `previewBootstrap.ts` + `previewHtml.ts` — protocol correctness, `srcdoc` same-origin assumptions, `stickyOffset` from message (trap #1), console capture recursion, eval safety, getPng race; **does the assembled doc actually drive `@zenuml/core`?**
  2. `PreviewFrame.tsx` — ready/render ordering, debounce + CSS-fast-path interplay, message `source` filtering, getPng/evalConsole timeout cleanup, effect dependency correctness (stale closures on `code`).
  3. `transpilers.ts` + `modes.ts` — lazy `import()` correctness, ACSS (`cssSettings` from `html`), error propagation, missing-dep guards that **surface** (not swallow) pending modes.
  4. `CodeEditor.tsx` Compartment usage (theme/keymap/lang/lint reconfigure without remount), DSL-autocomplete-suppression, no-babel-Prettier-on-DSL (trap #2).

- [ ] **Step 2: Triage findings** — fix real bugs with regression tests (TDD red→green); record any deferred items in roadmap §9.

- [ ] **Step 3: Commit fixes** (one commit per fix, message references the review).

---

## Self-Review (completed during authoring)

**Spec coverage:**
- REQ-ED-1 dual editors → Tasks 6, 11. REQ-ED-2 modes + ACSS → Tasks 12, 13 (settings modal → M04). REQ-ED-3 features (highlight/fold/brackets/active-line/wrap/find/comment/indent/autocomplete-suppressed/emmet/prettier) → Tasks 6, 7, 14, 15. REQ-ED-4 appearance (curated themes/font/size/keymap/indent) → Tasks 14, 15. REQ-ED-5 snippets → Task 16. REQ-ED-7 errors → Task 17. (REQ-ED-6 cheat sheet → M04, recorded.)
- REQ-PRV-1 live debounced preview → Tasks 5, 9. REQ-PRV-2 iframe/postMessage isolation → Tasks 3–5. REQ-PRV-3 render options + stickyOffset → Tasks 2, 3, 5. REQ-PRV-4 lazy transpilers → Task 12. REQ-PRV-5 CSS-only fast path → Task 11. REQ-PRV-6 console → Task 18. REQ-PRV-7 fullscreen → Task 19.
- REQ-LAY-1 split + sidebar → Task 10. §11/REQ-KB-2 shortcuts → Task 15 (shortcuts-help modal → M04, recorded). E2E (smoke/dsl/asset) → Task 20. PNG export path → Tasks 3, 5 (UI button can land with M03 share/export; `getPng` plumbing is here).

**Placeholder scan:** every code step has complete code; the only "install when the mode is wired" deferrals (transpiler libs in Task 12) are explicit YAGNI with a surfaced-not-swallowed guard, not silent gaps.

**Type consistency:** reuses canonical `Item`/`Page`/`HtmlMode`/`CssMode`/`JsMode`/`Settings`/`DEFAULT_SETTINGS` from M00 `domain/types.ts`; protocol `RenderOptions`/`HostMessage`/`FrameMessage` match roadmap §5; `PreviewHandle.getPng` (+ `evalConsole` added in Task 18) consistent across Tasks 5/18; `EditorLanguage`/`languageExtension` consistent across Tasks 6/12; `addCode`/`SNIPPETS`/`NEW_PARTICIPANT` consistent in Task 16.

---

## Done when

- [ ] `pnpm -C web typecheck`, `pnpm -C web test`, `pnpm -C web build` all green.
- [ ] Typing ZenUML DSL renders/updates the diagram in the iframe (Playwright dsl-spot-check green).
- [ ] CSS edits apply via the fast path; mode switching works; ACSS makes the CSS editor read-only.
- [ ] Console shows preview logs + count + clear + eval; fullscreen toggles; snippet toolbox inserts exact snippets; find/replace/comment/indent/Prettier(css)/Emmet(css)/Vim work; curated themes switch at runtime; errors show in the gutter.
- [ ] smoke + dsl-spot-check + production-build asset E2E green against `web/` (the shim build path is finally proven).
- [ ] Adversarial review (Task 21) complete; real findings fixed with regression tests; deferrals recorded in roadmap §9.
- [ ] Legacy `src/` still builds/runs untouched; legacy `yarn test` collection still excludes `web/`.
- [ ] All work committed in small steps.
