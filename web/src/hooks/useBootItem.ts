import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { parseEmbedCode } from '../app/runtimeMode';
import type { Item } from '../domain/types';
import { randomId } from '../domain/id';
import { classifySharedItemFailure, type SharedItemFailure } from '../services/sharedItemError';

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
  // failure: 'unavailable' only for an explicit backend refusal (400/403/404…);
  // network/5xx/unknown errors are 'retryable' (see services/sharedItemError).
  | { kind: 'share-error'; failure: SharedItemFailure }
  | { kind: 'item-error' }
  | { kind: 'new' };

/**
 * Pure async resolver — no store or React deps, fully testable with injected fakes.
 *
 * Decision table (REQ-PST / REQ-SHR-4):
 *  1. shareToken + idParam  → getSharedItem (read-only); error → 'share-error'
 *     (NOT 'new' — a failed share link must never silently fall back to a blank
 *      diagram. An ?id= miss in branch 2 still → 'new'.) `failure` says whether the
 *      link is explicitly unavailable (ShareErrorNotice) or the read may be retried.
 *  2. idParam only          → getItem;       error → last-code draft with this id
 *                              (preserveLastCode only) → 'lastcode', else → 'new'
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
    } catch (error) {
      return { kind: 'share-error', failure: classifySharedItemFailure(error) };
    }
  }

  // Branch: ?code= inline diagram (finding 1). Seeded EDITABLE (isReadOnly false)
  // and placed before preserveLastCode so an explicit inline payload wins over
  // stale last-code (legacy: `urlCode || result.code`). parseEmbedCode accepts
  // both the contract raw-DSL form and legacy `JSON.stringify(item)` links.
  if (codeParam) {
    const payload = parseEmbedCode(codeParam, codeTitle);
    const id = randomId();
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
      // A never-saved diagram (e.g. a blank one from New) exists only in the local
      // last-code slot. If that draft IS this ?id=, restore it — even when blank —
      // instead of swapping in the sample under a different id.
      if (preserveLastCode) {
        try {
          const draft = await getLastCode();
          if (draft && draft.id === idParam) return { kind: 'lastcode', item: draft };
        } catch {
          // fall through
        }
      }
      return { kind: 'item-error' };
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

/**
 * Shared-link visitor boot state (?id=&share-token=, not embed-by-value):
 *  - idle            — not a shared boot, or the visitor navigated away from it
 *  - loading         — the shared read is pending (also while waiting for authReady)
 *  - retryable-error — temporary/unknown failure; retryShare() may succeed
 *  - unavailable     — explicit dead/revoked/no-access link (ShareErrorNotice)
 *  - loaded          — the read-only shared item is in the editor store
 */
export type ShareStatus = 'idle' | 'loading' | 'retryable-error' | 'unavailable' | 'loaded';

export interface UseBootItemResult {
  // REQ-SHR-4: true when the boot shared-link is explicitly unavailable. AppRoot
  // renders ShareErrorNotice (no item is seeded for this kind — the guard must not
  // silently fall back to a blank new diagram). Same as shareStatus==='unavailable'.
  shareError: boolean;
  clearShareError(): void;
  /** A requested owned/local item could not be loaded. */
  itemError: boolean;
  clearItemError(): void;
  shareStatus: ShareStatus;
  // Fresh request with the CURRENT id/share-token. No-op unless the last attempt
  // failed retryably, so repeated clicks cannot stack requests.
  retryShare(): void;
}

// Identity of a shared target: the visitor is on ?id=&share-token= (not skipped).
// null when the URL is not a shared-link visit.
function shareTargetKey(deps: BootDeps, skip: boolean): string | null {
  return !skip && deps.idParam && deps.shareToken ? `${deps.idParam}\u0000${deps.shareToken}` : null;
}

