import { useEffect, useRef, useState } from 'react';

// How long the Copy button shows its "Copied ✓" confirmation before reverting.
const COPIED_RESET_MS = 1500;

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

  // Reset url/error when the active item changes. Without this, opening item B after
  // sharing item A leaves A's url/error in state, so Copy would copy A's link and
  // Stop would target the wrong item via getItemId() (advisor fix #8).
  useEffect(() => {
    setUrl(null);
    setError(null);
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
