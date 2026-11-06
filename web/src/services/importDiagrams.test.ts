import { describe, it, expect } from 'vitest';
import { analyzeImport } from './importDiagrams';
import type { Item } from '../domain/types';

// Local fixture only — shape of a real Export all file (exportAllItemsJson).
function item(over: Partial<Item> = {}): Item {
  return {
    id: 'a',
    title: 'Diagram',
    js: 'A.b()',
    css: '.x{}',
    updatedOn: 1,
    ...over,
  } as Item;
}

describe('analyzeImport', () => {
  it('reports invalid JSON without throwing a raw parser error', () => {
    expect(analyzeImport('not json', new Set())).toEqual({ kind: 'invalid', reason: 'invalid-json' });
  });

  it('reports an empty export as having no importable diagrams', () => {
    expect(analyzeImport('{"items":[]}', new Set())).toEqual({ kind: 'invalid', reason: 'no-diagrams' });
    expect(analyzeImport('[]', new Set())).toEqual({ kind: 'invalid', reason: 'no-diagrams' });
  });

  it('reports an unsupported JSON shape (no id-bearing items) as no-diagrams, not success', () => {
    expect(analyzeImport('{"hello":"world"}', new Set())).toEqual({ kind: 'invalid', reason: 'no-diagrams' });
    expect(analyzeImport('null', new Set())).toEqual({ kind: 'invalid', reason: 'no-diagrams' });
    expect(analyzeImport('42', new Set())).toEqual({ kind: 'invalid', reason: 'no-diagrams' });
    // items: null makes Object.values throw inside the legacy parser.
    expect(analyzeImport('{"items":null}', new Set())).toEqual({ kind: 'invalid', reason: 'no-diagrams' });
  });

  it('accepts every legacy form: array, {items:[]}, {items:{}} map and a single item', () => {
    const forms = [
      JSON.stringify([item({ id: 'x' })]),
      JSON.stringify({ items: [item({ id: 'x' })] }),
      JSON.stringify({ items: { x: item({ id: 'x' }) } }),
      JSON.stringify(item({ id: 'x' })),
    ];
    for (const text of forms) {
      const r = analyzeImport(text, new Set());
      expect(r.kind).toBe('ready');
      if (r.kind === 'ready') expect(Object.keys(r.items)).toEqual(['x']);
    }
  });

  it('separates newly added from updated ids and counts unique ids, not duplicate entries', () => {
    const text = JSON.stringify({
      items: [
        item({ id: 'new-1' }),
        item({ id: 'new-1', title: 'dup entry, last wins' }),
        item({ id: 'old-1' }),
        item({ id: 'old-1' }),
        item({ id: 'new-2' }),
      ],
    });
    const r = analyzeImport(text, new Set(['old-1', 'unrelated']));
    expect(r.kind).toBe('ready');
    if (r.kind !== 'ready') return;
    expect(r.addedIds.sort()).toEqual(['new-1', 'new-2']);
    expect(r.updatedIds).toEqual(['old-1']);
    expect(Object.keys(r.items).sort()).toEqual(['new-1', 'new-2', 'old-1']);
    expect(r.items['new-1'].title).toBe('dup entry, last wins');
  });

  it('treats an all-existing file as a valid update-only import', () => {
    const r = analyzeImport(JSON.stringify([item({ id: 'a' })]), new Set(['a']));
    expect(r).toMatchObject({ kind: 'ready', addedIds: [], updatedIds: ['a'] });
  });

  it('preserves ids, content and styles, and migrates legacy single-page items to pages', () => {
    const legacy = item({ id: 'keep-me', js: 'Alice->Bob: hi', css: '.zenuml{color:red}' });
    const r = analyzeImport(JSON.stringify([legacy]), new Set());
    if (r.kind !== 'ready') throw new Error('expected ready');
    const out = r.items['keep-me'];
    expect(out.id).toBe('keep-me');
    expect(out.js).toBe('Alice->Bob: hi');
    expect(out.css).toBe('.zenuml{color:red}');
    expect(Array.isArray(out.pages)).toBe(true);
  });
});
