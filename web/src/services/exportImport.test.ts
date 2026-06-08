import { describe, it, expect } from 'vitest';
import { exportAllItemsJson, parseImportJson, buildStandaloneHtml } from './exportImport';
import type { Item } from '../domain/types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1', title: 'T', js: 'A.b', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', ...over,
});

describe('exportImport', () => {
  it('exportAllItemsJson round-trips through parseImportJson', () => {
    const json = exportAllItemsJson([item({ id: 'a' }), item({ id: 'b' })]);
    const back = parseImportJson(json);
    expect(back.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(back[0].pages.length).toBe(1); // migrated
  });
  it('parseImportJson accepts a single object and a {items:{}} map', () => {
    expect(parseImportJson(JSON.stringify(item({ id: 'solo' }))).map((i) => i.id)).toEqual(['solo']);
    expect(parseImportJson(JSON.stringify({ items: { x: item({ id: 'x' }) } })).map((i) => i.id)).toEqual(['x']);
  });
  it('parseImportJson throws on invalid JSON', () => {
    expect(() => parseImportJson('not json')).toThrow();
  });
  it('parseImportJson drops id-less items so they never write items/undefined', () => {
    // A foreign/hand-edited file: one valid item, one with no id, one with empty id.
    const withId = item({ id: 'keep' });
    const noId = { title: 'orphan', js: 'X.y' };
    const emptyId = item({ id: '' });
    const parsed = parseImportJson(JSON.stringify({ items: [withId, noId, emptyId] }));
    expect(parsed.map((i) => i.id)).toEqual(['keep']);
  });
  it('parseImportJson returns nothing for an all-id-less file', () => {
    expect(parseImportJson(JSON.stringify([{ title: 'a' }, { title: 'b' }]))).toEqual([]);
  });
  it('buildStandaloneHtml embeds the DSL and is a full HTML document', () => {
    const html = buildStandaloneHtml(item({ js: 'Alice->Bob: Hi' }));
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toContain('Alice-&gt;Bob: Hi'); // DSL is HTML-escaped into the document
  });
});
