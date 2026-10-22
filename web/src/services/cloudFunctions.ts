import type { Item } from '../domain/types';
import { getIdToken } from './firebase';
import { shareOrigin } from '../config/shareOrigin';
import { detectFromEnv } from '../app/runtimeMode';
import { SharedItemError } from './sharedItemError';

// Hosting-rewritten endpoints are same-origin paths (dev: Vite proxy → emulator;
// prod: Firebase Hosting rewrites). See contract spec §5.

// POST /create-share — body EXACTLY { id, token: freshIdToken, origin }. Item must
// be SAVED first (the function reads items/{id}). Returns the share URL with the md5
// cache-buster. `origin` honors contract §5.1: the backend builds page_share from it
// and only falls back to env-specific hosts when absent. Without it, a non-canonical
// origin (local dev off :3000, preview deploys) would mint a share link on the wrong
// host (mirrors legacy syncService.js:34).
//
// M05: the origin SOURCE is now `shareOrigin({ isExtension })` (NOT raw
// window.location.origin). Under the extension `window.location.origin` is
// `chrome-extension://<id>` — an unreachable share host — so it is overridden with
// the canonical web origin (resolves the roadmap §9 "extension share-link origin"
// deferral). The body shape stays EXACTLY { id, token, origin }; M05 does NOT add
// name/content/description (the §5.1-vs-shipped divergence is recorded as out-of-scope
// in roadmap §9, not introduced here).
//
// The `isExtension` default is resolved at CALL time via detectFromEnv() (NOT captured
// at module load) — this is load-bearing: AppRoot passes the BARE `createShare`
// reference through useShare (UseShareOpts.createShare is typed `(id) => …`, no opts
// threaded), so the extension override flows ENTIRELY through this lazy default. The
// through-useShare seam test guards this end-to-end.
//
// #615: the request is bounded by `timeoutMs` (default 30s). An unanswered request
// used to keep the Share spinner running forever; now it rejects and useShare shows
// the error with Try again.
export const CREATE_SHARE_TIMEOUT_MS = 30_000;

export async function createShare(
  id: string,
  opts: { isExtension?: boolean; timeoutMs?: number } = {},
): Promise<{ url: string; md5: string }> {
  const token = await getIdToken();
  const origin = shareOrigin({ isExtension: opts.isExtension ?? detectFromEnv().isExtension });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? CREATE_SHARE_TIMEOUT_MS);
  try {
    const res = await fetch('/create-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, token, origin }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let msg = 'Failed to create share link';
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const { page_share, md5 } = (await res.json()) as { page_share: string; md5: string };
    const sep = page_share.includes('?') ? '&' : '?';
    return { url: `${page_share}${sep}v=${md5}`, md5 };
  } catch (e: unknown) {
    if (controller.signal.aborted) throw new Error('Creating the share link timed out. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// GET /get-shared-item?id=&share-token= → Item (isReadOnly:true). Public read.
// Every failure rejects with SharedItemError carrying the HTTP status (null for a
// network/parse failure) so the visitor UI can tell an explicit dead link from a
// temporary failure. The message stays the server's `error` string (diagnostic only).
export async function getSharedItem(id: string, shareToken: string): Promise<Item> {
  let res: Response;
  try {
    res = await fetch(`/get-shared-item?id=${encodeURIComponent(id)}&share-token=${encodeURIComponent(shareToken)}`);
  } catch (cause) {
    throw new SharedItemError('Failed to load shared item', null, { cause });
  }
  if (!res.ok) {
    let msg = 'Failed to load shared item';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new SharedItemError(msg, res.status);
  }
  try {
    return (await res.json()) as Item;
  } catch (cause) {
    throw new SharedItemError('Failed to load shared item', null, { cause });
  }
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
