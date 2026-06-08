# Milestone 00 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read the roadmap first: `docs/superpowers/plans/2026-06-06-web-sequence-rewrite-roadmap.md` — it defines canonical types/interfaces this plan implements.

**Goal:** Stand up the new React 19 + TypeScript + Vite app as a **self-contained project in `web/`** — branch, scaffold, toolchain, canonical domain types + pure helpers (tested), config/runtime-mode/storage layers, Firebase init, and an app shell that boots at :3000, builds, and passes an asset-shim check. The legacy app in `src/` is left untouched and keeps running.

**Architecture:** The new app lives in its own folder **`web/`** with its own `package.json`, `pnpm-lock.yaml`, `node_modules`, and Vite/TS/Vitest config — fully isolated from the legacy Preact/Jest/Yarn toolchain at the repo root. Conventional Vite layout: `web/index.html` + `web/src/**` + `web/vite.config.ts`. It replicates the build-critical seams (dev **port 3000** + the six function proxies, the **`@zenuml/core` asset-URL shim**). Server state = TanStack Query; client state = Zustand; routing = TanStack Router (single `/` route, typed search params). Tests = Vitest + RTL. **Cutover** (Milestone 05) repoints the production build / Firebase hosting from `src/`→`dist/`→`app/` to `web/`'s output, then retires the legacy app.

**Tech Stack:** React 19, TypeScript (strict), Vite 6, pnpm, TanStack Router/Query, Zustand, Tailwind, Radix, Firebase modular SDK v10+, CodeMirror 6 (added in M01), Vitest + RTL, Playwright.

---

## Pre-flight (read once)

- **Working directory:** Unless a step says otherwise, **all commands in this plan run from the `web/` directory** (after Task 1 creates it). Source paths like `src/foo.ts` mean `web/src/foo.ts`. Git resolves paths relative to the current directory and operates on the whole repo, so running git from `web/` is fine.
- **Package manager: pnpm.** Enable via Corepack (`corepack enable`). The new `web/` project is pnpm-managed; the legacy root project (Yarn) is left as-is until cutover.
- **Isolation:** Do **not** modify the repo-root `package.json`, `vite.config.js`, or `src/` in this milestone. The new app is entirely under `web/`.
- The new `web/vite.config.ts` replicates the legacy shim/proxy behavior (verified in `vite.config.js`) but uses `@vitejs/plugin-react`, a conventional root, and no `react→preact/compat` aliases.

---

### Task 1: Branch, commit specs/plans, create the `web/` project folder

**Files:**
- Create: `web/` (new directory)
- Create: `web/README.md`

> Steps 1–2 run from the **repo root**; Step 3 onward from `web/`.

- [ ] **Step 1: Create the feature branch (from repo root)**

Run:
```bash
git checkout -b rewrite/frontend
```
Expected: `Switched to a new branch 'rewrite/frontend'`

- [ ] **Step 2: Commit the approved specs and plans (from repo root)**

Run:
```bash
git add docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: approved rewrite specs + roadmap/foundation plan"
```

- [ ] **Step 3: Create the new app folder + pointer note**

Run (from repo root):
```bash
mkdir -p web
```
Create `web/README.md`:
```markdown
# web/ — ZenUML web-sequence (rewrite)

The React 19 + TypeScript rewrite of the frontend. Self-contained pnpm project.
The legacy Preact app at the repo root (`src/`) keeps running until cutover
(Milestone 05), when the production build is repointed here. Canonical behavior:
the approved specs in `docs/superpowers/specs/`.
```

- [ ] **Step 4: Commit**

```bash
git add web/README.md
git commit -m "chore: scaffold web/ folder for frontend rewrite"
```

---

### Task 2: Initialize the `web/` pnpm project + toolchain

> All steps run **from `web/`**.

**Files:**
- Create: `web/package.json` (+ `web/pnpm-lock.yaml`, `web/node_modules`)

- [ ] **Step 1: Initialize a fresh package**

Run (from `web/`):
```bash
pnpm init
```
Then set the package basics — edit `web/package.json` so it contains `"type": "module"` and a `name` of `"web-sequence-web"`.

- [ ] **Step 2: Add React + core runtime deps**

