import type { Item } from '../domain/types';
import { getIdToken } from './firebase';

// Hosting-rewritten endpoints are same-origin paths (dev: Vite proxy → emulator;
// prod: Firebase Hosting rewrites). See contract spec §5.

// POST /create-share — body { id, token: freshIdToken, origin }. Item must be SAVED
// first (the function reads items/{id}). Returns the share URL with the md5
// cache-buster. `origin` honors contract §5.1: the backend builds page_share from it
// and only falls back to env-specific hosts when absent. Without it, a non-canonical
// origin (local dev off :3000, preview deploys) would mint a share link on the wrong
// host (mirrors legacy syncService.js:34).
export async function createShare(id: string): Promise<{ url: string; md5: string }> {
  const token = await getIdToken();
  const res = await fetch('/create-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, token, origin: window.location.origin }),
  });
  if (!res.ok) {
    let msg = 'Failed to create share link';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const { page_share, md5 } = (await res.json()) as { page_share: string; md5: string };
  const sep = page_share.includes('?') ? '&' : '?';
  return { url: `${page_share}${sep}v=${md5}`, md5 };
}

// GET /get-shared-item?id=&share-token= → Item (isReadOnly:true). Public read.
export async function getSharedItem(id: string, shareToken: string): Promise<Item> {
  const res = await fetch(`/get-shared-item?id=${encodeURIComponent(id)}&share-token=${encodeURIComponent(shareToken)}`);
  if (!res.ok) {
    let msg = 'Failed to load shared item';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as Item;
}

// POST /track — non-blocking analytics (§5.5). Swallows all errors: a failed
// analytics call must never break the user action that triggered it.
export async function trackEvent(
  payload: Record<string, unknown> & { event: string; userId: string | null },
): Promise<void> {
  try {
    await fetch('/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* non-blocking */
  }
}
