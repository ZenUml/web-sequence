import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { parseEmbedCode } from '../app/runtimeMode';
import type { Item } from '../domain/types';

export interface BootDeps {
  idParam: string | null;
  shareToken: string | null;
  // Adversarial review finding 1: ?code= inline diagram. The embed's "Open in
  // ZenUML" link forwards the original ?code= (and ?title=) to the FULL app (no
  // ?embed), so the full-app boot must seed an editable diagram from it. Legacy
  // app.jsx read ?code= unconditionally at boot — this restores that parity.
  codeParam: string | null;
  codeTitle: string | null;
  preserveLastCode: boolean;
  getItem: (id: string) => Promise<Item>;
  getSharedItem: (id: string, token: string) => Promise<Item>;
  getLastCode: () => Promise<Item | null>;
  /**
   * Editor-as-landing telemetry seam: fired once with the resolved boot kind after
   * resolution completes (NOT on skip). AppRoot uses it to emit `landed_in_editor`
   * with bootKind. Optional so the pure resolver and existing callers are unaffected.
   */
  onResolved?: (kind: BootResult['kind']) => void;
}

export type BootResult =
  | { kind: 'shared'; item: Item }
  | { kind: 'item'; item: Item }
  | { kind: 'code'; item: Item }
  | { kind: 'lastcode'; item: Item }
  | { kind: 'share-error' }
  | { kind: 'new' };

/**
 * Pure async resolver — no store or React deps, fully testable with injected fakes.
 *
 * Decision table (REQ-PST / REQ-SHR-4):
 *  1. shareToken + idParam  → getSharedItem (read-only); error → 'share-error'
 *     (NOT 'new' — a dead share link must surface ShareErrorNotice, never silently
 *      fall back to a blank diagram. An ?id= miss in branch 2 still → 'new'.)
 *  2. idParam only          → getItem;       error → 'new'
 *  3. preserveLastCode      → getLastCode(); non-empty .js → 'lastcode', else → 'new'
 *  4. else                  → 'new'
 */
export async function resolveBootItem(deps: BootDeps): Promise<BootResult> {
  const { idParam, shareToken, codeParam, codeTitle, preserveLastCode, getItem, getSharedItem, getLastCode } = deps;

  // Branch 1: shared item (read-only)
  if (shareToken && idParam) {
    try {
      const item = await getSharedItem(idParam, shareToken);
      return { kind: 'shared', item: { ...item, isReadOnly: true } };
    } catch {
      return { kind: 'share-error' };
    }
  }

  // Branch: ?code= inline diagram (finding 1). Seeded EDITABLE (isReadOnly false)
  // and placed before preserveLastCode so an explicit inline payload wins over
  // stale last-code (legacy: `urlCode || result.code`). parseEmbedCode accepts
  // both the contract raw-DSL form and legacy `JSON.stringify(item)` links.
  if (codeParam) {
    const payload = parseEmbedCode(codeParam, codeTitle);
    const id = (globalThis.crypto?.randomUUID?.()) ?? `code-${Date.now()}`;
    const item: Item = {
      id,
      title: payload.title ?? 'Untitled',
      js: payload.js,
      css: payload.css,
      html: payload.html,
      // Finding 1 (adversarial review): honour the legacy item's pre-processor modes.
      // This is the destination of the embed "Open in ZenUML" round-trip — the link
      // forwards ?code=<JSON item> WITHOUT ?embed, landing here. Hardcoding cssMode:'css'
      // rendered an scss/less embed's source raw in the full editor (the preview only
      // transpiles when the real mode survives).
      htmlMode: payload.htmlMode,
      cssMode: payload.cssMode,
      jsMode: payload.jsMode,
      cssSettings: payload.cssSettings,
      pages: [],
      currentPageId: '',
      isReadOnly: false,
    };
    return { kind: 'code', item };
  }

  // Branch 2: owned/local item by id
  if (idParam) {
    try {
      const item = await getItem(idParam);
      return { kind: 'item', item };
    } catch {
      return { kind: 'new' };
    }
  }

  // Branch 3: last-code restore
  if (preserveLastCode) {
    try {
      const item = await getLastCode();
      if (item && item.js) {
        return { kind: 'lastcode', item };
      }
    } catch {
      // fall through
    }
    return { kind: 'new' };
  }

  // Branch 4: fresh start
  return { kind: 'new' };
}

export interface UseBootItemResult {
  // REQ-SHR-4: true when the boot shared-link load failed. AppRoot renders
  // ShareErrorNotice (no item is seeded for this kind — the guard must not
  // silently fall back to a blank new diagram).
  shareError: boolean;
  clearShareError(): void;
}

/**
 * Hook that resolves the boot item once auth is ready and applies it to the editor store.
 * Guards with a ref so it only fires once regardless of StrictMode double-invocation.
 * authReady must be true before resolution begins — prevents a race where auth is null
 * at mount and a ?id= item silently falls back to 'new' before auth resolves.
 */
export function useBootItem(deps: BootDeps, authReady: boolean, skip = false): UseBootItemResult {
  const booted = useRef(false);
  const loadItem = useEditorStore((s) => s.loadItem);
  const newItem = useEditorStore((s) => s.newItem);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    // M05 (REQ-EMB-1): embed-by-value (?embed&code=) seeds the item from the inline DSL
    // in AppRoot WITHOUT any Firestore/share read — skip the normal boot resolution so
    // getItem/getSharedItem are never called for an embed-by-value URL.
    if (skip) return;
    if (!authReady || booted.current) return;
    booted.current = true;

    resolveBootItem(deps).then((result) => {
      switch (result.kind) {
        case 'shared':
        case 'item':
        case 'code':
        case 'lastcode':
          loadItem(result.item);
          break;
        case 'share-error':
          // Do NOT seed an item — AppRoot surfaces ShareErrorNotice (REQ-SHR-4).
          setShareError(true);
          break;
        case 'new':
          newItem();
          break;
      }
      deps.onResolved?.(result.kind);
    }).catch(() => {
      // Unexpected error — fall back to new
      newItem();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  return { shareError, clearShareError: () => setShareError(false) };
}
