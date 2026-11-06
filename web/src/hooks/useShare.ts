import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { shareOrigin } from '../config/shareOrigin';
import { detectFromEnv } from '../app/runtimeMode';
import type { Item } from '../domain/types';

// How long the Copy button shows its "Copied ✓" confirmation before reverting.
const COPIED_RESET_MS = 1500;

// Reconstruct the public page_share URL for an already-shared item so the popover
// can open straight into the "shared — Copy / Stop sharing" state on reload/boot
// (the backend only returns the URL at create_share time; on a fresh load we have
// only the persisted isShared/shareToken fields). Mirrors the page_share host
// resolution: shareOrigin() returns the canonical app origin under the extension
// and the real window origin on the web (no trailing slash → `origin?id=…`). The
// `v=<md5>` cache-buster is intentionally omitted — md5 is not persisted on the
// item, and the share page tolerates its absence.
function reconstructShareUrl(item: Item): string | null {
  if (!item.isShared || !item.shareToken) return null;
  const origin = shareOrigin({ isExtension: detectFromEnv().isExtension });
  return `${origin}?id=${item.id}&share-token=${item.shareToken}`;
}

export interface UseShareOpts {
  // The current item's id (reactive). When it changes, url/error reset so the
  // popover never shows a stale link from a previously-shared item (advisor fix #8).
  itemId: string | null;
  getItemId: () => string | null;
  createShare: (id: string) => Promise<{ url: string; md5: string }>;
  stopSharing: (id: string) => Promise<void>;
  onBeforeShare?: () => Promise<void> | void;
}

export interface UseShareResult {
  url: string | null;
  sharing: boolean;
  error: string | null;
  // Transient confirmation: true for ~1.5s after a successful copy(), then reverts.
  // The Copy button reads this to swap its label to "Copied ✓".
  copied: boolean;
  // Share panel states. `stopping` is true while stopSharing is in flight (the link
  // stays active until the backend confirms). `failure` names which backend operation
  // failed last, so the panel can show the right guidance; `error` keeps the raw
  // message for existing callers. `copyFailed` is true when the clipboard write was
  // rejected or the Clipboard API is unavailable.
  stopping: boolean;
  failure: 'create' | 'stop' | null;
  copyFailed: boolean;
  share(): Promise<void>;
  stop(): Promise<void>;
  copy(): Promise<void>;
}

type ShareOp = 'create' | 'stop';

