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
  it('forkCurrent clears id, prefixes title, resets unsavedCount', () => {
    useEditorStore.getState().loadItem(sample({ id: 'item-1', title: 'Orig' }));
    useEditorStore.getState().forkCurrent();
    const it = useEditorStore.getState().currentItem!;
    expect(it.id).toMatch(/^item-/);
    expect(it.id).not.toBe('item-1');
    expect(it.title).toBe('(Forked) Orig');
  });
});
