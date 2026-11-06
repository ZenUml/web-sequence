// Optional bound-identity guard for saveItems. `expectedUid` is the identity the
// caller's operation started under (null = signed out). saveItems re-reads the live
// auth uid before its first write, before every signed-out per-item write and
// immediately before the signed-in batch commit; on mismatch it stops and throws
// IdentityChangedError instead of writing to the new account or to local storage.
// Without a guard saveItems keeps its legacy "write under the live identity" semantics.
//
// `isCurrent` (optional, IE-C2) is the caller's operation predicate: false once the
// operation's generation is invalidated (owner unmounted, or the account changed even
// if it changed back, e.g. null → B → null). It is checked at the same points as the
// uid. Writes already issued are never recalled or rolled back.
export interface SaveItemsGuard {
  expectedUid: string | null;
  isCurrent?: () => boolean;
}

export class IdentityChangedError extends Error {
  // True when some writes for the bound identity may already have happened (signed-out
  // per-item writes). Nothing is ever rolled back; nothing is written for the new identity.
  readonly writesStarted: boolean;
  constructor(writesStarted: boolean) {
    super('The signed-in account changed during the save');
    this.name = 'IdentityChangedError';
    this.writesStarted = writesStarted;
  }
}