Run:
```bash
pnpm add react@^19 react-dom@^19 @tanstack/react-router @tanstack/react-query zustand firebase@^10 @zenuml/core clsx
```

- [ ] **Step 3: Add UI deps**

Run:
```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-radio-group @headlessui/react file-saver
```

- [ ] **Step 4: Add dev tooling (TS, Vite React, Vitest, RTL, Tailwind)**

Run:
```bash
pnpm add -D typescript @types/react @types/react-dom @types/file-saver vite @vitejs/plugin-react vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw tailwindcss@^3 postcss autoprefixer eslint
```

- [ ] **Step 5: Set `web/package.json` scripts**

Edit `web/package.json` `scripts`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "chore: init web/ pnpm project (React 19 + Vite + Vitest)"
```

---

### Task 3: TypeScript + Vite + Tailwind config (all under `web/`)

**Files:**
- Create: `web/tsconfig.json`, `web/tsconfig.node.json`
- Create: `web/vite.config.ts`
- Create: `web/postcss.config.js`, `web/tailwind.config.js`
- Create: `web/src/vite-env.d.ts`
- (Repo-root `vite.config.js`, `.babelrc`, etc. are **left untouched** — they belong to the legacy app.)

- [ ] **Step 1: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`** (preserve shim/proxy/root/build verbatim; swap plugins)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// Resolves `import '@zenuml/core/dist/zenuml?url'` — dev returns /@fs/<abs>,
// build emits a hashed asset (a /@fs/ URL 404s once served statically).
// Verified against the legacy vite.config.js; asset check in Task 14 / M01.
let zenumlShimIsBuild = false;
const zenumlAssetUrlShim = {
  name: 'zenuml-core-asset-url-shim',
  enforce: 'pre' as const,
  configResolved(config: { command: string }) {
    zenumlShimIsBuild = config.command === 'build';
  },
  resolveId(source: string) {
    return source === '@zenuml/core/dist/zenuml?url' ? '\0zenuml-core-asset-url' : null;
  },
  load(this: any, id: string) {
    if (id !== '\0zenuml-core-asset-url') return null;
    const filePath = resolve(__dirname, 'node_modules/@zenuml/core/dist/zenuml.js');
    if (zenumlShimIsBuild) {
      const ref = this.emitFile({ type: 'asset', name: 'zenuml.js', source: readFileSync(filePath) });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    }
    return `export default ${JSON.stringify('/@fs' + filePath)};`;
  },
};

const FN = 'http://127.0.0.1:5002/staging-zenuml-27954/us-central1';
const proxy = (fn: string) => ({ target: FN, changeOrigin: true, rewrite: () => `/${fn}` });

export default defineConfig({
  plugins: [zenumlAssetUrlShim, react()],
  // Conventional layout: root = web/ (this dir), index.html at web/index.html,
  // source under web/src, build output to web/dist. (Differs from the legacy
  // app's root:'src' quirk — this is a clean self-contained project.)
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true, assetsDir: 'assets' },
  define: { __COMMITHASH__: JSON.stringify(getCommitHash()) },
  css: { postcss: './postcss.config.js' },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/create-share': proxy('create_share'),
      '/get-shared-item': proxy('get_shared_item'),
      '/sync-diagram': proxy('sync_diagram'),
      '/authenticate': proxy('authenticate'),
      '/track': proxy('track'),
      '/info': proxy('info'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
} as any);
```
> Note: `test` is the Vitest block (Vitest reads `vite.config.ts`). The `as any` avoids needing the Vitest type merge; replace with the `vitest/config` `defineConfig` import if preferred.

- [ ] **Step 4: Add the commit-hash type**

Create `src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
declare const __COMMITHASH__: string;
declare global {
  interface Window {
    IS_EXTENSION?: boolean;
    zenumlDesktop?: boolean;
  }
}
export {};
```

- [ ] **Step 5: Create Tailwind + PostCSS config (in `web/`)**

Create `web/postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```
Create `web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 6: Commit**

```bash
git add web/tsconfig.json web/tsconfig.node.json web/vite.config.ts web/src/vite-env.d.ts web/postcss.config.js web/tailwind.config.js
git commit -m "chore: TypeScript + Vite React config for web/ (shim + proxies + port 3000)"
```

---

### Task 4: Vitest setup + first passing test

