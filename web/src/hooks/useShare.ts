import { useEffect, useState } from 'react';

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
  share(): Promise<void>;
  stop(): Promise<void>;
  copy(): Promise<void>;
}

export function useShare(opts: UseShareOpts): UseShareResult {
  const { itemId, getItemId, createShare, stopSharing, onBeforeShare } = opts;
  const [url, setUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset url/error when the active item changes. Without this, opening item B after
  // sharing item A leaves A's url/error in state, so Copy would copy A's link and
  // Stop would target the wrong item via getItemId() (advisor fix #8).
  useEffect(() => {
    setUrl(null);
    setError(null);
  }, [itemId]);

  async function share(): Promise<void> {
    setError(null);
    setSharing(true);
    try {
      await onBeforeShare?.();
      const id = getItemId();
      if (!id) return;
      const { url: shareUrl } = await createShare(id);
      setUrl(shareUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }

  async function stop(): Promise<void> {
    const id = getItemId();
    if (!id) return;
    setError(null);
    try {
      await stopSharing(id);
      // Only clear the link on success — a failed stop must keep the link shown so
      // the UI doesn't imply the diagram is private when it may still be public.
      setUrl(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function copy(): Promise<void> {
    if (url && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  }

  return { url, sharing, error, share, stop, copy };
}
