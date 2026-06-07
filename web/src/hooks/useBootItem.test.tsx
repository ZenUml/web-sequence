import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolveBootItem } from './useBootItem';
import type { BootDeps } from './useBootItem';
import type { Item } from '../domain/types';

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

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const deps = makeBaseDeps({
      idParam: 'shared-x',
      shareToken: 'dead-tok',
      getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
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
