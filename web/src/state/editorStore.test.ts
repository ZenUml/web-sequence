import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore, DEFAULT_STARTER } from './editorStore';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

const sample = (overrides?: Partial<Item>): Item => migrateToPages({
  id: 'i1', title: 'T', js: 'A.b', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '',
  ...overrides,
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
  it('switching to acss sets cssMode (drives CSS editor read-only)', () => {
    useEditorStore.getState().loadItem(sample());
    useEditorStore.getState().setCssMode('acss');
    expect(useEditorStore.getState().currentItem!.cssMode).toBe('acss');
  });
  it('setJsMode persists the js mode', () => {
    useEditorStore.getState().loadItem(sample());
    useEditorStore.getState().setJsMode('typescript');
    expect(useEditorStore.getState().currentItem!.jsMode).toBe('typescript');
  });
  it('setCssSettings stores the ACSS config on the item and marks dirty', () => {
    useEditorStore.getState().loadItem(sample());
    useEditorStore.getState().setCssSettings({ acssConfig: '{"custom":{}}' });
    expect(useEditorStore.getState().currentItem!.cssSettings).toEqual({ acssConfig: '{"custom":{}}' });
    expect(useEditorStore.getState().dirty).toBe(true);
  });
  it('edits increment unsavedCount; markSaved resets it', () => {
    useEditorStore.getState().loadItem(sample());
    useEditorStore.getState().setDsl('X');
    useEditorStore.getState().setDsl('Y');
    expect(useEditorStore.getState().unsavedCount).toBe(2);
    useEditorStore.getState().markSaved();
    expect(useEditorStore.getState().unsavedCount).toBe(0);
    expect(useEditorStore.getState().dirty).toBe(false);
  });
  it('newItem loads a fresh untitled item with an id and pages, matching DEFAULT_STARTER content', () => {
    useEditorStore.getState().newItem();
    const it = useEditorStore.getState().currentItem!;
    expect(it.id).toMatch(/^item-/);
    expect(it.pages.length).toBe(1);
    expect(useEditorStore.getState().unsavedCount).toBe(0);
    expect(it.js).toBe(DEFAULT_STARTER.js);
  });
  it('renamePage updates the page title, marks dirty, and does not increment unsavedCount', () => {
    useEditorStore.getState().loadItem(sample());
    const pageId = useEditorStore.getState().currentItem!.pages[0].id;
    const before = useEditorStore.getState().unsavedCount;
    useEditorStore.getState().renamePage(pageId, 'Renamed');
    const it = useEditorStore.getState().currentItem!;
    expect(it.pages[0].title).toBe('Renamed');
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().unsavedCount).toBe(before);
  });

  it('forkCurrent clears id, prefixes title, marks dirty=true (FIX 3)', () => {
    useEditorStore.getState().loadItem(sample({ id: 'item-1', title: 'Orig' }));
    useEditorStore.getState().forkCurrent();
    const it = useEditorStore.getState().currentItem!;
    expect(it.id).toMatch(/^item-/);
    expect(it.id).not.toBe('item-1');
    expect(it.title).toBe('(Forked) Orig');
    // A fork is a pending change — must be treated as unsaved.
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().unsavedCount).toBe(1);
  });

  it('forkCurrent clears isReadOnly so a fork of a shared item is editable (REQ-SHR-3)', () => {
    useEditorStore.getState().loadItem(sample({ id: 'shared-1', title: 'Shared', isReadOnly: true }));
    useEditorStore.getState().forkCurrent();
    const it = useEditorStore.getState().currentItem!;
    expect(it.isReadOnly).toBeFalsy();
    // ...and it is unowned (createdBy stripped) — owned only on explicit save.
    expect(it.createdBy).toBeUndefined();
  });

  it('forkCurrent strips backend-owned sharing fields so a fork never carries a foreign share token (adversarial review)', () => {
    // Sharing fields are backend-owned (contract §3.1). A fork of a shared item must
    // not inherit the parent's isShared/shareToken/sharedAt under a new id —
    // saveLastCode/setItem persist the local copy verbatim, so a stale token would
    // leak into local storage / the `code` slot. Revert the strip → fields present → fails.
    useEditorStore.getState().loadItem(
      sample({ id: 'shared-1', title: 'Shared', isShared: true, shareToken: 'tok-abc', sharedAt: 123 } as Partial<Item>),
    );
    useEditorStore.getState().forkCurrent();
    const it = useEditorStore.getState().currentItem!;
    expect(it.isShared).toBeUndefined();
    expect(it.shareToken).toBeUndefined();
    expect(it.sharedAt).toBeUndefined();
  });

  it('loadItem resets unsavedCount and saving to prevent stale auto-save (FIX 4)', () => {
    useEditorStore.getState().loadItem(sample());
    // Accumulate unsaved edits
    useEditorStore.getState().setDsl('X');
    useEditorStore.getState().setDsl('Y');
    expect(useEditorStore.getState().unsavedCount).toBe(2);
    // Loading a new item must clear all save counters
    useEditorStore.getState().loadItem(sample({ id: 'i2', js: 'B.c' }));
    expect(useEditorStore.getState().unsavedCount).toBe(0);
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useEditorStore.getState().saving).toBe(false);
  });

  it('setMainSizes stores sizes immutably and marks dirty (FIX 5)', () => {
    useEditorStore.getState().loadItem(sample());
    useEditorStore.getState().setMainSizes([30, 70]);
    expect(useEditorStore.getState().currentItem?.mainSizes).toEqual([30, 70]);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it('switchPage marks dirty (FIX 8)', () => {
    useEditorStore.getState().loadItem(sample());
    const pageId = useEditorStore.getState().currentItem!.pages[0].id;
    expect(useEditorStore.getState().dirty).toBe(false);
    useEditorStore.getState().switchPage(pageId);
    expect(useEditorStore.getState().dirty).toBe(true);
  });
});
