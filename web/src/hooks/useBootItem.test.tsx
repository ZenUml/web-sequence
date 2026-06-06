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

  // Branch 1 error fallback → new
  it('falls through to new when getSharedItem throws', async () => {
    const deps = makeBaseDeps({
      idParam: 'shared-1',
      shareToken: 'tok123',
      getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
    });
    const result = await resolveBootItem(deps);
    expect(result.kind).toBe('new');
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
      renderHook(() => useBootItem(deps));
      // Let the async resolution complete
      await new Promise((r) => setTimeout(r, 0));
    });

    const state = useEditorStore.getState();
    expect(state.currentItem?.id).toBe('hook-item');
  });

  it('calls newItem on the editor store when no item resolves', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const deps = makeBaseDeps(); // all null → kind:'new'

    await act(async () => {
      renderHook(() => useBootItem(deps));
      await new Promise((r) => setTimeout(r, 0));
    });

    const state = useEditorStore.getState();
    // newItem() creates a fresh item with a generated id
    expect(state.currentItem).not.toBeNull();
    expect(state.currentItem?.js).toContain('SyncMessage');
  });

  it('runs only once (idempotent) even when deps change', async () => {
    const { useBootItem } = await import('./useBootItem');
    const { useEditorStore } = await import('../state/editorStore');

    useEditorStore.setState({ currentItem: null, dirty: false, unsavedCount: 0, saving: false });

    const getItem = vi.fn(async () => makeItem({ id: 'once-item', js: 'A.once' }));
    const deps = makeBaseDeps({ idParam: 'once-item', getItem });

    await act(async () => {
      const { rerender } = renderHook(() => useBootItem(deps));
      await new Promise((r) => setTimeout(r, 0));
      rerender();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should only have been called once despite rerender
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});
