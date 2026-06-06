import { create } from 'zustand';
import type { Item, HtmlMode, CssMode, JsMode } from '../domain/types';
import { applyPageEdit, switchPage, addPage, deletePage, migrateToPages } from '../domain/item';

// Default content for a brand-new item, sourced from the M01 AppRoot STARTER.
// Task 12 will make AppRoot import this instead of its local constant.
export const DEFAULT_STARTER = {
  title: 'Untitled',
  js: 'A.SyncMessage\nA->B: AsyncMessage',
  css: '',
  html: '',
  htmlMode: 'html' as HtmlMode,
  cssMode: 'css' as CssMode,
  jsMode: 'js' as JsMode,
};

// Collision-resistant item id, consistent with item.ts's genId() approach.
export function genItemId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `item-${uuid}`;
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface EditorState {
  currentItem: Item | null;
  dirty: boolean;
  // unsavedCount tracks code/content edits since the last save (setDsl/setCss increments it).
  // Title/id metadata edits set dirty but do NOT increment unsavedCount — those are
  // lightweight metadata changes that don't represent "code work" to the autosave heuristic.
  unsavedCount: number;
  saving: boolean;
  loadItem(item: Item): void;
  setDsl(js: string): void;
  setCss(css: string): void;
  setJsMode(m: JsMode): void;
  setCssMode(m: CssMode): void;
  setHtmlMode(m: HtmlMode): void;
  addPage(title?: string): void;
  deletePage(pageId: string): void;
  switchPage(pageId: string): void;
  renamePage(pageId: string, title: string): void;
  reset(): void;
  markSaved(): void;
  setSaving(b: boolean): void;
  setTitle(title: string): void;
  setItemId(id: string): void;
  newItem(): void;
  forkCurrent(): void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentItem: null,
  dirty: false,
  unsavedCount: 0,
  saving: false,
  loadItem: (item) => set({ currentItem: migrateToPages(item), dirty: false }),
  setDsl: (js) => set((s) => s.currentItem
    ? { currentItem: applyPageEdit(s.currentItem, s.currentItem.currentPageId, { js }), dirty: true, unsavedCount: s.unsavedCount + 1 } : s),
  setCss: (css) => set((s) => s.currentItem
    ? { currentItem: applyPageEdit(s.currentItem, s.currentItem.currentPageId, { css }), dirty: true, unsavedCount: s.unsavedCount + 1 } : s),
  setJsMode: (jsMode) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, jsMode }, dirty: true } : s),
  setCssMode: (cssMode) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, cssMode }, dirty: true } : s),
  setHtmlMode: (htmlMode) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, htmlMode }, dirty: true } : s),
  addPage: (title) => set((s) => s.currentItem ? { currentItem: addPage(s.currentItem, title), dirty: true } : s),
  deletePage: (pageId) => set((s) => s.currentItem ? { currentItem: deletePage(s.currentItem, pageId), dirty: true } : s),
  switchPage: (pageId) => set((s) => s.currentItem ? { currentItem: switchPage(s.currentItem, pageId) } : s),
  // Rename is a metadata edit: dirty=true, unsavedCount unchanged (same pattern as setTitle).
  renamePage: (pageId, title) => set((s) => s.currentItem
    ? { currentItem: applyPageEdit(s.currentItem, pageId, { title }), dirty: true } : s),
  reset: () => set({ currentItem: null, dirty: false, unsavedCount: 0, saving: false }),
  markSaved: () => set({ dirty: false, unsavedCount: 0 }),
  setSaving: (saving) => set({ saving }),
  // Title/id changes are metadata edits: mark dirty so save is triggered, but do not
  // increment unsavedCount (which tracks content edits for autosave debounce logic).
  setTitle: (title) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, title }, dirty: true } : s),
  setItemId: (id) => set((s) => s.currentItem ? { currentItem: { ...s.currentItem, id }, dirty: true } : s),
  newItem: () => {
    const fresh = migrateToPages({
      id: genItemId(),
      ...DEFAULT_STARTER,
      pages: [],
      currentPageId: '',
    });
    set({ currentItem: fresh, dirty: false, unsavedCount: 0, saving: false });
  },
  forkCurrent: () => set((s) => {
    if (!s.currentItem) return s;
    // Deep-clone via JSON round-trip (Item contains only serializable fields).
    const cloned: Item = JSON.parse(JSON.stringify(s.currentItem));
    cloned.id = genItemId();
    cloned.title = `(Forked) ${s.currentItem.title}`;
    cloned.updatedOn = Date.now();
    // A fork is unowned until the user explicitly saves it.
    delete cloned.createdBy;
    return { currentItem: cloned, dirty: false, unsavedCount: 0, saving: false };
  }),
}));