export function useShare(opts: UseShareOpts): UseShareResult {
  const { itemId, getItemId, createShare, stopSharing, onBeforeShare } = opts;
  const [url, setUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [failure, setFailure] = useState<'create' | 'stop' | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  // One outstanding create/stop per diagram, keyed by item id. Every pending item keeps
  // its own lock (switching A → B → A must not let A submit again), and only the
  // attempt that took a lock may release it (A finishing must not unlock B). A create
  // and a stop on the same diagram conflict, so one lock covers both.
  const pendingOps = useRef(new Map<string, { op: ShareOp; owner: object }>());
  // Backend-confirmed link state from this session, keyed by item id. The editor
  // store does not mirror create_share/stopSharing, so on return to a diagram this
  // wins over the stored isShared/shareToken (a stopped link must not reappear, and
  // a link created while the user was elsewhere must show).
  const confirmedLinks = useRef(new Map<string, string | null>());
  // Bumped on every item change and on unmount. A clipboard completion only applies
  // to the generation (and link) it started in; A → B → A is a new generation.
  const generation = useRef(0);
  const copySeq = useRef(0);
  const urlRef = useRef<string | null>(null);
  urlRef.current = url;
  // Hold the revert timer so a rapid re-copy doesn't stack timers (which would
  // flip copied back to false too early) and so we can cancel it on switch/unmount.
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCopiedTimer() {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    copiedTimer.current = null;
  }

  useEffect(() => {
    return () => {
      generation.current += 1;
      clearCopiedTimer();
    };
  }, []);

  // Reset all transient state when the active item changes, THEN hydrate it for the
  // newly-active item. Jobs:
  //  - Without the reset, opening item B after sharing item A leaves A's url/error/
  //    copied in state, so Copy would copy A's link and Stop would target the wrong
  //    item via getItemId() (advisor fix #8).
  //  - Busy state is restored from the per-item locks, so returning to a diagram with
  //    a create/stop still in flight shows it busy (and its controls disabled).
  //  - Hydration: a diagram shared in a previous session carries isShared+shareToken
  //    when re-loaded/booted. Reconstruct its page_share URL so the popover opens into
  //    the "shared — Copy / Stop sharing" state instead of "Create share link" (which
  //    would wrongly imply the diagram is private). A link confirmed or stopped in this
  //    session overrides the stored fields. Read the current item from the editor store
  //    at effect time (getState() is runtime, not module-scope — testable and SSR-safe).
  useEffect(() => {
    generation.current += 1;
    clearCopiedTimer();
    setCopied(false);
    setError(null);
    setFailure(null);
    setCopyFailed(false);
    const pending = itemId ? pendingOps.current.get(itemId) : undefined;
    setSharing(pending?.op === 'create');
    setStopping(pending?.op === 'stop');
    const item = useEditorStore.getState().currentItem;
    if (itemId && confirmedLinks.current.has(itemId)) {
      setUrl(confirmedLinks.current.get(itemId) ?? null);
    } else {
      setUrl(item ? reconstructShareUrl(item) : null);
    }
  }, [itemId]);

  function takeLock(id: string, op: ShareOp): object | null {
    if (pendingOps.current.has(id)) return null;
    const owner = {};
    pendingOps.current.set(id, { op, owner });
    return owner;
  }

  function releaseLock(id: string, owner: object) {
    if (pendingOps.current.get(id)?.owner === owner) pendingOps.current.delete(id);
  }

  async function share(): Promise<void> {
    // Capture the click-time id BEFORE any await. onBeforeShare() runs the app save,
    // during which the user can switch diagrams; the backend call always targets the
    // captured item, while UI updates apply only if that item is shown when the
    // result lands (adversarial review).
    const id = getItemId();
    if (!id) return;
    const owner = takeLock(id, 'create');
    if (!owner) return;
    setError(null);
    setFailure(null);
    setSharing(true);
    try {
      await onBeforeShare?.();
      const { url: shareUrl } = await createShare(id);
      // The link exists only once the backend has confirmed it.
      confirmedLinks.current.set(id, shareUrl);
      if (getItemId() === id) setUrl(shareUrl);
    } catch (e: unknown) {
      // A failure for the click-time item A must not surface as an error on item B.
      if (getItemId() === id) {
        setError(e instanceof Error ? e.message : String(e));
        setFailure('create');
      }
    } finally {
      releaseLock(id, owner);
      if (getItemId() === id) setSharing(false);
    }
  }

  async function stop(): Promise<void> {
    // Same discipline as share(): capture the id, lock that item, and guard every
    // post-await UI update so a late resolve/reject for A never touches B's panel.
    const id = getItemId();
    if (!id) return;
    const owner = takeLock(id, 'stop');
    if (!owner) return;
    setError(null);
    setFailure(null);
    setCopyFailed(false);
    setStopping(true);
    try {
      await stopSharing(id);
      // Only clear the link on success — a failed stop must keep the link shown so
      // the UI doesn't imply the diagram is private when it may still be public.
      confirmedLinks.current.set(id, null);
      if (getItemId() === id) {
        clearCopiedTimer();
        setUrl(null);
        setCopied(false);
      }
    } catch (e: unknown) {
      if (getItemId() === id) {
        setError(e instanceof Error ? e.message : String(e));
        setFailure('stop');
      }
    } finally {
      releaseLock(id, owner);
      if (getItemId() === id) setStopping(false);
    }
  }

  async function copy(): Promise<void> {
    const link = url;
    if (!link) return;
    if (!navigator.clipboard?.writeText) {
      setCopied(false);
      setCopyFailed(true);
      return;
    }
    // A completion applies only to the latest copy, in the same item generation, for
    // the link still shown. Anything else (switch, A → B → A, unmount, new link) is
    // inert, so it can neither confirm nor select another diagram's link.
    const gen = generation.current;
    const seq = ++copySeq.current;
    const current = () => gen === generation.current && seq === copySeq.current && urlRef.current === link;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Permission denied / insecure context: never claim a copy; the panel asks the
      // user to copy the selected link manually. Never throws to the click handler.
      if (!current()) return;
      setCopied(false);
      setCopyFailed(true);
      return;
    }
    if (!current()) return;
    // Only confirm AFTER the write resolves — a rejected/absent clipboard must
    // leave copied false so the button never claims a copy that didn't happen.
    setCopyFailed(false);
    setCopied(true);
    clearCopiedTimer();
    copiedTimer.current = setTimeout(() => {
      setCopied(false);
      copiedTimer.current = null;
    }, COPIED_RESET_MS);
  }

  return { url, sharing, error, copied, stopping, failure, copyFailed, share, stop, copy };
}
