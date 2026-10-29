// Anonymous analytics id: a random UUID kept in localStorage so a signed-out
// visitor keeps one Mixpanel distinct_id across sessions. /track uses it as
// distinct_id when there is no Firebase uid. When storage is blocked (private
// window, blocked site data) the id lives for this page session only.
export const ANON_ID_KEY = 'zenuml_anon_id';

// Accept what this module writes (a UUID) and similar opaque tokens; anything
// else (a stringified null, whitespace, junk) is replaced, because /track would
// discard it and the browser would never get a distinct_id.
const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;

let cached: string | null = null;

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 from Math.random, for runtimes without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getAnonId(): string {
  if (cached) return cached;
  try {
    const stored = window.localStorage.getItem(ANON_ID_KEY);
    if (stored && VALID_ID.test(stored) && stored !== 'undefined') {
      cached = stored;
      return stored;
    }
  } catch {
    /* storage unavailable: fall through to a session-only id */
  }
  cached = randomUuid();
  try {
    window.localStorage.setItem(ANON_ID_KEY, cached);
  } catch {
    /* storage unavailable: keep the session-only id */
  }
  return cached;
}

export function resetAnonIdCacheForTests(): void {
  cached = null;
}
