// One random-id generator for every persisted id (items, pages, folders).
// Uses crypto.randomUUID when available. The fallback (non-secure contexts, old
// WebViews) adds random characters to the timestamp, because two ids made in the
// same millisecond must not collide: duplicate ids corrupt stored diagrams.
// The uuid output is unchanged from the inline generators this replaces, since
// those ids already live in Firestore, localStorage and share URLs.
export function randomId(prefix?: string): string {
  const core = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${core}` : core;
}
