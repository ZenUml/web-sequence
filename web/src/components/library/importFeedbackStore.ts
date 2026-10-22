import { create } from 'zustand';
import { analyzeImport, type InvalidImportReason } from '../../services/importDiagrams';
import type { Item } from '../../domain/types';
import { IdentityChangedError, type SaveItemsGuard } from '../../services/identityGuard';
import { captureReturnFocus, transferSlot } from './transferSlot';
import {
  LIBRARY_CANCELLED,
  activeLibraryIdentity,
  type IdentityBinding,
  type LibraryCancelled,
  type OperationIdentity,
} from './libraryIdentity';

// Result channel for library import. HomeView's onImport(text) callback returns
// void, so the outcome (and the chosen file's name) travels through this store
// instead of through HomeView props:
//
//   ImportExportBar / ImportFeedback picker ── readImportFile(file) ──▶ onImport(text)
//   AppRoot.handleImport(text) ── runImport(text, deps) ──▶ store.phase
//   ImportFeedback (rendered by AppRoot on Home) ◀── store
export type ImportPhase =
  | 'idle'
  | 'reading'
  | 'saving'
  | 'success'
  | 'invalid'
  | 'readFailed'
  | 'saveFailed'
  // The account changed after the attempt started: stopped, never redirected.
  | 'cancelled';

interface PreparedImport {
  items: Record<string, Item>;
  // Unique ids in the file.
  total: number;
  // False when existing ids could not be read: no added/updated split is claimed.
  countsKnown: boolean;
  added: number;
  updated: number;
  // Identity the attempt started under; a retry is only allowed while it is current.
  token: OperationIdentity | null;
}

interface ImportFeedbackState {
  phase: ImportPhase;
  fileName: string | null;
  // Text of the file being imported, held so Try again never re-reads the file.
  text: string | null;
  // Analysed payload of the last attempt. Reused by Try again so the retry sends the
  // same diagram ids AND the same generated page ids, and its counts stay relative to
  // the library as it was before the first attempt (a partial local write must not
  // turn "added" into "updated").
  prepared: PreparedImport | null;
  invalidReason: InvalidImportReason | null;
  added: number;
  updated: number;
  total: number;
  countsKnown: boolean;
  // Cancelled only: false = stopped before any write; true = some writes for the
  // previous identity may have happened (never rolled back, never to the new one).
  writesMayHaveStarted: boolean;
  // Element to return focus to when failure feedback is dismissed.
  returnFocus: HTMLElement | null;
  busy(): boolean;
  dismiss(): void;
  reset(): void;
  // Called by useLibraryReader after the account changed. A failed attempt's retry
  // payload is dropped (it must not replay into the new account); finished results
  // are cleared. An attempt in flight is left to its own identity checks.
  identityChanged(): void;
}

const initial = {
  phase: 'idle' as ImportPhase,
  fileName: null,
  text: null,
  prepared: null,
  invalidReason: null,
  added: 0,
  updated: 0,
  total: 0,
  countsKnown: true,
  writesMayHaveStarted: false,
  returnFocus: null,
};

export const useImportFeedbackStore = create<ImportFeedbackState>((set, get) => ({
  ...initial,
  busy: () => get().phase === 'reading' || get().phase === 'saving',
  dismiss: () => set({ ...initial }),
  reset: () => set({ ...initial }),
  identityChanged: () => {
    const s = get();
    if (s.phase === 'reading') {
      // The chosen file belongs to the previous owner: cancel now (nothing was saved)
      // and make its pending read completion inert.
      fileAttempt += 1;
      set({ phase: 'cancelled', writesMayHaveStarted: false, prepared: null, text: null });
      return;
    }
    // A save in flight settles through its own token checks (runImport).
    if (s.busy() || (s.phase === 'idle' && s.text != null)) return;
    if (s.phase === 'saveFailed') {
      // The failed attempt may have partially saved (signed-out saves are per item).
      set({ phase: 'cancelled', writesMayHaveStarted: true, prepared: null, text: null });
      return;
    }
    // A cancellation notice stays until the user dismisses it: "Import interrupted" is
    // the only notice that writes may exist, and "Import canceled" stays true.
    if (s.phase === 'cancelled') return;
    if (s.phase !== 'idle') set({ ...initial });
  },
}));

