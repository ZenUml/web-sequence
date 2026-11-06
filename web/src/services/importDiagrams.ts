import { parseImportJson } from './exportImport';
import type { Item } from '../domain/types';

export type InvalidImportReason = 'invalid-json' | 'no-diagrams';

export type ImportAnalysis =
  | { kind: 'invalid'; reason: InvalidImportReason }
  | {
      kind: 'ready';
      // Keyed by diagram id: duplicate entries collapse (last wins), matching the
      // legacy merge-by-id map AppRoot built before saveItems.
      items: Record<string, Item>;
      addedIds: string[];
      updatedIds: string[];
    };

// Classifies an import file without touching storage. Accepted forms and per-item
// normalisation (id filter, multi-page migration) stay in parseImportJson; this only
// separates "not JSON" from "JSON with nothing importable" and counts UNIQUE ids
// against the caller's existing ids, so feedback never reports duplicate entries or
// the file's total entry count as newly added.
export function analyzeImport(text: string, existingIds: ReadonlySet<string>): ImportAnalysis {
  try {
    JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'invalid-json' };
  }
  let parsed: Item[];
  try {
    parsed = parseImportJson(text);
  } catch {
    // Valid JSON in an unsupported shape (e.g. {"items": null}).
    return { kind: 'invalid', reason: 'no-diagrams' };
  }
  const items: Record<string, Item> = {};
  for (const it of parsed) items[it.id] = it;
  const ids = Object.keys(items);
  if (ids.length === 0) return { kind: 'invalid', reason: 'no-diagrams' };
  return {
    kind: 'ready',
    items,
    addedIds: ids.filter((id) => !existingIds.has(id)),
    updatedIds: ids.filter((id) => existingIds.has(id)),
  };
}
