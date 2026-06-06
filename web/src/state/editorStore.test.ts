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