**Files:**
- Create: `src/test/setup.ts`
- Create: `src/test/sanity.test.ts`

- [ ] **Step 1: Create the test setup**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write a sanity test (failing target = harness wiring)**

`src/test/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add src/test/setup.ts src/test/sanity.test.ts
git commit -m "test: wire up Vitest + RTL setup"
```

---

### Task 5: Canonical domain types

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Create `src/domain/types.ts`**

Copy the full type block from the roadmap §3 verbatim (interfaces `Page`, `Item`, `Folder`, `Subscription`, `AppUser`, `Settings`, the `HtmlMode`/`CssMode`/`JsMode`/`PlanType` unions, and `DEFAULT_SETTINGS`).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: canonical domain types"
```

---

### Task 6: Pure item helpers (TDD)

**Files:**
- Create: `src/domain/item.ts`
- Test: `src/domain/item.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/item.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { migrateToPages, applyPageEdit, addPage, deletePage, switchPage } from './item';
import type { Item } from './types';

const base = (over: Partial<Item> = {}): Item => ({
  id: 'i1', title: 'T', js: 'A.b', css: '.x{}', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js',
  pages: [], currentPageId: '', ...over,
});

describe('migrateToPages', () => {
  it('creates a default page from item js/css when pages missing', () => {
    const m = migrateToPages(base({ pages: [], currentPageId: '' }));
    expect(m.pages).toHaveLength(1);
    expect(m.pages[0]).toMatchObject({ title: 'Page 1', js: 'A.b', css: '.x{}', isDefault: true });
    expect(m.currentPageId).toBe(m.pages[0].id);
  });
  it('is a no-op when pages already exist', () => {
    const item = base({ pages: [{ id: 'p1', title: 'P', js: 'x', css: '', isDefault: true }], currentPageId: 'p1' });
    expect(migrateToPages(item)).toEqual(item);
  });
});

describe('applyPageEdit dual-write', () => {
  it('updates the page AND mirrors to item-level js/css for the current page', () => {
    const item = migrateToPages(base());
    const pid = item.currentPageId;
    const next = applyPageEdit(item, pid, { js: 'C.d' });
    expect(next.pages[0].js).toBe('C.d');
    expect(next.js).toBe('C.d'); // mirror (REQ-DM-1)
  });
  it('does not mirror when editing a non-current page', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'Two');           // switches to page 2
    const firstPid = item.pages[0].id;
    const next = applyPageEdit(item, firstPid, { js: 'ZZ' });
    expect(next.pages[0].js).toBe('ZZ');
    expect(next.js).not.toBe('ZZ');        // current is page 2, no mirror
  });
});

describe('addPage', () => {
  it('appends a non-default page and switches to it', () => {
    const item = migrateToPages(base());
    const next = addPage(item);
    expect(next.pages).toHaveLength(2);
    expect(next.pages[1].isDefault).toBeFalsy();
    expect(next.currentPageId).toBe(next.pages[1].id);
  });
});

describe('deletePage', () => {
  it('refuses to delete the only page', () => {
    const item = migrateToPages(base());
    expect(() => deletePage(item, item.currentPageId)).toThrow();
  });
  it('refuses to delete the default page', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'Two');
    const defaultId = item.pages[0].id;
    expect(() => deletePage(item, defaultId)).toThrow();
  });
  it('deletes a non-default page and switches to the default when active was removed', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'Two'); // active = page2
    const page2 = item.currentPageId;
    const next = deletePage(item, page2);
    expect(next.pages).toHaveLength(1);
    expect(next.currentPageId).toBe(next.pages[0].id);
  });
});

