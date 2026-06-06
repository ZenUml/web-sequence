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
