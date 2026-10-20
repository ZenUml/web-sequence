import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../state/authStore';
import { localStore } from '../services/storage';
import * as localItems from '../services/localItems';
import { LS_KEYS } from '../config/constants';
import type { Item } from '../domain/types';

// User-facing failure copy. Each names what is still true (local copies stay) and
// the next step, so the modal can show it inline next to a retry.
export const IMPORT_ERRORS = {
  read: "Couldn't read the diagrams saved in this browser. Try again.",
  save: "Couldn't import your diagrams. They're still saved in this browser. Try again.",
  flag: "Your diagrams were imported, but this choice couldn't be saved. Try again.",
  dismiss: "Couldn't save \"Don't ask again\". Your local diagrams were not changed. Select Don't ask again to try again.",
  check: "Couldn't check your diagrams or account limit. Your local diagrams were not changed. Try again.",
  quota: 'This import would exceed your account diagram limit. Your local diagrams are still saved in this browser. Remove cloud diagrams or upgrade, then try again.',
} as const;

export class ImportPreflightError extends Error {
  constructor(readonly kind: 'check' | 'quota') { super(kind); }
}

// Narrow guard passed as the 2nd saveItems argument: the account this import was
// started for. A guard-aware service must write to `uid` (or refuse) and must not
// re-resolve the owner after an await. Services that ignore it keep working: the
// hook calls saveItems in the same tick as its own uid check.
export interface ImportSaveGuard {
  uid: string;
}

// Exact identity of an upload payload (ids + record contents, key-sorted).
function payloadKey(records: Record<string, Item>): string {
  return JSON.stringify(Object.keys(records).sort().map((id) => [id, records[id]]));
}

// Read the signed-out index and keep only ids whose record actually exists. The
// index can outlive a record (e.g. a record removed by another tab), so counting
// the index alone over-reports and would show "Import 2" for one real diagram.
async function readLocalRecords(): Promise<Record<string, Item>> {
  const ids = await localItems.list();
  const map: Record<string, Item> = {};
  for (const id of ids) {
    const item = await localStore.get<Item | null>(id, null);
    if (item) map[id] = item;
  }
  return map;
}

