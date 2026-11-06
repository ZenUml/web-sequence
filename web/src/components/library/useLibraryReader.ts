import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as localItems from '../../services/localItems';
import { localStore } from '../../services/storage';
import type { Item } from '../../domain/types';
import { useExportFeedbackStore } from './exportFeedbackStore';
import { useImportFeedbackStore } from './importFeedbackStore';
import {
  LIBRARY_CANCELLED,
  type IdentityBinding,
  type LibraryCancelled,
  type OperationIdentity,
  registerLibraryIdentity,
} from './libraryIdentity';

// How long import/export wait for a signed-in library snapshot before giving up.
export const LIBRARY_WAIT_MS = 15_000;

interface LibrarySource {
  items: Item[];
  loading: boolean;
  uid: string | null;
  // Optional read provenance from useItems (IE-F2). When `attempt` is given, only a
  // successful read (error null) owned by the current uid, from an attempt newer
  // than the last uid change, is an authoritative library. A failed read is unknown.
  owner?: string | null;
  error?: unknown;
  attempt?: number;
  retry?: () => number;
}

type ReadStatus = 'pending' | 'ready' | 'error';

// Signed-out library from storage: extant records only (IE-F3). A dangling index key
// (no record) is not a diagram. An unreadable record (not an object, e.g. corrupt
// JSON) makes the whole answer unknown (null): it must not support an exact split or
// a silently incomplete export.
async function readLocalLibrary(): Promise<{ ids: string[]; items: Item[] } | null> {
  try {
    const indexed = await localItems.list();
    const records = await Promise.all(indexed.map((id) => localStore.get<unknown>(id, null)));
    const ids: string[] = [];
    const items: Item[] = [];
    for (let i = 0; i < indexed.length; i += 1) {
      const record = records[i];
      if (record === null || record === undefined) continue;
      if (typeof record !== 'object') return null;
      ids.push(indexed[i]);
      items.push(record as Item);
    }
    return { ids, items };
  } catch {
    return null;
  }
}

