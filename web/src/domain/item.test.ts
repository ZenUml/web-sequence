import { describe, it, expect } from 'vitest';
import { migrateToPages, applyPageEdit, addPage, deletePage, switchPage } from './item';
import type { Item } from './types';

const base = (over: Partial<Item> = {}): Item => ({
  id: 'i1', title: 'T', js: 'A.b', css: '.x{}', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js',
  pages: [], currentPageId: '', ...over,
});

describe('migrateToPages', () => {
  it('creates a default page from item js/css when pages missing', () => {
    const m = migrateToPages(base({ pages: [], currentPageId: '' }));
    expect(m.pages).toHaveLength(1);
    expect(m.pages[0]).toMatchObject({ title: 'Page 1', js: 'A.b', css: '.x{}', isDefault: true });
    expect(m.currentPageId).toBe(m.pages[0].id);
  });
  it('leaves the pages array untouched when pages already exist (consistent mirror)', () => {
    const item = base({
      js: 'x', css: '',
      pages: [{ id: 'p1', title: 'P', js: 'x', css: '', isDefault: true }],
      currentPageId: 'p1',
    });
    expect(migrateToPages(item)).toEqual(item);
  });
  // REGRESSION (page 2 showing page 1): pages[] are the source of truth (REQ-DM-1);
  // a persisted/legacy item may carry a STALE top-level js/css mirror. Loading must
  // re-derive js/css from currentPageId so the editor and preview (both read item.js)
  // can never render a different page than the active tab.
  it('reconciles a STALE top-level js/css mirror to the current page', () => {
    const item = base({
      js: 'PAGE_ONE', css: '.one{}',                 // stale mirror = page 1
      pages: [
        { id: 'p1', title: 'Page 1', js: 'PAGE_ONE', css: '.one{}', isDefault: true },
        { id: 'p2', title: 'Page 2', js: 'PAGE_TWO', css: '.two{}' },
      ],
      currentPageId: 'p2',                            // active page = 2
    });
    const m = migrateToPages(item);
    expect(m.js).toBe('PAGE_TWO');
    expect(m.css).toBe('.two{}');
    expect(m.currentPageId).toBe('p2');
    expect(m.pages).toHaveLength(2);                  // pages array untouched
  });
  it('falls back to the first page when currentPageId is missing/invalid', () => {
    const item = base({
      js: 'STALE', css: '',
      pages: [
        { id: 'p1', title: 'Page 1', js: 'FIRST', css: '', isDefault: true },
        { id: 'p2', title: 'Page 2', js: 'SECOND', css: '' },
      ],
      currentPageId: 'does-not-exist',
    });
    const m = migrateToPages(item);
    expect(m.currentPageId).toBe('p1');
    expect(m.js).toBe('FIRST');
  });
});

describe('applyPageEdit dual-write', () => {
  it('updates the page AND mirrors to item-level js/css for the current page', () => {
    const item = migrateToPages(base());
    const pid = item.currentPageId;
    const next = applyPageEdit(item, pid, { js: 'C.d' });
    expect(next.pages[0].js).toBe('C.d');
    expect(next.js).toBe('C.d'); // mirror (REQ-DM-1)
  });
  it('does not mirror when editing a non-current page', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'Two');           // switches to page 2
    const firstPid = item.pages[0].id;
    const next = applyPageEdit(item, firstPid, { js: 'ZZ' });
    expect(next.pages[0].js).toBe('ZZ');
    expect(next.js).not.toBe('ZZ');        // current is page 2, no mirror
  });
});

describe('addPage', () => {
  it('appends a non-default page and switches to it', () => {
    const item = migrateToPages(base());
    const next = addPage(item);
    expect(next.pages).toHaveLength(2);
    expect(next.pages[1].isDefault).toBeFalsy();
    expect(next.currentPageId).toBe(next.pages[1].id);
  });
});

describe('deletePage', () => {
  it('refuses to delete the only page', () => {
    const item = migrateToPages(base());
    expect(() => deletePage(item, item.currentPageId)).toThrow();
  });
  it('refuses to delete the default page', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'Two');
    const defaultId = item.pages[0].id;
    expect(() => deletePage(item, defaultId)).toThrow();
  });
  it('deletes a non-default page and switches to the default when active was removed', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'Two'); // active = page2
    const page2 = item.currentPageId;
    const next = deletePage(item, page2);
    expect(next.pages).toHaveLength(1);
    expect(next.currentPageId).toBe(next.pages[0].id);
  });
  it('switches to the NEAREST remaining page (not always the default) when the active page is deleted (REQ-PG-3)', () => {
    let item = migrateToPages(base()); // [default]
    item = addPage(item, 'A');         // [default, A]
    item = addPage(item, 'B');         // [default, A, B]
    item = addPage(item, 'C');         // [default, A, B, C]
    const [, , pB, pC] = item.pages;
    // Active = middle page B; deleting it lands on the page that was immediately
    // after it (C), matching legacy Math.min(idx, remaining-1) — NOT the default.
    item = switchPage(item, pB.id);
    let next = deletePage(item, pB.id);
    expect(next.currentPageId).toBe(pC.id);
    // Active = last page C; deleting it lands on the new last page (the old neighbour).
    item = switchPage(item, pC.id);
    const neighbourOfC = item.pages[item.pages.length - 2];
    next = deletePage(item, pC.id);
    expect(next.currentPageId).toBe(neighbourOfC.id);
  });
  it('does not change currentPageId when a non-active page is deleted', () => {
    let item = migrateToPages(base());
    item = addPage(item, 'A');
    item = addPage(item, 'B'); // active = B
    const active = item.currentPageId;
    const pA = item.pages[1];
    const next = deletePage(item, pA.id); // delete non-active A
    expect(next.currentPageId).toBe(active);
  });
});

describe('genId / page id uniqueness (no session-reset collisions)', () => {
  it('assigns a unique id to every page across many adds', () => {
    let item = migrateToPages(base());
    for (let i = 0; i < 50; i++) item = addPage(item, `P${i}`);
    const ids = item.pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('switchPage', () => {
  it('sets currentPageId and mirrors that page content to item-level', () => {
    let item = migrateToPages(base());      // page1 js='A.b'
    item = addPage(item, 'Two');            // page2, current
    item = applyPageEdit(item, item.currentPageId, { js: 'PAGE2' });
    const back = switchPage(item, item.pages[0].id);
    expect(back.currentPageId).toBe(item.pages[0].id);
    expect(back.js).toBe('A.b');            // mirror of newly-active page
  });
});
