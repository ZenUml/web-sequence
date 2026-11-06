// Identity binding for library operations (import, Export all).
//
// An operation captures the identity it started under. Every account change (sign in,
// sign out, switch, even A → B → A) starts a new generation, so a token from an older
// generation is never current again. Reads bound to a stale token answer
// LIBRARY_CANCELLED instead of another identity's library, and writes are guarded with
// itemService.saveItems(items, { expectedUid: token.uid }).
export interface OperationIdentity {
  // Signed-in uid, or null when signed out (local library).
  uid: string | null;
  // Increments on every uid change; never reused.
  generation: number;
}

export interface IdentityBinding {
  // Identity a new operation should capture.
  current(): OperationIdentity;
  // False once the account changed (or the library owner unmounted) after `token` was captured.
  isCurrent(token: OperationIdentity): boolean;
}

// Answer of a read whose identity is no longer current. Distinct from null ("library
// could not be read"): a cancelled read must never be treated as an empty or unknown
// library, and must stop the operation before any write or download.
export const LIBRARY_CANCELLED: unique symbol = Symbol('library-cancelled');
export type LibraryCancelled = typeof LIBRARY_CANCELLED;

// The library owner's binding (registered by useLibraryReader while mounted). File
// controllers that cannot receive props from the owner (ImportExportBar, the feedback
// panel's picker, the parent-owned Home sidebar) capture an immutable token from it
// at their entry, before any await (see readImportFile).
let activeBinding: IdentityBinding | null = null;

export function registerLibraryIdentity(binding: IdentityBinding): () => void {
  activeBinding = binding;
  return () => {
    if (activeBinding === binding) activeBinding = null;
  };
}

export function activeLibraryIdentity(): IdentityBinding | null {
  return activeBinding;
}
