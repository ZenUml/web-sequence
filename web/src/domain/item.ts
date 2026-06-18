import type { Item, Page } from './types';

// Collision-resistant page id. MUST NOT derive from a session-local counter:
// page ids are persisted and restored across reloads (REQ-PG-2), so a
// counter that resets to 0 each session would re-emit ids that already exist
// on a saved item, producing two pages with the same id (applyPageEdit/
// deletePage operate on ALL matches → silent diagram corruption).
function genId(prefix = 'p'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function migrateToPages(item: Item): Item {
  if (Array.isArray(item.pages) && item.pages.length > 0) {
    // Pages are the source of truth (REQ-DM-1); the top-level js/css are only a mirror
    // of the CURRENT page. A persisted/legacy item may carry a STALE mirror (saved out
    // of sync, or currentPageId pointing at a page whose content differs). Re-derive the
    // mirror from currentPageId on load — otherwise the editor + preview (both read
    // item.js) render a different page than the active tab ("page 2 shows page 1").
    // Fall back to the first page when currentPageId is missing/invalid.
    const current = item.pages.find((p) => p.id === item.currentPageId) ?? item.pages[0];
    return { ...item, currentPageId: current.id, js: current.js, css: current.css };
  }
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
  const idx = item.pages.findIndex((p) => p.id === pageId);
  if (idx === -1) throw new Error('Page not found');
  if (item.pages[idx].isDefault) throw new Error('Cannot delete the default page');
  const pages = item.pages.filter((p) => p.id !== pageId);
  const next: Item = { ...item, pages };
  if (item.currentPageId === pageId) {
    // Switch to the NEAREST remaining page (REQ-PG-3), matching legacy
    // app.jsx: newIndex = min(deletedIndex, remaining.length - 1). This is the
    // page that was immediately after the deleted one (or the new last page).
    const nearest = pages[Math.min(idx, pages.length - 1)];
    return switchPage(next, nearest.id);
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