export function useImportOnLogin(
  saveItems: (items: Record<string, Item>, guard?: ImportSaveGuard) => Promise<void>,
) {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid ?? null;

  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which action produced `error`, so the modal retries the right choice.
  const [failedAction, setFailedAction] = useState<'import' | 'dismiss' | null>(null);
  // Initial (or retried) local check failed. The count is unknown, so the prompt
  // is not "pending"; hosts open the modal on `pending || checkError`.
  const [checkError, setCheckError] = useState<string | null>(null);

  // Bumped on every identity change and on unmount. Every async step captures it
  // and applies results only while it is still current.
  const generation = useRef(0);
  const mounted = useRef(true);
  // Synchronous single-operation lock, owned by one attempt of one generation.
  // A generation change drops it (the new prompt starts unlocked); an attempt's
  // finally releases it only if it still owns it.
  const nextAttempt = useRef(0);
  const lock = useRef<{ gen: number; attempt: number } | null>(null);
  // Successful upload memo, written only by a CURRENT attempt after its save
  // resolved: same uid + generation + exact payload lets a retry rewrite just the
  // asked flag. An obsolete attempt can never write it.
  const uploaded = useRef<{ uid: string; gen: number; key: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      lock.current = null;
    };
  }, []);

  // Try to take the lock for the current generation. Returns the attempt id or null.
  const acquire = useCallback((): number | null => {
    const gen = generation.current;
    if (lock.current && lock.current.gen === gen) return null;
    const attempt = ++nextAttempt.current;
    lock.current = { gen, attempt };
    setBusy(true);
    return attempt;
  }, []);

  const release = useCallback((attempt: number) => {
    if (lock.current?.attempt !== attempt) return; // not ours (superseded)
    lock.current = null;
    if (mounted.current) setBusy(false);
  }, []);

  // Reads the asked flag and the real local records for generation `gen`.
  const runCheck = useCallback(async (gen: number): Promise<void> => {
    const current = () => mounted.current && generation.current === gen;
    try {
      const alreadyAsked = await localStore.get<boolean>(LS_KEYS.askedToImportCreations, false);
      if (!current()) return;
      if (alreadyAsked) { setCheckError(null); return; }
      const records = await readLocalRecords();
      if (!current()) return;
      const n = Object.keys(records).length;
      setCheckError(null);
      setCount(n);
      setPending(n > 0);
    } catch (e) {
      console.error('[import] local diagram check failed', e);
      if (current()) setCheckError(IMPORT_ERRORS.check);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    const gen = generation.current;
    // New identity: drop any lock/busy and upload memo held by the old one. The
    // old attempt's already-issued write still settles, silently.
    lock.current = null;
    uploaded.current = null;
    setBusy(false);
    setPending(false);
    setCount(0);
    setError(null);
    setFailedAction(null);
    setCheckError(null);
    if (!uid) return;
    void runCheck(gen);
  }, [uid, runCheck]);

  // Re-run the local check after a check failure. Never uploads.
  const retryCheck = useCallback(async (): Promise<void> => {
    if (!useAuthStore.getState().user) return;
    const attempt = acquire();
    if (attempt === null) return;
    try {
      await runCheck(generation.current);
    } finally {
      release(attempt);
    }
  }, [acquire, release, runCheck]);

  const doImport = useCallback(async (): Promise<void> => {
    const startUid = useAuthStore.getState().user?.uid ?? null;
    if (!startUid) return;
    const attempt = acquire();
    if (attempt === null) return;
    const gen = generation.current;
    const isCurrent = () =>
      mounted.current &&
      generation.current === gen &&
      (useAuthStore.getState().user?.uid ?? null) === startUid;

    setError(null);
    setFailedAction(null);
    try {
      let records: Record<string, Item>;
      try {
        records = await readLocalRecords();
      } catch (e) {
        console.error('[import] reading local diagrams failed', e);
        if (isCurrent()) { setError(IMPORT_ERRORS.read); setFailedAction('import'); }
        return;
      }
      if (!isCurrent()) return;
      const n = Object.keys(records).length;
      if (n === 0) {
        // Nothing left to import (removed meanwhile). Close without recording a
        // choice the user never made.
        setPending(false);
        return;
      }
      setCount(n);
      const key = payloadKey(records);
      const memo = uploaded.current;
      const alreadyUploaded = !!memo && memo.uid === startUid && memo.gen === gen && memo.key === key;
      if (!alreadyUploaded) {
        // saveItems resolves its target account synchronously at call time, so
        // this check and the call run in the same tick; the guard names the
        // account for guard-aware services.
        if (!isCurrent()) return;
        try {
          await saveItems(records, { uid: startUid });
        } catch (e) {
          console.error('[import] saving local diagrams failed', e);
          if (isCurrent()) {
            setError(e instanceof ImportPreflightError ? IMPORT_ERRORS[e.kind] : IMPORT_ERRORS.save);
            setFailedAction('import');
          }
          return;
        }
        // An obsolete attempt's success is not recorded anywhere it could be
        // mistaken for the current prompt's upload.
        if (!isCurrent()) return;
        uploaded.current = { uid: startUid, gen, key };
      }
      try {
        await localStore.set(LS_KEYS.askedToImportCreations, true);
      } catch (e) {
        console.error('[import] recording the import choice failed', e);
        if (isCurrent()) { setError(IMPORT_ERRORS.flag); setFailedAction('import'); }
        return;
      }
      if (isCurrent()) setPending(false);
    } finally {
      release(attempt);
    }
  }, [saveItems, acquire, release]);

  // "Don't ask again" / close: persists the never-ask flag. Local records stay.
  // Ignored while this generation has an operation in flight, so Escape mid-save
  // cannot record a dismissal for diagrams that are being uploaded.
  const dismiss = useCallback(async (): Promise<void> => {
    const attempt = acquire();
    if (attempt === null) return;
    const gen = generation.current;
    const current = () => mounted.current && generation.current === gen;
    setError(null);
    setFailedAction(null);
    try {
      await localStore.set(LS_KEYS.askedToImportCreations, true);
      if (current()) {
        setPending(false);
        setCheckError(null);
      }
    } catch (e) {
      console.error('[import] recording the dismissal failed', e);
      if (current()) { setError(IMPORT_ERRORS.dismiss); setFailedAction('dismiss'); }
    } finally {
      release(attempt);
    }
  }, [acquire, release]);

  const clearError = useCallback(() => { setError(null); setFailedAction(null); }, []);

  return { pending, count, doImport, dismiss, busy, error, failedAction, clearError, checkError, retryCheck };
}
