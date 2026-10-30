// Provenance for a failed shared-link read (GET /get-shared-item).
//
// The visitor UI must tell an EXPLICIT dead link (the backend answered "no") apart
// from a temporary failure (network down, 5xx, garbled response). Only the former
// may claim the link is unavailable; everything else is retryable. The backend
// (functions/index.js get_shared_item) answers:
//   400 — id or share token missing   → the link itself is malformed
//   404 — item does not exist         → deleted / never existed
//   403 — not shared or token mismatch → revoked / no access
//   500 — Firestore/runtime failure    → temporary
// 401/410 are not emitted today but carry the same explicit meaning if they appear.
//
// `message` keeps the server's `error` string for diagnostics only — the UI never
// renders it (it can describe token checks).

export type SharedItemFailure = 'unavailable' | 'retryable';

const UNAVAILABLE_STATUSES = new Set([400, 401, 403, 404, 410]);

export class SharedItemError extends Error {
  readonly status: number | null;
  readonly failure: SharedItemFailure;

  constructor(message: string, status: number | null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SharedItemError';
    this.status = status;
    this.failure = status !== null && UNAVAILABLE_STATUSES.has(status) ? 'unavailable' : 'retryable';
  }
}

// Unknown errors (no SharedItemError provenance) are retryable: we cannot prove
// the link is dead, so we must not tell the visitor it is.
export function classifySharedItemFailure(error: unknown): SharedItemFailure {
  return error instanceof SharedItemError ? error.failure : 'retryable';
}
