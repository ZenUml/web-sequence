import { useState } from 'react';

export interface UseShareOpts {
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
  const { getItemId, createShare, stopSharing, onBeforeShare } = opts;
  const [url, setUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    await stopSharing(id);
    setUrl(null);
  }

  async function copy(): Promise<void> {
    if (url && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  }

  return { url, sharing, error, share, stop, copy };
}