// Settled view of the whole library for import classification and Export all.
// useItems().items is not safe to read directly: it is [] until the first load
// resolves, and after sign-in it keeps the signed-out list (with loading already
// false) until the first Firestore snapshot replaces it.
//
//  - Signed out: read the storage index/records directly. That is the source of
//    truth and already includes writes the reactive list has not reloaded yet.
//  - Signed in: wait until loading is false AND the list has been replaced since the
//    uid last changed (with provenance: a read owned by this uid from a newer
//    attempt). A failed read retries once (source.retry), then answers null
//    (unknown). Gives up with null after LIBRARY_WAIT_MS.
//
// Every read is bound to an OperationIdentity (default: the current one). When the
// account changes, or this hook unmounts, before a read answers, the read resolves
// LIBRARY_CANCELLED — never another identity's library.
export function useLibraryReader(source: LibrarySource) {
  const { items, loading, uid } = source;
  const latest = useRef({
    ...source,
    staleItems: null as Item[] | null,
    staleAttempt: null as number | null,
  });
  const prevUid = useRef(uid);
  const generation = useRef(1);
  const disposed = useRef(false);
  const notifiedGeneration = useRef(1);
  const waiters = useRef(new Set<() => void>());

  // Detect the uid change during render, so a call made in the same tick as the
  // change already sees the new generation and the stale list as not ready.
  if (prevUid.current !== uid) {
    prevUid.current = uid;
    generation.current += 1;
    latest.current.staleItems = items;
    latest.current.staleAttempt = source.attempt ?? null;
  } else if (latest.current.staleItems && items !== latest.current.staleItems) {
    latest.current.staleItems = null;
  }
  latest.current.items = items;
  latest.current.loading = loading;
  latest.current.uid = uid;
  latest.current.owner = source.owner;
  latest.current.error = source.error;
  latest.current.attempt = source.attempt;
  latest.current.retry = source.retry;

  const status = (): ReadStatus => {
    const l = latest.current;
    if (l.loading) return 'pending';
    if (typeof l.attempt === 'number') {
      if (l.owner !== l.uid || l.attempt === l.staleAttempt) return 'pending';
      return l.error != null ? 'error' : 'ready';
    }
    // Legacy source without provenance: the list must be replaced after a uid change.
    return l.staleItems === null ? 'ready' : 'pending';
  };
  const ready = () => status() === 'ready';

  const identity = useMemo<IdentityBinding>(() => ({
    current: () => ({ uid: latest.current.uid, generation: generation.current }),
    isCurrent: (t: OperationIdentity) =>
      !disposed.current && t.generation === generation.current && t.uid === latest.current.uid,
  }), []);

  useEffect(() => {
    if (notifiedGeneration.current !== generation.current) {
      notifiedGeneration.current = generation.current;
      // Results and failed retries of the previous identity must not stay actionable.
      useImportFeedbackStore.getState().identityChanged();
      useExportFeedbackStore.getState().identityChanged();
    }
    // Publish the settled library size for the Export all disabled state.
    useExportFeedbackStore.getState().setLibraryCount(ready() ? latest.current.items.length : null);
    // Each waiter cancels itself if its generation is gone, else answers once ready.
    for (const wake of [...waiters.current]) wake();
  });

  useEffect(() => {
    disposed.current = false;
    const pending = waiters.current;
    const unregister = registerLibraryIdentity(identity);
    return () => {
      unregister();
      disposed.current = true;
      for (const wake of [...pending]) wake();
    };
  }, [identity]);

  const waitForSnapshot = useCallback(
    (token: OperationIdentity): Promise<Item[] | null | LibraryCancelled> => {
      if (!identity.isCurrent(token)) return Promise.resolve(LIBRARY_CANCELLED);
      if (ready()) return Promise.resolve(latest.current.items);
      return new Promise((resolve) => {
        // Each read retries a failed subscription at most once, then answers the
        // outcome of that retry: never the error it already saw, never [].
        let retried = false;
        let minAttempt = -Infinity;
        const finish = (value: Item[] | null | LibraryCancelled) => {
          clearTimeout(timer);
          waiters.current.delete(wake);
          resolve(value);
        };
        const wake = () => {
          if (!identity.isCurrent(token)) return finish(LIBRARY_CANCELLED);
          const st = status();
          if (st === 'pending' || (latest.current.attempt ?? 0) < minAttempt) return;
          if (st === 'ready') return finish(latest.current.items);
          const retry = latest.current.retry;
          if (!retried && retry) {
            retried = true;
            minAttempt = retry();
            return;
          }
          finish(null);
        };
        const timer = setTimeout(() => finish(identity.isCurrent(token) ? null : LIBRARY_CANCELLED), LIBRARY_WAIT_MS);
        waiters.current.add(wake);
        wake();
      });
    },
    [identity],
  );

  const getLibraryItems = useCallback(
    async (token: OperationIdentity = identity.current()): Promise<Item[] | null | LibraryCancelled> => {
      if (!identity.isCurrent(token)) return LIBRARY_CANCELLED;
      if (token.uid) return waitForSnapshot(token);
      const local = await readLocalLibrary();
      // A local read that finishes after sign-in belongs to the old identity.
      if (!identity.isCurrent(token)) return LIBRARY_CANCELLED;
      return local ? local.items : null;
    },
    [identity, waitForSnapshot],
  );

  const getExistingIds = useCallback(
    async (token: OperationIdentity = identity.current()): Promise<Set<string> | null | LibraryCancelled> => {
      if (!identity.isCurrent(token)) return LIBRARY_CANCELLED;
      if (token.uid) {
        const list = await waitForSnapshot(token);
        if (list === LIBRARY_CANCELLED || list === null) return list;
        return new Set(list.map((i) => i.id));
      }
      const local = await readLocalLibrary();
      if (!identity.isCurrent(token)) return LIBRARY_CANCELLED;
      return local ? new Set(local.ids) : null;
    },
    [identity, waitForSnapshot],
  );

  return { identity, getExistingIds, getLibraryItems };
}