const store = useImportFeedbackStore;

transferSlot.register('import', {
  busy: () => store.getState().busy(),
  release: () => store.getState().dismiss(),
  identityChanged: () => store.getState().identityChanged(),
});

// Identifies the newest file attempt. A read completion from an older attempt (one
// that identityChanged cancelled, or that a newer choice replaced) publishes nothing.
let fileAttempt = 0;

// Second argument readImportFile passes to the import handler when a library owner is
// registered (IE-C1): the immutable identity captured BEFORE the file was read. The
// handler forwards it as runImport's `token`, so the attempt is never recaptured.
export interface ImportFileContext {
  token: OperationIdentity;
}
export type ImportFileHandler = (text: string, context?: ImportFileContext) => void | Promise<void>;

// Reads a chosen file and hands its text to the app's import handler. A failed read
// becomes readFailed feedback (Choose another file); Chrome keeps failing reads of a
// File whose source changed, so there is no read retry.
export async function readImportFile(file: File, onImport: ImportFileHandler): Promise<void> {
  if (store.getState().busy()) return;
  // Ownership is captured synchronously, before the first await (IE-C1).
  const binding = activeLibraryIdentity();
  const token = binding ? binding.current() : null;
  const attempt = (fileAttempt += 1);
  const owned = () => attempt === fileAttempt;
  const stale = () => binding != null && !binding.isCurrent(token!);
  const cancelStale = () => {
    fileAttempt += 1;
    store.setState({ phase: 'cancelled', writesMayHaveStarted: false, prepared: null, text: null });
  };
  const returnFocus = captureReturnFocus('[data-import-feedback]', store.getState().returnFocus);
  store.setState({ ...initial, phase: 'reading', fileName: file.name, returnFocus });
  transferSlot.claim('import');
  let text: string;
  try {
    text = await file.text();
  } catch {
    if (!owned()) return;
    if (stale()) cancelStale();
    else store.setState({ phase: 'readFailed' });
    return;
  }
  if (!owned()) return;
  // The owner changed (or unmounted) while the file was read: never hand the file
  // to the handler, which would bind it to the new owner.
  if (stale()) {
    cancelStale();
    return;
  }
  // Back to idle before handing off: if no import handler records a result, nothing
  // stays pending and the Import button is never left disabled.
  store.setState({ phase: 'idle', text });
  try {
    if (token) await onImport(text, { token });
    else await onImport(text);
  } catch {
    // runImport never rejects; this guards other handlers wired to the public API.
    if (stale()) cancelStale();
    else store.setState({ phase: 'saveFailed' });
  }
}

// Busy flag for any control that starts an import (ImportExportBar, HomeSidebar).
export function useImportBusy(): boolean {
  return useImportFeedbackStore((st) => st.phase === 'reading' || st.phase === 'saving');
}

export interface RunImportDeps {
  // Ids that already exist in the library, from a SETTLED source (storage index or a
  // loaded snapshot — see useLibraryReader). A function is awaited after validation;
  // null means "library could not be read": the import still saves, but feedback
  // makes no added/updated claim.
  // Receives the attempt's identity token when `identity` is given; may answer
  // LIBRARY_CANCELLED (the identity is gone), which stops the attempt before saving.
  existingIds:
    | Iterable<string>
    | ((token?: OperationIdentity) => Promise<Iterable<string> | null | LibraryCancelled>);
  // With `identity`, called as saveItems(items, { expectedUid }) and may throw
  // IdentityChangedError (see itemService.saveItems).
  saveItems(items: Record<string, Item>, guard?: SaveItemsGuard): Promise<void>;
  // Called once, only after the save resolved, with the count of newly added ids.
  onItemsAdded(count: number): void;
  // Optional identity binding (useLibraryReader().identity). Without it, runImport
  // keeps its unbound behaviour.
  identity?: IdentityBinding;
  // Identity captured when the file was chosen (ImportFileContext.token). When given,
  // runImport uses it instead of capturing identity.current() now.
  token?: OperationIdentity | null;
}