/**
 * Hook that resolves the boot item once auth is ready and applies it to the editor store.
 * authReady must be true before resolution begins — prevents a race where auth is null
 * at mount and a ?id= item silently falls back to 'new' before auth resolves.
 *
 * Non-shared boots (owned ?id=, ?code=, last-code, new) still resolve ONCE per mount
 * (StrictMode-safe ref guard).
 *
 * Shared-link visits are keyed by their target (id + share token), not by mount: every
 * time the URL enters a shared target — first visit, or browser Back/Forward onto it
 * from the hub or an owned diagram — the read runs again with that id/token, so
 * revocation is re-checked and the page is never left blank. Each read takes a new
 * sequence number; leaving or changing the target bumps it. A completion is applied
 * only if it is still the latest read, the hook is still mounted, and the editor item
 * is the same one that was there when the read started (nothing opened meanwhile).
 */
export function useBootItem(deps: BootDeps, authReady: boolean, skip = false): UseBootItemResult {
  const booted = useRef(false);
  const loadItem = useEditorStore((s) => s.loadItem);
  const newItem = useEditorStore((s) => s.newItem);
  const [itemError, setItemError] = useState(false);

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const targetKey = shareTargetKey(deps, skip);

  const [shareStatus, setShareStatusState] = useState<ShareStatus>(() =>
    targetKey !== null ? 'loading' : 'idle');
  // Synchronous mirror so two retries in the same tick see 'loading'.
  const statusRef = useRef(shareStatus);
  const setShareStatus = (next: ShareStatus) => {
    statusRef.current = next;
    setShareStatusState(next);
  };

  // Entering/leaving/changing a shared target resets the status IN THE SAME RENDER
  // (React's "adjust state on prop change" pattern), so AppRoot never paints one
  // frame of a stale/owner item under a share URL before the effect runs.
  const [renderedKey, setRenderedKey] = useState(targetKey);
  if (renderedKey !== targetKey) {
    setRenderedKey(targetKey);
    const next: ShareStatus = targetKey !== null ? 'loading' : 'idle';
    statusRef.current = next;
    setShareStatusState(next);
  }

  const requestSeq = useRef(0);
  const mounted = useRef(false);
  // Target whose read has been started (StrictMode / re-render guard). Cleared on
  // leaving the target so re-entry reads again.
  const requestedKey = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const isCurrent = (seq: number) => mounted.current && seq === requestSeq.current;

  // landed_in_editor seam: onResolved fires once per mount, for the first boot read
  // that actually lands (a cancelled owned boot does not count).
  const bootReported = useRef(false);
  const reportLanding = (kind: BootResult['kind']) => {
    if (bootReported.current) return;
    bootReported.current = true;
    depsRef.current.onResolved?.(kind);
  };

  // One shared read for the CURRENT id/token. `reportBoot` is false for retries, which
  // never report the landing.
  const readShared = (reportBoot: boolean) => {
    const { idParam, shareToken } = depsRef.current;
    if (!idParam || !shareToken) return;
    const seq = ++requestSeq.current;
    const startItem = useEditorStore.getState().currentItem;
    resolveBootItem({ ...depsRef.current, idParam, shareToken })
      .then((result) => {
        if (!isCurrent(seq)) return; // left / superseded / unmounted: drop silently
        if (result.kind === 'shared') {
          // Never replace an item that was opened while this read was pending.
          if (useEditorStore.getState().currentItem !== startItem) {
            setShareStatus('idle');
            return;
          }
          loadItem(result.item);
          setShareStatus('loaded');
        } else if (result.kind === 'share-error') {
          setShareStatus(result.failure === 'unavailable' ? 'unavailable' : 'retryable-error');
        }
        if (reportBoot) reportLanding(result.kind);
      })
      .catch(() => {
        // A shared visitor must never get a blank editable diagram: offer retry.
        if (isCurrent(seq)) setShareStatus('retryable-error');
      });
  };

  // Shared target lifecycle: (re)read on entry once auth is ready; cancel on exit.
  useEffect(() => {
    if (targetKey === null) {
      if (requestedKey.current !== null) {
        requestedKey.current = null;
        requestSeq.current += 1; // drop any in-flight read
      }
      return;
    }
    if (requestedKey.current !== null && requestedKey.current !== targetKey) {
      requestedKey.current = null;
      requestSeq.current += 1; // switched straight to another target
    }
    if (!authReady || requestedKey.current === targetKey) return;
    requestedKey.current = targetKey;
    booted.current = true;
    readShared(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, targetKey]);

  // Owned (non-shared) boot ownership. The boot read is cancelled the moment the route
  // enters a shared target: its late result must never load owner content or seed a
  // blank diagram under a share URL, and must not change the editor item that the
  // shared read compares against. `targetKeyNow` is updated during render so a
  // completion that lands before the effects run still sees the new route.
  const ownedSeq = useRef(0);
  const ownedBoot = useRef<{ route: string; state: 'pending' | 'done' | 'cancelled' } | null>(null);
  const targetKeyNow = useRef(targetKey);
  targetKeyNow.current = targetKey;
  if (targetKey !== null && ownedBoot.current?.state === 'pending') {
    ownedBoot.current.state = 'cancelled';
    ownedSeq.current += 1;
  }

  // Non-shared boot: resolve once per mount. If that boot was cancelled by entering a
  // shared target, it runs again (fresh request, same contract) only when the route
  // returns to the SAME non-shared target it was booting; anything else (the hub,
  // another diagram opened deliberately) is left as the user made it.
  useEffect(() => {
    // M05 (REQ-EMB-1): embed-by-value (?embed&code=) seeds the item from the inline DSL
    // in AppRoot WITHOUT any Firestore/share read — skip the normal boot resolution so
    // getItem/getSharedItem are never called for an embed-by-value URL.
    if (skip || targetKey !== null || !authReady) return;
    const d = depsRef.current;
    const route = `${d.idParam ?? ''}\u0000${d.codeParam ?? ''}`;
    const prior = ownedBoot.current;
    if (prior ? prior.state !== 'cancelled' || prior.route !== route : booted.current) return;
    booted.current = true;
    const seq = ++ownedSeq.current;
    const boot = { route, state: 'pending' as 'pending' | 'done' | 'cancelled' };
    ownedBoot.current = boot;
    // Applies only while this is the latest owned boot, the hook is mounted, and the
    // route is not a shared target.
    const owns = () => mounted.current && seq === ownedSeq.current && targetKeyNow.current === null;

    resolveBootItem(d).then((result) => {
      if (!owns()) return;
      boot.state = 'done';
      switch (result.kind) {
        case 'shared':
        case 'item':
        case 'code':
        case 'lastcode':
          loadItem(result.item);
          break;
        case 'share-error':
          // Unreachable without share params (handled above); never seed an item.
          break;
        case 'item-error':
          // A URL asked for a specific diagram. Do not replace its failed load with
          // a starter diagram; that makes an access problem look like a renderer bug.
          setItemError(true);
          break;
        case 'new':
          newItem();
          break;
      }
      reportLanding(result.kind);
    }).catch(() => {
      if (!owns()) return;
      boot.state = 'done';
      // Unexpected error — fall back to new
      newItem();
    });
    // [authReady, targetKey]: a mount that starts on the hub or a share URL still does
    // not boot later on route changes (guarded above); only a cancelled boot re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, targetKey]);

  const retryShare = () => {
    if (statusRef.current !== 'retryable-error' || targetKey === null) return;
    setShareStatus('loading');
    // Same resolver as boot (branch 1) with the current share id/token. The boot
    // analytics event already fired; a retry outcome does not re-fire it.
    readShared(false);
  };

  return {
    shareError: shareStatus === 'unavailable',
    clearShareError: () => setShareStatus('idle'),
    itemError,
    clearItemError: () => setItemError(false),
    shareStatus,
    retryShare,
  };
}
