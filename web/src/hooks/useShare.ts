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
  share(): Promise<void>;
  stop(): Promise<void>;
  copy(): Promise<void>;
}

export function useShare(opts: UseShareOpts): UseShareResult {
  const { itemId, getItemId, createShare, stopSharing, onBeforeShare } = opts;
  const [url, setUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Hold the revert timer so a rapid re-copy doesn't stack timers (which would
  // flip copied back to false too early) and so we can cancel it on unmount.
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);

  // Reset url/error when the active item changes, THEN hydrate the url from the
  // newly-active item if it is already shared. Two jobs:
  //  - Without the reset, opening item B after sharing item A leaves A's url/error in
  //    state, so Copy would copy A's link and Stop would target the wrong item via
  //    getItemId() (advisor fix #8).
  //  - Hydration: a diagram shared in a previous session carries isShared+shareToken
  //    when re-loaded/booted. Reconstruct its page_share URL so the popover opens into
  //    the "shared — Copy / Stop sharing" state instead of "Create share link" (which
  //    would wrongly imply the diagram is private). Read the current item from the
  //    editor store at effect time (getState() is runtime, not module-scope — testable
  //    and SSR-safe). Known limitation: an IN-SESSION share() does not write isShared/
  //    shareToken onto the local item (those are backend-owned, written only by
  //    create_share), so switching away and back within the same session won't
  //    re-hydrate until a reload re-reads the item from the backend.
  useEffect(() => {
    setError(null);
    const item = useEditorStore.getState().currentItem;
    setUrl(item ? reconstructShareUrl(item) : null);
  }, [itemId]);

  async function share(): Promise<void> {
    // Capture the click-time id BEFORE any await. onBeforeShare() runs the app save,
    // during which the user can switch diagrams; reading getItemId() afterwards would
    // target the now-current item (404 if it was never saved). Guard the late setUrl
    // too: if the active item changed while createShare was in flight, don't repopulate
    // the popover for an item that is no longer shown (defeats the itemId reset effect)
    // (adversarial review).
    const id = getItemId();
    if (!id) return;
    setError(null);
    setSharing(true);
    try {
      await onBeforeShare?.();
      const { url: shareUrl } = await createShare(id);
      if (getItemId() === id) setUrl(shareUrl);
    } catch (e: unknown) {
      // Guard like the setUrl above: a failure for the click-time item A must not
      // surface as an error on item B if the user switched mid-flight (the reset
      // effect clears error on switch; this avoids re-populating it) (adversarial review).
      if (getItemId() === id)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }

  async function stop(): Promise<void> {
    // Capture the click-time id BEFORE the await, then guard the entire post-await
    // block with `getItemId() === id` — same discipline as share(). stopSharing(id)
    // awaits, during which the user can switch from item A to item B; the itemId
    // reset effect then clears B's url/error. Without the guard a late resolve/reject
    // for A would re-populate B's popover: a stale "Stop failed" error or a url=null
    // attributed to the wrong item (adversarial review).
    const id = getItemId();
    if (!id) return;
    setError(null);
    try {
      await stopSharing(id);
      // Only clear the link on success — a failed stop must keep the link shown so
      // the UI doesn't imply the diagram is private when it may still be public.
      if (getItemId() === id) setUrl(null);
    } catch (e: unknown) {
      if (getItemId() === id)
        setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function copy(): Promise<void> {
    if (url && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      // Only confirm AFTER the write resolves — a rejected/absent clipboard must
      // leave copied false so the button never claims a copy that didn't happen.
      setCopied(true);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        setCopied(false);
        copiedTimer.current = null;
      }, COPIED_RESET_MS);
    }
  }

  return { url, sharing, error, copied, share, stop, copy };
}
