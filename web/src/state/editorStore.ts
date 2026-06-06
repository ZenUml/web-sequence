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

export const useEditorStore = create<EditorState>((set) => ({
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