async function resolveExistingIds(
  deps: RunImportDeps,
  token: OperationIdentity | null,
): Promise<Set<string> | null | LibraryCancelled> {
  if (typeof deps.existingIds !== 'function') return new Set(deps.existingIds);
  try {
    const ids = token ? await deps.existingIds(token) : await deps.existingIds();
    if (ids === LIBRARY_CANCELLED) return LIBRARY_CANCELLED;
    return ids == null ? null : new Set(ids);
  } catch {
    return null;
  }
}

function cancel(writesMayHaveStarted: boolean) {
  store.setState({ phase: 'cancelled', writesMayHaveStarted, prepared: null, text: null });
}

// Never rejects: every outcome becomes store state, so callers may `void` it.
export async function runImport(text: string, deps: RunImportDeps): Promise<void> {
  const s = store.getState();
  if (s.phase === 'saving') return;
  const sameInput = s.text === text;
  const retry = sameInput && s.phase === 'saveFailed' && s.prepared != null;
  const carried = {
    fileName: sameInput ? s.fileName : null,
    returnFocus: sameInput ? s.returnFocus : null,
  };

  const stillCurrent = (t: OperationIdentity | null) => !deps.identity || (t != null && deps.identity.isCurrent(t));

  let prepared: PreparedImport;
  if (retry) {
    prepared = s.prepared!;
    // A failed attempt from another account (or generation) is never replayed here.
    if (deps.identity && !stillCurrent(prepared.token)) {
      store.setState({ ...initial, ...carried });
      cancel(true);
      return;
    }
    store.setState({ ...initial, ...carried, phase: 'saving', text, prepared });
  } else {
    const token = deps.identity ? deps.token ?? deps.identity.current() : null;
    // A carried token that is already stale: nothing was saved.
    if (deps.identity && !stillCurrent(token)) {
      store.setState({ ...initial, ...carried });
      cancel(false);
      return;
    }
    // Validate before waiting for the library, so a bad file is reported at once.
    const analysis = analyzeImport(text, new Set());
    if (analysis.kind === 'invalid') {
      store.setState({ ...initial, ...carried, phase: 'invalid', text, invalidReason: analysis.reason });
      return;
    }
    store.setState({ ...initial, ...carried, phase: 'saving', text });
    transferSlot.claim('import');
    const existing = await resolveExistingIds(deps, token);
    // Checked before any write: the library answer and the save must belong to the
    // identity that started the attempt.
    if (existing === LIBRARY_CANCELLED || !stillCurrent(token)) {
      cancel(false);
      return;
    }
    const ids = Object.keys(analysis.items);
    prepared = {
      items: analysis.items,
      total: ids.length,
      countsKnown: existing != null,
      added: existing ? ids.filter((id) => !existing.has(id)).length : 0,
      updated: existing ? ids.filter((id) => existing.has(id)).length : 0,
      token,
    };
    store.setState({ prepared });
  }

  try {
    if (deps.identity) {
      const bound = prepared.token!;
      const binding = deps.identity;
      // Both checks run before every not-yet-issued write (IE-C2).
      await deps.saveItems(prepared.items, { expectedUid: bound.uid, isCurrent: () => binding.isCurrent(bound) });
    } else {
      await deps.saveItems(prepared.items);
    }
  } catch (err) {
    if (err instanceof IdentityChangedError) {
      // Stopped by the bound-identity guard: nothing written for the new identity.
      cancel(err.writesStarted);
      return;
    }
    // A late failure of an attempt whose owner is gone must not republish a retry
    // (IE-C3): no Try again, no replay data, under the next owner.
    if (!stillCurrent(prepared.token)) {
      cancel(true);
      return;
    }
    // Persistence may have partially succeeded (signed-out saves are per item), so the
    // feedback makes no count or rollback claim. The prepared payload is kept for retry.
    store.setState({ phase: 'saveFailed' });
    return;
  }
  // The save finished for the bound identity, but the account changed meanwhile:
  // no success claim and no analytics for an account that is no longer shown.
  if (!stillCurrent(prepared.token)) {
    cancel(true);
    return;
  }
  store.setState({
    phase: 'success',
    added: prepared.added,
    updated: prepared.updated,
    total: prepared.total,
    countsKnown: prepared.countsKnown,
  });
  if (prepared.countsKnown && prepared.added > 0) {
    try {
      deps.onItemsAdded(prepared.added);
    } catch {
      // Analytics must not turn a committed import into a failure.
    }
  }
}