describe('switchPage', () => {
  it('sets currentPageId and mirrors that page content to item-level', () => {
    let item = migrateToPages(base());      // page1 js='A.b'
    item = addPage(item, 'Two');            // page2, current
    item = applyPageEdit(item, item.currentPageId, { js: 'PAGE2' });
    const back = switchPage(item, item.pages[0].id);
    expect(back.currentPageId).toBe(item.pages[0].id);
    expect(back.js).toBe('A.b');            // mirror of newly-active page
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/domain/item.test.ts`
Expected: FAIL (module `./item` not found / functions undefined).

- [ ] **Step 3: Implement `src/domain/item.ts`**

```ts
import type { Item, Page } from './types';

let counter = 0;
function genId(prefix = 'p'): string {
  counter += 1;
  return `${prefix}-${counter}-${(counter * 2654435761 % 2 ** 31).toString(36)}`;
}

export function migrateToPages(item: Item): Item {
  if (Array.isArray(item.pages) && item.pages.length > 0) return item;
  const page: Page = { id: genId(), title: 'Page 1', js: item.js ?? '', css: item.css ?? '', isDefault: true };
  return { ...item, pages: [page], currentPageId: page.id };
}

function currentIndex(item: Item): number {
  return item.pages.findIndex((p) => p.id === item.currentPageId);
}

export function applyPageEdit(
  item: Item,
  pageId: string,
  patch: Partial<Pick<Page, 'js' | 'css' | 'title'>>,
): Item {
  const pages = item.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p));
  const next: Item = { ...item, pages };
  if (pageId === item.currentPageId) {
    // Dual-write mirror (REQ-DM-1): item-level js/css track the current page.
    if (patch.js !== undefined) next.js = patch.js;
    if (patch.css !== undefined) next.css = patch.css;
  }
  return next;
}

export function addPage(item: Item, title?: string): Item {
  const migrated = migrateToPages(item);
  const page: Page = {
    id: genId(),
    title: title ?? `Page ${migrated.pages.length + 1}`,
    js: '',
    css: '',
  };
  return switchPage({ ...migrated, pages: [...migrated.pages, page] }, page.id);
}

export function deletePage(item: Item, pageId: string): Item {
  if (item.pages.length <= 1) throw new Error('Cannot delete the last page');
  const target = item.pages.find((p) => p.id === pageId);
  if (!target) throw new Error('Page not found');
  if (target.isDefault) throw new Error('Cannot delete the default page');
  const pages = item.pages.filter((p) => p.id !== pageId);
  const next: Item = { ...item, pages };
  if (item.currentPageId === pageId) {
    return switchPage(next, pages[0].id);
  }
  return next;
}

export function switchPage(item: Item, pageId: string): Item {
  const page = item.pages.find((p) => p.id === pageId);
  if (!page) return item;
  // Mirror newly-active page content to item-level (REQ-DM-1).
  return { ...item, currentPageId: pageId, js: page.js, css: page.css };
}

export { currentIndex };
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/domain/item.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/item.ts src/domain/item.test.ts
git commit -m "feat: pure item/page helpers with dual-write + migration (REQ-DM, REQ-PG)"
```

---

### Task 7: Plan derivation helpers (TDD)

**Files:**
- Create: `src/domain/plan.ts`
- Test: `src/domain/plan.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/plan.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isSubscribed, getPlanType, isPlus, isBasic } from './plan';
import type { Subscription } from './types';

const sub = (over: Partial<Subscription>): Subscription =>
  ({ status: 'active', passthrough: '', ...over } as Subscription);

describe('isSubscribed', () => {
  it('true for active/trialing, false otherwise/null', () => {
    expect(isSubscribed(sub({ status: 'active' }))).toBe(true);
    expect(isSubscribed(sub({ status: 'trialing' }))).toBe(true);
    expect(isSubscribed(sub({ status: 'cancelled' }))).toBe(false);
    expect(isSubscribed(null)).toBe(false);
  });
});

describe('getPlanType', () => {
  it('free when not subscribed', () => {
    expect(getPlanType(null)).toBe('free');
    expect(getPlanType(sub({ status: 'cancelled' }))).toBe('free');
  });
  it('reads planType from JSON passthrough', () => {
    expect(getPlanType(sub({ passthrough: JSON.stringify({ userId: 'u', planType: 'plus-yearly' }) }))).toBe('plus-yearly');
  });
  it('legacy plain-userId passthrough → basic-monthly', () => {
    expect(getPlanType(sub({ passthrough: 'rawUserId123' }))).toBe('basic-monthly');
  });
});

describe('isPlus / isBasic', () => {
  it('match plan family substrings', () => {
    const plus = sub({ passthrough: JSON.stringify({ userId: 'u', planType: 'plus-monthly' }) });
    const basic = sub({ passthrough: JSON.stringify({ userId: 'u', planType: 'basic-yearly' }) });
    expect(isPlus(plus)).toBe(true);
    expect(isBasic(plus)).toBe(false);
    expect(isBasic(basic)).toBe(true);
    expect(isPlus(basic)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/domain/plan.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/domain/plan.ts`**

```ts
import type { PlanType, Subscription } from './types';

function isJson(s: string): boolean {
  try { JSON.parse(s); return true; } catch { return false; }
}

export function isSubscribed(s: Subscription | null | undefined): boolean {
  return !!s && (s.status === 'active' || s.status === 'trialing');
}

export function getPlanType(s: Subscription | null | undefined): PlanType {
  if (!isSubscribed(s)) return 'free';
  const pt = s!.passthrough;
  if (isJson(pt)) {
    const parsed = JSON.parse(pt) as { planType?: PlanType };
    return parsed.planType ?? 'basic-monthly';
  }
  return 'basic-monthly'; // legacy plain-userId passthrough
}

export function isPlus(s: Subscription | null | undefined): boolean {
  return getPlanType(s).includes('plus');
}

export function isBasic(s: Subscription | null | undefined): boolean {
  return getPlanType(s).includes('basic');
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/domain/plan.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/plan.ts src/domain/plan.test.ts
git commit -m "feat: subscription plan-type derivation (REQ-SUB-2)"
```

---

### Task 8: Firebase config by host (TDD)

**Files:**
- Create: `src/config/firebaseConfig.ts`
- Test: `src/config/firebaseConfig.test.ts`

- [ ] **Step 1: Write failing tests**

`src/config/firebaseConfig.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveConfig } from './firebaseConfig';

describe('resolveConfig', () => {
  it('returns prod config for app.zenuml.com (payment on)', () => {
    const c = resolveConfig('app.zenuml.com');
    expect(c.firebase.projectId).toBe('web-sequence-local');
    expect(c.features.payment).toBe(true);
  });
  it('extension host has payment off, prod project', () => {
    const c = resolveConfig('kcpganeflmhffnlofpdmcjklmdpbbmef');
    expect(c.firebase.projectId).toBe('web-sequence-local');
    expect(c.features.payment).toBe(false);
  });
  it('staging maps to staging project', () => {
    expect(resolveConfig('staging.zenuml.com').firebase.projectId).toBe('staging-zenuml-27954');
  });
  it('unknown host falls back to staging default', () => {
    expect(resolveConfig('localhost').firebase.projectId).toBe('staging-zenuml-27954');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/config/firebaseConfig.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/config/firebaseConfig.ts`**

Port the full `configByDomain` map + `defaultConfig` from the legacy app's `src/services/configuration.js` (repo root — `../src/services/configuration.js` relative to `web/`), verified in the contract spec §1 (five host entries + default). Type it and expose `resolveConfig`:

```ts
export interface AppConfig {
  firebase: {
    apiKey: string; authDomain: string; databaseURL?: string;
    projectId: string; storageBucket: string; messagingSenderId: string; appId?: string;
  };
  paddleProductBasicMonthly: string;
  paddleProductPlusMonthly: string;
  paddleProductBasicYearly: string;
  paddleProductPlusYearly: string;
  features: { payment: boolean };
}

const configByDomain: Record<string, AppConfig> = {
  // ... paste the five entries from ../src/services/configuration.js (repo root) verbatim,
  // typed as AppConfig (app.zenuml.com, the 3 extension hostnames, staging.zenuml.com,
  // web-sequence-dev.web.app) ...
};

const defaultConfig: AppConfig = {
  // ... paste defaultConfig (staging) ...
};

export function resolveConfig(hostname: string = window.location.hostname): AppConfig {
  return configByDomain[hostname] ?? defaultConfig;
}

export const config = resolveConfig();
```
> The actual credential values live in the legacy `src/services/configuration.js` (repo root); copy them exactly. They are public Firebase web keys (already shipped in the client), so no secret handling is needed.

- [ ] **Step 4: Run tests**

Run: `pnpm test src/config/firebaseConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/firebaseConfig.ts src/config/firebaseConfig.test.ts
git commit -m "feat: host-based Firebase/Paddle config (contract C-ENV-1)"
```

---

### Task 9: Runtime-mode detection (TDD)

**Files:**
- Create: `src/app/runtimeMode.ts`
- Test: `src/app/runtimeMode.test.ts`

- [ ] **Step 1: Write failing tests**

`src/app/runtimeMode.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectRuntimeMode } from './runtimeMode';

describe('detectRuntimeMode', () => {
  it('embed when ?embed present', () => {
    expect(detectRuntimeMode({ search: '?embed=1', isExtension: false, isDesktop: false }).isEmbed).toBe(true);
  });
  it('shared read-only when id + share-token present', () => {
    const m = detectRuntimeMode({ search: '?id=abc&share-token=xyz', isExtension: false, isDesktop: false });
    expect(m.isShared).toBe(true);
    expect(m.itemId).toBe('abc');
    expect(m.shareToken).toBe('xyz');
  });
  it('extension/desktop flags pass through', () => {
    expect(detectRuntimeMode({ search: '', isExtension: true, isDesktop: false }).isExtension).toBe(true);
    expect(detectRuntimeMode({ search: '', isExtension: false, isDesktop: true }).isDesktop).toBe(true);
  });
  it('standard mode when no flags', () => {
    const m = detectRuntimeMode({ search: '', isExtension: false, isDesktop: false });
    expect(m.isEmbed || m.isShared || m.isExtension || m.isDesktop).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/app/runtimeMode.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/app/runtimeMode.ts`**

```ts
export interface RuntimeMode {
  isEmbed: boolean;
  isShared: boolean;
  isExtension: boolean;
  isDesktop: boolean;
  itemId: string | null;
  shareToken: string | null;
}

export interface RuntimeInput {
  search: string;
  isExtension: boolean;
  isDesktop: boolean;
}

export function detectRuntimeMode(input: RuntimeInput): RuntimeMode {
  const p = new URLSearchParams(input.search);
  const itemId = p.get('id') ?? p.get('itemId');
  const shareToken = p.get('share-token') ?? p.get('token');
  return {
    isEmbed: p.has('embed'),
    isShared: !!(itemId && shareToken),
    isExtension: input.isExtension,
    isDesktop: input.isDesktop,
    itemId,
    shareToken,
  };
}

export function detectFromEnv(): RuntimeMode {
  return detectRuntimeMode({
    search: window.location.search,
    isExtension: !!window.IS_EXTENSION || window.location.protocol === 'chrome-extension:',
    isDesktop: !!window.zenumlDesktop,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/app/runtimeMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/runtimeMode.ts src/app/runtimeMode.test.ts
git commit -m "feat: runtime-mode detection (RM-1..RM-6)"
```

---

### Task 10: Storage abstraction (TDD)

**Files:**
- Create: `src/services/storage.ts`
- Test: `src/services/storage.test.ts`

- [ ] **Step 1: Write failing tests**

`src/services/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { localStore } from './storage';

beforeEach(() => window.localStorage.clear());

describe('localStore', () => {
  it('round-trips JSON values', async () => {
    await localStore.set('k', { a: 1 });
    expect(await localStore.get('k', null)).toEqual({ a: 1 });
  });
  it('returns fallback when missing', async () => {
    expect(await localStore.get('missing', 42)).toBe(42);
  });
  it('tolerates legacy non-JSON string values', async () => {
    window.localStorage.setItem('legacy', 'plain-string');
    expect(await localStore.get('legacy', '')).toBe('plain-string');
  });
  it('remove deletes the key', async () => {
    await localStore.set('k', 1);
    await localStore.remove('k');
    expect(await localStore.get('k', 'gone')).toBe('gone');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test src/services/storage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/services/storage.ts`**

```ts
export interface KvStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

function makeLocalStore(): KvStore {
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    },
    async set(key, value) { window.localStorage.setItem(key, JSON.stringify(value)); },
    async remove(key) { window.localStorage.removeItem(key); },
  };
}

// chrome.storage.sync wrapper; falls back to localStorage when unavailable (web).
function makeSyncStore(): KvStore {
  const chromeStorage = (globalThis as any).chrome?.storage?.sync;
  if (!chromeStorage) return makeLocalStore();
  return {
    get<T>(key: string, fallback: T): Promise<T> {
      return new Promise((res) => chromeStorage.get({ [key]: fallback }, (r: any) => res(r[key])));
    },
    set(key, value) { return new Promise((res) => chromeStorage.set({ [key]: value }, () => res())); },
    remove(key) { return new Promise((res) => chromeStorage.remove(key, () => res())); },
  };
}

export const localStore: KvStore = makeLocalStore();
export const syncStore: KvStore = makeSyncStore();
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/services/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/storage.ts src/services/storage.test.ts
git commit -m "feat: local/chrome.storage KV abstraction (contract C-STO-1)"
```

---

### Task 11: Constants

**Files:**
- Create: `src/config/constants.ts`

- [ ] **Step 1: Create `src/config/constants.ts`**

```ts
export const AUTO_SAVE_INTERVAL = 15000;     // ms (REQ-PST-2)
export const UNSAVED_WARNING_COUNT = 15;     // edits before save-button nudge (REQ-PST-3)
export const PREVIEW_DEBOUNCE = 500;         // ms (REQ-PRV-1)
export const FILE_LIMITS = { free: 3, basic: 20 } as const; // plus = unlimited (REQ-SUB-5)

export const LS_KEYS = {
  code: 'code',
  items: 'items',
  loginAndSaveMessageSeen: 'loginAndsaveMessageSeen',
  askedToImportCreations: 'askedToImportCreations',
  pledgeModalSeen: 'pledgeModalSeen',
  onboarded: 'onboarded',
  lastSeenVersion: 'lastSeenVersion',
  lastAuthProvider: 'lastAuthProvider',
} as const;
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm typecheck` → no errors.
```bash
git add src/config/constants.ts
git commit -m "feat: app constants and localStorage keys (contract §7)"
```

---

### Task 12: Firebase initialization (modular SDK)

**Files:**
- Create: `src/services/firebase.ts`

- [ ] **Step 1: Implement `src/services/firebase.ts`**

```ts
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider,
  TwitterAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { config } from '../config/firebaseConfig';
import type { AppUser } from '../domain/types';
import type { ProviderName } from './types';

const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const providers: Record<ProviderName, () => any> = {
  google: () => { const p = new GoogleAuthProvider(); p.addScope('https://www.googleapis.com/auth/userinfo.profile'); return p; },
  github: () => new GithubAuthProvider(),
  facebook: () => new FacebookAuthProvider(),
  twitter: () => new TwitterAuthProvider(),
};

export async function login(provider: ProviderName): Promise<void> {
  await signInWithPopup(auth, providers[provider]());
}
export async function logout(): Promise<void> { await signOut(auth); }
export async function getIdToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not authenticated');
  return u.getIdToken(true);
}
export function onAuthChange(cb: (user: AppUser | null) => void): () => void {
  return onAuthStateChanged(auth, (u) => {
    cb(u ? { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, email: u.email } : null);
  });
}
```

Create `src/services/types.ts`:
```ts
export type ProviderName = 'google' | 'github' | 'facebook' | 'twitter';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. Per CQ-5, multiple tabs are supported via `persistentMultipleTabManager` (no legacy multi-tab warning). Init must not throw; if the persistent cache can't initialize (e.g., IndexedDB unavailable in private browsing), Milestone 02 adds a graceful fallback to the default memory cache.

- [ ] **Step 3: Commit**

```bash
git add src/services/firebase.ts src/services/types.ts
git commit -m "feat: Firebase modular SDK init + auth (contract §2, CQ-5)"
```

---

### Task 13: App shell, router, entry — boots an empty split layout

**Files:**
- Create: `index.html` (at web/ root), `src/main.tsx`, `src/app/router.tsx`, `src/app/AppRoot.tsx`, `src/styles/globals.css`
- Test: `src/app/AppRoot.test.tsx`

- [ ] **Step 1: Create `index.html`** (at the `web/` root — conventional Vite entry)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ZenUML — Sequence Diagrams</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #app { height: 100%; margin: 0; }
```

- [ ] **Step 3: Write the failing shell test**

`src/app/AppRoot.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppRoot } from './AppRoot';

describe('AppRoot', () => {
  it('renders editor and preview regions', () => {
    render(<AppRoot />);
    expect(screen.getByTestId('editor-region')).toBeInTheDocument();
    expect(screen.getByTestId('preview-region')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm test src/app/AppRoot.test.tsx`
Expected: FAIL (AppRoot not found).

- [ ] **Step 5: Implement `src/app/AppRoot.tsx`**

```tsx
export function AppRoot() {
  return (
    <div className="flex h-full w-full">
      <section data-testid="editor-region" className="w-1/2 border-r border-gray-200" aria-label="Editor">
        {/* Milestone 01: CodeMirror editors */}
      </section>
      <section data-testid="preview-region" className="w-1/2" aria-label="Preview">
        {/* Milestone 01: iframe preview */}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Run the test**

Run: `pnpm test src/app/AppRoot.test.tsx`
Expected: PASS.

- [ ] **Step 7: Create `src/app/router.tsx`** (single route, typed search params)

```tsx
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppRoot } from './AppRoot';

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (s: Record<string, unknown>) => ({
    id: (s.id as string) ?? undefined,
    'share-token': (s['share-token'] as string) ?? undefined,
    embed: s.embed !== undefined ? true : undefined,
    code: (s.code as string) ?? undefined,
    title: (s.title as string) ?? undefined,
    stickyOffset: s.stickyOffset !== undefined ? Number(s.stickyOffset) : undefined,
  }),
  component: AppRoot,
});

const routeTree = rootRoute.addChildren([indexRoute]);
export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 8: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './app/router';
import './styles/globals.css';

const queryClient = new QueryClient();
const el = document.getElementById('app')!;
createRoot(el).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 9: Run dev server and verify it boots**

Run: `pnpm dev` (then open http://localhost:3000)
Expected: page loads with two empty regions, no console errors. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add index.html src/main.tsx src/app/router.tsx src/app/AppRoot.tsx src/app/AppRoot.test.tsx src/styles/globals.css
git commit -m "feat: app shell, router, entry — boots empty split layout"
```

---

### Task 14: Production build + asset-shim check green

**Files:**
- Verify only (no new source)

- [ ] **Step 1: Typecheck the whole project**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 2: Run the unit suite**

Run: `pnpm test`
Expected: all green (sanity, item, plan, firebaseConfig, runtimeMode, storage, AppRoot).

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: builds to `web/dist/` with a hashed `assets/zenuml-*.js` emitted (the shim's build path) and `index.html` present.

- [ ] **Step 4: Asset-shim sanity check on the build output**

> The shim is exercised only once `@zenuml/core/dist/zenuml?url` is actually imported (Milestone 01's preview). For Foundation, verify the build is clean and shim-ready with a shell check (a full Playwright asset spec for `web/` is added in M01, replacing the legacy `e2e/tests/production-build.spec.js`).

Run (from `web/`):
```bash
# No dev-only /@fs/ URLs may leak into the static build:
! grep -rn "/@fs/" dist && echo "OK: no /@fs/ leakage"
```
Expected: prints `OK: no /@fs/ leakage` (exit 0). *(Once M01 imports the core bundle, also assert a hashed `assets/zenuml-*.js` exists and the diagram renders — that becomes the M01 Playwright asset spec.)*

- [ ] **Step 5: Commit (if any config tweaks were needed)**

```bash
git add -A
git commit -m "chore: green typecheck + unit + production-build asset check on new scaffold"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** Foundation covers NFR-1..9 (toolchain, types, structure, build seams), RM-1..6 (runtimeMode), the canonical types/§3 and service skeletons/§4 needed by later milestones, contract §1 (host config), §2 (auth init), §7 (storage keys/abstraction). Feature behavior (editor, persistence, library, billing) is intentionally deferred to M01–M04.
- **Placeholders:** none — every code step has complete code; the only "paste from legacy verbatim" is the public Firebase config map (values are public web keys) and the canonical type block (defined in the roadmap §3).
- **Type consistency:** function/type names (`Item`, `Page`, `migrateToPages`, `applyPageEdit`, `getPlanType`, `resolveConfig`, `detectRuntimeMode`, `KvStore`, `ProviderName`) match the roadmap §3/§4 exactly and are reused unchanged downstream.

---

## Done when

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` all green (run from `web/`).
- [ ] `pnpm dev` serves the empty split layout at :3000 with no console errors.
- [ ] Build output clean (no `/@fs/` leakage; shim ready).
- [ ] Legacy app at repo root still builds/runs untouched.
- [ ] All work committed in small steps on `rewrite/frontend`.
- [ ] Ready for Milestone 01 (editor + preview).
