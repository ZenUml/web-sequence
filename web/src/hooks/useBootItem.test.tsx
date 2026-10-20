import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolveBootItem } from './useBootItem';
import type { BootDeps } from './useBootItem';
import type { Item } from '../domain/types';
import { SharedItemError } from '../services/sharedItemError';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    title: 'Test',
    js: 'A.message',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
    ...overrides,
  };
}

function makeBaseDeps(overrides: Partial<BootDeps> = {}): BootDeps {
  return {
    idParam: null,
    shareToken: null,
    codeParam: null,
    codeTitle: null,
    preserveLastCode: false,
    getItem: vi.fn(async () => makeItem()),
    getSharedItem: vi.fn(async () => makeItem({ isReadOnly: true })),
    getLastCode: vi.fn(async () => null),
    ...overrides,
  };
}

describe('resolveBootItem (pure resolver)', () => {
  // Branch 1: shareToken + idParam → shared item
  it('returns shared item with isReadOnly when both shareToken and idParam provided', async () => {
    const sharedItem = makeItem({ id: 'shared-1', title: 'Shared' });
    const deps = makeBaseDeps({
      idParam: 'shared-1',
      shareToken: 'tok123',
      getSharedItem: vi.fn(async () => sharedItem),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('shared');
    if (result.kind === 'shared') {
      expect(result.item.isReadOnly).toBe(true);
      expect(result.item.id).toBe('shared-1');
    }
    expect(deps.getSharedItem).toHaveBeenCalledWith('shared-1', 'tok123');
  });

  // Branch 1 error → share-error (REQ-SHR-4): a dead share link must NOT silently
  // become a blank new diagram — it surfaces ShareErrorNotice instead.
  it('returns share-error when getSharedItem throws', async () => {
    const deps = makeBaseDeps({
      idParam: 'shared-1',
      shareToken: 'tok123',
      getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('share-error');
  });

  // Provenance: only an explicit backend refusal is 'unavailable'; an untyped or
  // network/5xx failure is 'retryable' (the link may be fine).
  it.each([
    ['404 not found', 'unavailable', () => new SharedItemError('Item not found', 404)],
    ['403 revoked / token mismatch', 'unavailable', () => new SharedItemError('Invalid share token', 403)],
    ['500 server failure', 'retryable', () => new SharedItemError('Failed', 500)],
    ['network failure', 'retryable', () => new SharedItemError('Failed', null)],
    ['untyped error', 'retryable', () => new Error('not found')],
  ] as const)('classifies a %s as %s', async (_label, failure, makeError) => {
    const deps = makeBaseDeps({
      idParam: 'shared-1',
      shareToken: 'tok123',
      getSharedItem: vi.fn(async () => { throw makeError(); }),
    });
    const result = await resolveBootItem(deps);
    expect(result).toEqual({ kind: 'share-error', failure });
  });

  // Branch 2: idParam only → owned item
  it('returns item when only idParam provided', async () => {
    const ownedItem = makeItem({ id: 'own-1', title: 'Owned' });
    const deps = makeBaseDeps({
      idParam: 'own-1',
      getItem: vi.fn(async () => ownedItem),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('item');
    if (result.kind === 'item') {
      expect(result.item.id).toBe('own-1');
    }
    expect(deps.getItem).toHaveBeenCalledWith('own-1');
  });

  // Branch 2 error fallback → new
  it('falls through to new when getItem throws (not found/unauthorized)', async () => {
    const deps = makeBaseDeps({
      idParam: 'own-1',
      getItem: vi.fn(async () => { throw new Error('Item not found'); }),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
  });

  // New lifecycle: a never-saved blank diagram (New) lives only in the last-code
  // slot. Reloading its ?id= must restore THAT draft — blank title/DSL/CSS and the
  // same id — instead of replacing it with the default sample under a new id.
  it('restores the unsaved last-code draft when the ?id= miss matches its id, even if blank', async () => {
    const draft = makeItem({ id: 'blank-1', title: 'Untitled', js: '', css: '' });
    const deps = makeBaseDeps({
      idParam: 'blank-1',
      preserveLastCode: true,
      getItem: vi.fn(async () => { throw new Error('Item not found'); }),
      getLastCode: vi.fn(async () => draft),
    });
    const result = await resolveBootItem(deps);
    expect(result).toEqual({ kind: 'lastcode', item: draft });
  });

  it('still falls through to new on an ?id= miss when the last-code draft has another id', async () => {
    const deps = makeBaseDeps({
      idParam: 'blank-1',
      preserveLastCode: true,
      getItem: vi.fn(async () => { throw new Error('Item not found'); }),
      getLastCode: vi.fn(async () => makeItem({ id: 'other', js: '' })),
    });
    expect((await resolveBootItem(deps)).kind).toBe('new');
  });

  it('does not read the last-code draft on an ?id= miss when preserveLastCode is off', async () => {
    const getLastCode = vi.fn(async () => makeItem({ id: 'blank-1', js: '' }));
    const deps = makeBaseDeps({
      idParam: 'blank-1',
      preserveLastCode: false,
      getItem: vi.fn(async () => { throw new Error('Item not found'); }),
      getLastCode,
    });
    expect((await resolveBootItem(deps)).kind).toBe('new');
    expect(getLastCode).not.toHaveBeenCalled();
  });

  // Branch 3: preserveLastCode + getLastCode returns item with non-empty js
  it('returns lastcode when preserveLastCode is true and last code has js content', async () => {
    const savedItem = makeItem({ id: 'code', title: 'Saved', js: 'A.message' });
    const deps = makeBaseDeps({
      preserveLastCode: true,
      getLastCode: vi.fn(async () => savedItem),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('lastcode');
    if (result.kind === 'lastcode') {
      expect(result.item.id).toBe('code');
    }
  });

  // Branch 3: lastcode item has empty js → new
  it('returns new when preserveLastCode is true but last code has empty js', async () => {
    const emptyItem = makeItem({ js: '' });
    const deps = makeBaseDeps({
      preserveLastCode: true,
      getLastCode: vi.fn(async () => emptyItem),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
  });

  // Branch 3: getLastCode returns null → new
  it('returns new when preserveLastCode is true but getLastCode returns null', async () => {
    const deps = makeBaseDeps({
      preserveLastCode: true,
      getLastCode: vi.fn(async () => null),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
  });

  // Branch 3: getLastCode throws → new (error fallback)
  it('returns new when preserveLastCode is true but getLastCode throws', async () => {
    const deps = makeBaseDeps({
      preserveLastCode: true,
      getLastCode: vi.fn(async () => { throw new Error('storage unavailable'); }),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
  });

  // Branch: ?code= inline diagram (adversarial review finding 1) — the embed
  // "Open in ZenUML" link forwards the original ?code= to the FULL app (no ?embed),
  // so the full-app boot must seed an EDITABLE diagram from it (legacy parity:
  // app.jsx read ?code= unconditionally at boot).
  it('returns an editable code item when codeParam is raw DSL (finding 1)', async () => {
    const deps = makeBaseDeps({ codeParam: 'A.fromUrl()', codeTitle: 'My Title' });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('code');
    if (result.kind === 'code') {
      expect(result.item.js).toBe('A.fromUrl()');
      expect(result.item.title).toBe('My Title');
      // MUST be editable — otherwise save() early-returns and ShareButton is
      // disabled, defeating the entire point of "Open in ZenUML".
      expect(result.item.isReadOnly).toBeFalsy();
    }
  });

  // Legacy embed links carry ?code=${JSON.stringify(item)} — parseEmbedCode must
  // unwrap it so forwarded legacy links keep working.
  it('unwraps a legacy JSON-item codeParam into an editable item (finding 1)', async () => {
    const legacy = JSON.stringify({ js: 'A.legacy()', title: 'Legacy', css: '', html: '' });
    const deps = makeBaseDeps({ codeParam: legacy, codeTitle: null });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('code');
    if (result.kind === 'code') {
      expect(result.item.js).toBe('A.legacy()');
      expect(result.item.title).toBe('Legacy');
      expect(result.item.isReadOnly).toBeFalsy();
    }
  });

  // Finding 1 (adversarial review): the embed "Open in ZenUML" link forwards
  // ?code=<JSON item> WITHOUT ?embed, landing on THIS full-app code path. A legacy
  // scss item must keep its cssMode here too, or the full editor renders raw scss.
  // DISCRIMINATING: revert useBootItem's seed back to cssMode:'css' → this fails.
  it('preserves the legacy item cssMode on the full-app ?code= round-trip (finding 1)', async () => {
    const legacy = JSON.stringify({
      js: 'A.b()', css: '$c: red;', cssMode: 'scss', html: '# H', htmlMode: 'markdown', jsMode: 'typescript',
    });
    const deps = makeBaseDeps({ codeParam: legacy, codeTitle: null });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('code');
    if (result.kind === 'code') {
      expect(result.item.cssMode).toBe('scss');
      expect(result.item.htmlMode).toBe('markdown');
      expect(result.item.jsMode).toBe('typescript');
    }
  });

  // Precedence: an explicit ?code= wins over stale last-code (legacy: urlCode || result.code).
  it('codeParam takes precedence over preserveLastCode (finding 1)', async () => {
    const deps = makeBaseDeps({
      codeParam: 'A.url()',
      preserveLastCode: true,
      getLastCode: vi.fn(async () => makeItem({ js: 'A.stale()' })),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('code');
    expect(deps.getLastCode).not.toHaveBeenCalled();
  });

  // An empty codeParam is treated as absent (falls through to normal resolution).
  it('ignores an empty codeParam (finding 1)', async () => {
    const deps = makeBaseDeps({ codeParam: '' });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
  });

  // Branch 4: no params, no lastCode → new
  it('returns new when no idParam, no shareToken, preserveLastCode false', async () => {
    const deps = makeBaseDeps();
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
  });
});

describe('useBootItem hook', () => {
  beforeEach(() => {
    // Reset editorStore to null between tests
    vi.resetModules();
  });

  it('does NOT resolve when authReady=false (FIX 1 boot race gate)', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const getItem = vi.fn(async () => makeItem({ id: 'gated-item', js: 'A.gated' }));
    const deps = makeBaseDeps({ idParam: 'gated-item', getItem });

    await act(async () => {
      // authReady=false — boot must not fire
      renderHook(() => useBootItem(deps, false));
      await new Promise((r) => setTimeout(r, 0));
    });

    // Store must remain empty — neither loadItem nor newItem called
    expect(useEditorStore.getState().currentItem).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('resolves after authReady flips to true (FIX 1 boot race rerender)', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const ownedItem = makeItem({ id: 'ready-item', js: 'A.ready' });
    const getItem = vi.fn(async () => ownedItem);
    const deps = makeBaseDeps({ idParam: 'ready-item', getItem });

    let authReady = false;
    const { rerender } = renderHook(() => useBootItem(deps, authReady));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Still not resolved
    expect(useEditorStore.getState().currentItem).toBeNull();

    // Now flip authReady
    authReady = true;
    await act(async () => {
      rerender();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(useEditorStore.getState().currentItem?.id).toBe('ready-item');
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('calls loadItem on the editor store when item resolved', async () => {
    // Import after potential reset
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const ownedItem = makeItem({ id: 'hook-item', title: 'Hook Test', js: 'A.test' });
    const deps = makeBaseDeps({
      idParam: 'hook-item',
      getItem: vi.fn(async () => ownedItem),
    });

    await act(async () => {
      renderHook(() => useBootItem(deps, true));
      // Let the async resolution complete
      await new Promise((r) => setTimeout(r, 0));
    });

    const state = useEditorStore.getState();
    expect(state.currentItem?.id).toBe('hook-item');
  });

  it('calls newItem on the editor store when no item resolves', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore, DEFAULT_STARTER } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const deps = makeBaseDeps(); // all null → kind:'new'

    await act(async () => {
      renderHook(() => useBootItem(deps, true));
      await new Promise((r) => setTimeout(r, 0));
    });

    const state = useEditorStore.getState();
    // newItem() creates a fresh item with a generated id seeded from DEFAULT_STARTER.
    expect(state.currentItem).not.toBeNull();
    expect(state.currentItem?.js).toBe(DEFAULT_STARTER.js);
  });

  it('on share-error: does NOT seed an item and exposes shareError=true (REQ-SHR-4)', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');
    const { SharedItemError } = await import('../services/sharedItemError');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    // A dead link is an EXPLICIT backend answer (404 from get_shared_item). Untyped
    // errors are now retryable — see the shared-link visitor status suite below.
    const deps = makeBaseDeps({
      idParam: 'shared-x',
      shareToken: 'dead-tok',
      getSharedItem: vi.fn(async () => { throw new SharedItemError('Item not found', 404); }),
    });

    let view: ReturnType<typeof renderHook<{ shareError: boolean; clearShareError(): void }, unknown>>;
    await act(async () => {
      view = renderHook(() => useBootItem(deps, true));
      await new Promise((r) => setTimeout(r, 0));
    });

    // No blank diagram seeded — the guard must surface ShareErrorNotice instead.
    expect(useEditorStore.getState().currentItem).toBeNull();
    // result.current is live — read it AFTER act flushes the setShareError re-render.
    expect(view!.result.current.shareError).toBe(true);
  });

  it('seeds an editable item from codeParam via the hook (finding 1)', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const deps = makeBaseDeps({ codeParam: 'A.fromUrl()', codeTitle: 'Open In' });

    await act(async () => {
      renderHook(() => useBootItem(deps, true));
      await new Promise((r) => setTimeout(r, 0));
    });

    const state = useEditorStore.getState();
    expect(state.currentItem?.js).toBe('A.fromUrl()');
    expect(state.currentItem?.isReadOnly).toBeFalsy();
  });

  it('runs only once (idempotent) even when deps change', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const getItem = vi.fn(async () => makeItem({ id: 'once-item', js: 'A.once' }));
    const deps = makeBaseDeps({ idParam: 'once-item', getItem });

    await act(async () => {
      const { rerender } = renderHook(() => useBootItem(deps, true));
      await new Promise((r) => setTimeout(r, 0));
      rerender();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should only have been called once despite rerender
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});

describe('useBootItem onResolved callback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls onResolved with the resolved kind once auth is ready', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const onResolved = vi.fn();
    const deps = makeBaseDeps({ onResolved });

    await act(async () => {
      renderHook(() => useBootItem(deps, true, false));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onResolved).toHaveBeenCalledWith('new');
  });

  it('does not call onResolved when skipped (embed-by-value)', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const onResolved = vi.fn();
    const deps = makeBaseDeps({ onResolved });

    await act(async () => {
      renderHook(() => useBootItem(deps, true, true)); // skip=true
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(onResolved).not.toHaveBeenCalled();
  });
});

// ─── Shared-link visitor status (loading / retryable failure / retry) ──────────
describe('useBootItem shared-link visitor status', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  async function setup() {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');
    const { SharedItemError } = await import('../services/sharedItemError');
    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });
    return { useBootItem, useEditorStore, SharedItemError };
  }

  const original = (): Item => makeItem({
    id: 'shared-1',
    title: 'Checkout flow',
    js: 'Alice->Bob: pay',
    css: '.x { color: red }',
    cssMode: 'scss',
    pages: [
      { id: 'p1', title: 'Main', js: 'Alice->Bob: pay', css: '.x { color: red }' },
      { id: 'p2', title: 'Refund', js: 'Bob->Alice: refund', css: '' },
    ] as Item['pages'],
    currentPageId: 'p1',
  });

  it('reports loading for a shared boot BEFORE auth is ready, without requesting', async () => {
    const { useBootItem } = await setup();
    const getSharedItem = vi.fn(async () => original());
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, false));
    await flush();
    expect(view.result.current.shareStatus).toBe('loading');
    expect(getSharedItem).not.toHaveBeenCalled();
  });

  it('loading → success: stays loading while pending, then loads the original read-only item', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const pending = deferred<Item>();
    const getSharedItem = vi.fn(() => pending.promise);
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();

    expect(view.result.current.shareStatus).toBe('loading');
    expect(useEditorStore.getState().currentItem).toBeNull();

    await act(async () => { pending.resolve(original()); await pending.promise; });
    await flush();

    const item = useEditorStore.getState().currentItem!;
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(item.title).toBe('Checkout flow');
    expect(item.isReadOnly).toBe(true);
    expect(item.cssMode).toBe('scss');
    expect(item.pages.map((p) => p.title)).toEqual(['Main', 'Refund']);
    expect(item.pages[0].css).toBe('.x { color: red }');
    expect(getSharedItem).toHaveBeenCalledTimes(1);
  });

  it('transient failure → retry → success: retry is a fresh request with the same id/token', async () => {
    const { useBootItem, useEditorStore, SharedItemError } = await setup();
    const second = deferred<Item>();
    const getSharedItem = vi.fn()
      .mockRejectedValueOnce(new SharedItemError('Failed', 503))
      .mockImplementationOnce(() => second.promise);
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();

    expect(view.result.current.shareStatus).toBe('retryable-error');
    expect(view.result.current.shareError).toBe(false); // not the dead-link notice
    expect(useEditorStore.getState().currentItem).toBeNull(); // no blank editable diagram

    act(() => { view.result.current.retryShare(); });
    expect(view.result.current.shareStatus).toBe('loading');
    expect(getSharedItem).toHaveBeenCalledTimes(2);
    expect(getSharedItem).toHaveBeenNthCalledWith(2, 'shared-1', 'tok');

    await act(async () => { second.resolve(original()); await second.promise; });
    await flush();
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(useEditorStore.getState().currentItem?.title).toBe('Checkout flow');
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
  });

  it('prevents duplicate retries: two rapid retries issue ONE fresh request', async () => {
    const { useBootItem, SharedItemError } = await setup();
    const second = deferred<Item>();
    const getSharedItem = vi.fn()
      .mockRejectedValueOnce(new SharedItemError('Failed', null))
      .mockImplementation(() => second.promise);
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();

    act(() => {
      view.result.current.retryShare();
      view.result.current.retryShare();
    });
    act(() => { view.result.current.retryShare(); });
    expect(getSharedItem).toHaveBeenCalledTimes(2); // initial + exactly one retry
  });

  it('explicit 404 → unavailable (existing dead-link notice), never retryable', async () => {
    const { useBootItem, useEditorStore, SharedItemError } = await setup();
    const getSharedItem = vi.fn(async () => { throw new SharedItemError('Item not found', 404); });
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    expect(view.result.current.shareStatus).toBe('unavailable');
    expect(view.result.current.shareError).toBe(true);
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('untyped failure is retryable, not asserted invalid', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const getSharedItem = vi.fn(async () => { throw new Error('boom'); });
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    expect(view.result.current.shareStatus).toBe('retryable-error');
    expect(view.result.current.shareError).toBe(false);
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('link revoked between attempts: retry that gets 403 fails closed with no content', async () => {
    const { useBootItem, useEditorStore, SharedItemError } = await setup();
    const getSharedItem = vi.fn()
      .mockRejectedValueOnce(new SharedItemError('Failed', 500))
      .mockRejectedValueOnce(new SharedItemError('Invalid share token or item not shared', 403));
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    act(() => { view.result.current.retryShare(); });
    await flush();
    expect(view.result.current.shareStatus).toBe('unavailable');
    expect(view.result.current.shareError).toBe(true);
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('retryShare is a no-op unless the last attempt failed retryably', async () => {
    const { useBootItem } = await setup();
    const pending = deferred<Item>();
    const getSharedItem = vi.fn(() => pending.promise);
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    act(() => { view.result.current.retryShare(); }); // still loading
    expect(getSharedItem).toHaveBeenCalledTimes(1);
  });

  it('late completion after unmount does NOT load the shared item', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const pending = deferred<Item>();
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem: vi.fn(() => pending.promise) });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    view.unmount();
    await act(async () => { pending.resolve(original()); await pending.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('late completion after navigating away (boot skipped, e.g. hub) does NOT load the shared item', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const pending = deferred<Item>();
    let deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem: vi.fn(() => pending.promise) });
    let skip = false;
    const view = renderHook(() => useBootItem(deps, true, skip));
    await flush();
    // goHome clears id/share-token and AppRoot skips boot on the hub.
    deps = { ...deps, idParam: null, shareToken: null };
    skip = true;
    view.rerender();
    expect(view.result.current.shareStatus).toBe('idle');
    await act(async () => { pending.resolve(original()); await pending.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem).toBeNull();
    expect(view.result.current.shareStatus).toBe('idle');
  });

  it('late completion never clobbers an item the user opened meanwhile', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const pending = deferred<Item>();
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem: vi.fn(() => pending.promise) });
    renderHook(() => useBootItem(deps, true));
    await flush();
    act(() => { useEditorStore.getState().loadItem(makeItem({ id: 'mine', title: 'Mine' })); });
    await act(async () => { pending.resolve(original()); await pending.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem?.id).toBe('mine');
  });

  it('late FAILURE after navigating away does not resurrect an error state', async () => {
    const { useBootItem, SharedItemError } = await setup();
    const pending = deferred<Item>();
    let deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem: vi.fn(() => pending.promise) });
    let skip = false;
    const view = renderHook(() => useBootItem(deps, true, skip));
    await flush();
    deps = { ...deps, idParam: null, shareToken: null };
    skip = true;
    view.rerender();
    await act(async () => { pending.reject(new SharedItemError('Item not found', 404)); await pending.promise.catch(() => {}); });
    await flush();
    expect(view.result.current.shareStatus).toBe('idle');
    expect(view.result.current.shareError).toBe(false);
  });

  it('fires onResolved once for the boot outcome; a successful retry does not re-fire it', async () => {
    const { useBootItem, SharedItemError } = await setup();
    const onResolved = vi.fn();
    const getSharedItem = vi.fn()
      .mockRejectedValueOnce(new SharedItemError('Failed', 500))
      .mockResolvedValueOnce(original());
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem, onResolved });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    act(() => { view.result.current.retryShare(); });
    await flush();
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith('share-error');
  });

  it.each([
    ['owned ?id=', { idParam: 'own-1' }],
    ['inline ?code=', { codeParam: 'A.b()' }],
    ['fresh start', {}],
  ] as const)('non-shared boot (%s) reports idle and never calls getSharedItem', async (_l, over) => {
    const { useBootItem } = await setup();
    const getSharedItem = vi.fn(async () => original());
    const deps = makeBaseDeps({ ...over, getSharedItem });
    const view = renderHook(() => useBootItem(deps, true));
    await flush();
    expect(view.result.current.shareStatus).toBe('idle');
    expect(getSharedItem).not.toHaveBeenCalled();
  });

  it('embed-by-value (skip=true) with share params reports idle and makes no request', async () => {
    const { useBootItem } = await setup();
    const getSharedItem = vi.fn(async () => original());
    const deps = makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem });
    const view = renderHook(() => useBootItem(deps, true, true));
    await flush();
    expect(view.result.current.shareStatus).toBe('idle');
    expect(getSharedItem).not.toHaveBeenCalled();
  });
});

// ─── Route re-entry: shared URL → own/library route → Back to the same target ──
describe('useBootItem shared target re-entry (browser Back)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  async function setup() {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');
    const { SharedItemError } = await import('../services/sharedItemError');
    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });
    return { useBootItem, useEditorStore, SharedItemError };
  }

  const shared = (title = 'Checkout flow') =>
    makeItem({ id: 'shared-1', title, js: 'Alice->Bob: pay', isReadOnly: true });
  const own = () => makeItem({ id: 'own-x', title: 'My private diagram', js: 'Me->Me: secret' });

  // Mutable route the hook reads on every render (mirrors AppRoot's URL-derived deps).
  function route(getSharedItem: BootDeps['getSharedItem'], onResolved?: BootDeps['onResolved']) {
    const state = {
      deps: makeBaseDeps({ idParam: 'shared-1', shareToken: 'tok', getSharedItem, onResolved }),
      skip: false,
    };
    return {
      state,
      toShare() { state.deps = { ...state.deps, idParam: 'shared-1', shareToken: 'tok' }; state.skip = false; },
      toHub() { state.deps = { ...state.deps, idParam: null, shareToken: null }; state.skip = true; },
      toOwn() { state.deps = { ...state.deps, idParam: 'own-x', shareToken: null }; state.skip = false; },
    };
  }

  it('loaded share → hub → Back: refetches the same id/token and shows it again (not blank)', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const getSharedItem = vi.fn(async () => shared());
    const r = route(getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    expect(view.result.current.shareStatus).toBe('loaded');

    r.toHub(); view.rerender(); await flush();
    expect(view.result.current.shareStatus).toBe('idle');

    r.toShare(); view.rerender();
    expect(view.result.current.shareStatus).toBe('loading'); // same render, no idle frame
    await flush();
    expect(getSharedItem).toHaveBeenCalledTimes(2);
    expect(getSharedItem).toHaveBeenNthCalledWith(2, 'shared-1', 'tok');
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-1');
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
  });

  it('pending share → hub → Back: the first (stale) response is dropped, the fresh one wins', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const first = deferred<Item>();
    const second = deferred<Item>();
    const getSharedItem = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const r = route(getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    r.toHub(); view.rerender(); await flush();
    r.toShare(); view.rerender(); await flush();
    expect(getSharedItem).toHaveBeenCalledTimes(2);

    await act(async () => { second.resolve(shared('Fresh title')); await second.promise; });
    await flush();
    await act(async () => { first.resolve(shared('STALE title')); await first.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem?.title).toBe('Fresh title');
    expect(view.result.current.shareStatus).toBe('loaded');
  });

  it('share → own route (owner item opened) → Back: loading hides the owner item, then the shared item replaces it', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const back = deferred<Item>();
    const getSharedItem = vi.fn()
      .mockImplementationOnce(async () => shared())
      .mockImplementationOnce(() => back.promise);
    const r = route(getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();

    // Library open: AppRoot.handleOpenItem loads the owner item, then the URL becomes ?id=own-x.
    act(() => { useEditorStore.getState().loadItem(own()); });
    r.toOwn(); view.rerender(); await flush();
    expect(view.result.current.shareStatus).toBe('idle');

    r.toShare(); view.rerender();
    // AppRoot renders the status view (not the owner item) while this is 'loading'.
    expect(view.result.current.shareStatus).toBe('loading');
    await act(async () => { back.resolve(shared()); await back.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-1');
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
  });

  it('Back to a link revoked meanwhile fails closed: unavailable, owner item never re-labelled as shared', async () => {
    const { useBootItem, useEditorStore, SharedItemError } = await setup();
    const getSharedItem = vi.fn()
      .mockImplementationOnce(async () => shared())
      .mockRejectedValueOnce(new SharedItemError('Invalid share token or item not shared', 403));
    const r = route(getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    act(() => { useEditorStore.getState().loadItem(own()); });
    r.toOwn(); view.rerender(); await flush();
    r.toShare(); view.rerender(); await flush();
    expect(view.result.current.shareStatus).toBe('unavailable');
    expect(view.result.current.shareError).toBe(true);
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBeFalsy(); // untouched, not "shared"
  });

  it('Back while offline → retryable; Try again uses the same id/token', async () => {
    const { useBootItem, SharedItemError } = await setup();
    const getSharedItem = vi.fn()
      .mockImplementationOnce(async () => shared())
      .mockRejectedValueOnce(new SharedItemError('Failed', null))
      .mockImplementationOnce(async () => shared());
    const r = route(getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    r.toHub(); view.rerender(); await flush();
    r.toShare(); view.rerender(); await flush();
    expect(view.result.current.shareStatus).toBe('retryable-error');
    act(() => { view.result.current.retryShare(); });
    await flush();
    expect(getSharedItem).toHaveBeenCalledTimes(3);
    expect(getSharedItem).toHaveBeenNthCalledWith(3, 'shared-1', 'tok');
    expect(view.result.current.shareStatus).toBe('loaded');
  });

  it('first visit from a non-shared boot (own ?id= → Back to a share URL) loads the share', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const getSharedItem = vi.fn(async () => shared());
    const getItem = vi.fn(async () => own());
    const r = route(getSharedItem);
    r.toOwn();
    r.state.deps = { ...r.state.deps, getItem };
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    expect(useEditorStore.getState().currentItem?.id).toBe('own-x');
    r.toShare(); view.rerender(); await flush();
    expect(getSharedItem).toHaveBeenCalledWith('shared-1', 'tok');
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-1');
  });

  it('boot analytics fires once; re-entering the share does not re-fire landed_in_editor', async () => {
    const { useBootItem } = await setup();
    const onResolved = vi.fn();
    const getSharedItem = vi.fn(async () => shared());
    const r = route(getSharedItem, onResolved);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    r.toHub(); view.rerender(); await flush();
    r.toShare(); view.rerender(); await flush();
    expect(getSharedItem).toHaveBeenCalledTimes(2);
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith('shared');
  });

  it('re-rendering on the same share target never issues a duplicate request', async () => {
    const { useBootItem } = await setup();
    const getSharedItem = vi.fn(async () => shared());
    const r = route(getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    view.rerender(); view.rerender(); await flush();
    expect(getSharedItem).toHaveBeenCalledTimes(1);
  });
});

// ─── Owned (non-shared) boot racing a shared target ───────────────────────────
// The once-per-mount owned boot (?id= getItem / last-code / new) must not land after
// the route has entered a shared target: no owner content and no blank newItem() may
// ever appear under a share URL, in either settlement order.
describe('useBootItem owned boot cancelled by entering a shared target', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  async function setup() {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');
    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });
    return { useBootItem, useEditorStore };
  }

  const sharedS = (title = 'Shared S') =>
    makeItem({ id: 'shared-S', title, js: 'Alice->Bob: pay', isReadOnly: true });
  const ownA = (title = 'Owner A') => makeItem({ id: 'own-A', title, js: 'Me->Me: secret' });

  // Mount on the owned route ?id=own-A; navigation mutates deps like AppRoot's URL.
  function ownedThenShared(getItem: BootDeps['getItem'], getSharedItem: BootDeps['getSharedItem'],
    onResolved?: BootDeps['onResolved']) {
    const state = {
      deps: makeBaseDeps({ idParam: 'own-A', shareToken: null, getItem, getSharedItem, onResolved }),
      skip: false,
    };
    return {
      state,
      toShare() { state.deps = { ...state.deps, idParam: 'shared-S', shareToken: 'tok-S' }; state.skip = false; },
      toOwn() { state.deps = { ...state.deps, idParam: 'own-A', shareToken: null }; state.skip = false; },
      toHub() { state.deps = { ...state.deps, idParam: null, shareToken: null }; state.skip = true; },
    };
  }

  // Every editor item that appears from this point on.
  function recordItems(store: { subscribe: (fn: (s: { currentItem: Item | null }) => void) => () => void }) {
    const seen: (string | null)[] = [];
    const stop = store.subscribe((s) => { seen.push(s.currentItem?.id ?? null); });
    return { seen, stop };
  }

  it('owned getItem(A) pending → shared S → S resolves → A resolves: S stays loaded, A never appears', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const a = deferred<Item>();
    const getItem = vi.fn(() => a.promise);
    const getSharedItem = vi.fn(async () => sharedS());
    const r = ownedThenShared(getItem, getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    expect(getItem).toHaveBeenCalledWith('own-A');

    const rec = recordItems(useEditorStore);
    r.toShare(); view.rerender(); await flush();
    expect(view.result.current.shareStatus).toBe('loaded');
    await act(async () => { a.resolve(ownA()); await a.promise; });
    await flush();
    rec.stop();
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-S');
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(rec.seen.filter((id) => id !== 'shared-S')).toEqual([]);
  });

  it('owned getItem(A) pending → shared S → S resolves → A rejects: no blank newItem replaces S', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const a = deferred<Item>();
    const getItem = vi.fn(() => a.promise);
    const getSharedItem = vi.fn(async () => sharedS());
    const r = ownedThenShared(getItem, getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    const rec = recordItems(useEditorStore);
    r.toShare(); view.rerender(); await flush();
    await act(async () => { a.reject(new Error('not found')); await a.promise.catch(() => {}); });
    await flush();
    rec.stop();
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-S');
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(rec.seen.filter((id) => id !== 'shared-S')).toEqual([]);
  });

  it('reverse order: A resolves while S is pending, then S resolves → S loads, owner A never shown under the share URL', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const a = deferred<Item>();
    const s = deferred<Item>();
    const getItem = vi.fn(() => a.promise);
    const getSharedItem = vi.fn(() => s.promise);
    const r = ownedThenShared(getItem, getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    const rec = recordItems(useEditorStore);
    r.toShare(); view.rerender(); await flush();
    expect(view.result.current.shareStatus).toBe('loading');
    await act(async () => { a.resolve(ownA()); await a.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem).toBeNull();
    expect(view.result.current.shareStatus).toBe('loading');
    await act(async () => { s.resolve(sharedS()); await s.promise; });
    await flush();
    rec.stop();
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-S');
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
    expect(rec.seen.filter((id) => id !== 'shared-S')).toEqual([]);
  });

  it('reverse order with a failing share: A resolves, then S is revoked → unavailable, no owner content, no blank seed', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const { SharedItemError } = await import('../services/sharedItemError');
    const a = deferred<Item>();
    const s = deferred<Item>();
    const r = ownedThenShared(vi.fn(() => a.promise), vi.fn(() => s.promise));
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    r.toShare(); view.rerender(); await flush();
    await act(async () => { a.resolve(ownA()); await a.promise; });
    await act(async () => { s.reject(new SharedItemError('Invalid share token', 403)); await s.promise.catch(() => {}); });
    await flush();
    expect(view.result.current.shareStatus).toBe('unavailable');
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('last-code/new boot pending → shared S: the late "new" result never seeds a blank diagram', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const last = deferred<Item | null>();
    const state = {
      deps: makeBaseDeps({ preserveLastCode: true, getLastCode: vi.fn(() => last.promise),
        getSharedItem: vi.fn(async () => sharedS()) }),
    };
    const view = renderHook(() => useBootItem(state.deps, true, false));
    await flush();
    state.deps = { ...state.deps, idParam: 'shared-S', shareToken: 'tok-S' };
    view.rerender(); await flush();
    await act(async () => { last.resolve(null); await last.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-S');
  });

  it('unmount while the owned boot is pending: the late result is dropped', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const a = deferred<Item>();
    const r = ownedThenShared(vi.fn(() => a.promise), vi.fn(async () => sharedS()));
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    view.unmount();
    await act(async () => { a.resolve(ownA()); await a.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('A pending → S → hub → S again: S loads both times, the stale A result never lands', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const a = deferred<Item>();
    const getSharedItem = vi.fn(async () => sharedS());
    const r = ownedThenShared(vi.fn(() => a.promise), getSharedItem);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    r.toShare(); view.rerender(); await flush();
    r.toHub(); view.rerender(); await flush();
    await act(async () => { a.resolve(ownA()); await a.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-S');
    r.toShare(); view.rerender(); await flush();
    expect(getSharedItem).toHaveBeenCalledTimes(2);
    expect(view.result.current.shareStatus).toBe('loaded');
    expect(useEditorStore.getState().currentItem?.id).toBe('shared-S');
  });

  it('A pending → S → Back to A: a fresh owned boot loads A; the cancelled first read stays inert', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const first = deferred<Item>();
    const second = deferred<Item>();
    const getItem = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const onResolved = vi.fn();
    const r = ownedThenShared(getItem, vi.fn(async () => sharedS()), onResolved);
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    r.toShare(); view.rerender(); await flush();
    r.toOwn(); view.rerender(); await flush();
    expect(getItem).toHaveBeenCalledTimes(2);
    expect(getItem).toHaveBeenNthCalledWith(2, 'own-A');
    await act(async () => { second.resolve(ownA('Fresh A')); await second.promise; });
    await act(async () => { first.resolve(ownA('STALE A')); await first.promise; });
    await flush();
    expect(useEditorStore.getState().currentItem?.title).toBe('Fresh A');
    // landed_in_editor fired once (for the shared boot read), not again for the re-run.
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it('owned boot that finished before entering S is not re-run on leaving S (deliberate New/Open untouched)', async () => {
    const { useBootItem, useEditorStore } = await setup();
    const getItem = vi.fn(async () => ownA());
    const r = ownedThenShared(getItem, vi.fn(async () => sharedS()));
    const view = renderHook(() => useBootItem(r.state.deps, true, r.state.skip));
    await flush();
    expect(useEditorStore.getState().currentItem?.id).toBe('own-A');
    r.toShare(); view.rerender(); await flush();
    // User deliberately opens a new diagram from the shared page, URL becomes owned.
    act(() => { useEditorStore.getState().newItem(); });
    const newId = useEditorStore.getState().currentItem?.id;
    r.toOwn(); view.rerender(); await flush();
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().currentItem?.id).toBe(newId);
  });
});
