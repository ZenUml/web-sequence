import { create } from 'zustand';
import { exportAllItemsJson } from '../../services/exportImport';
import { useImportFeedbackStore } from './importFeedbackStore';
import type { Item } from '../../domain/types';
import { LIBRARY_CANCELLED, type IdentityBinding, type LibraryCancelled, type OperationIdentity } from './libraryIdentity';

// Export all feedback (Figma "Export all diagrams", board 36:8517): preparing,
// download started, failed, empty library. Like import, the outcome travels through
// a store so HomeView's onExportAll(): void contract stays unchanged.
export const EXPORT_FILE_NAME = 'zenuml-diagrams.json';

// A second click this soon after a download started is treated as a double click.
const DOUBLE_CLICK_MS = 1500;

// cancelled: the account changed before the file was handed to the browser.
export type ExportPhase = 'idle' | 'preparing' | 'started' | 'failed' | 'empty' | 'cancelled';

interface ExportFeedbackState {
  phase: ExportPhase;
  // Diagrams in the exported file; null while the library is still loading.
  total: number | null;
  fileName: string;
  startedAt: number;
  // Size of the loaded library, published by AppRoot for the Export all disabled
  // state; null while unknown (loading).
  libraryCount: number | null;
  returnFocus: HTMLElement | null;
  busy(): boolean;
  setLibraryCount(count: number | null): void;
  // Clears a finished result (not an export in progress).
  clearResult(): void;
  dismiss(): void;
  reset(): void;
  // Called by useLibraryReader after the account changed: clears a finished result
  // of the previous identity. An export in progress is left to its own checks.
  identityChanged(): void;
}

const initialResult = {
  phase: 'idle' as ExportPhase,
  total: null,
  fileName: EXPORT_FILE_NAME,
  startedAt: 0,
  returnFocus: null,
};

export const useExportFeedbackStore = create<ExportFeedbackState>((set, get) => ({
  ...initialResult,
  libraryCount: null,
  busy: () => get().phase === 'preparing',
  setLibraryCount: (libraryCount) => set({ libraryCount }),
  clearResult: () => { if (get().phase !== 'preparing') set({ ...initialResult }); },
  dismiss: () => set({ ...initialResult }),
  reset: () => set({ ...initialResult, libraryCount: null }),
  identityChanged: () => { if (get().phase !== 'preparing') set({ ...initialResult }); },
}));

const store = useExportFeedbackStore;

export function useExportBusy(): boolean {
  return useExportFeedbackStore((s) => s.phase === 'preparing');
}

// True only when the loaded library is known to be empty.
export function useExportDisabled(): boolean {
  return useExportFeedbackStore((s) => s.libraryCount === 0);
}

export interface RunExportDeps {
  // Every diagram in the library (not the search/folder-filtered view), from a
  // settled source; null when the library could not be read. Receives the export's
  // identity token when `identity` is given and may answer LIBRARY_CANCELLED.
  getItems(token?: OperationIdentity): Promise<Item[] | null | LibraryCancelled>;
  download(fileName: string, json: string): void;
  // Analytics for an export attempt (legacy exportItems), called once per attempt.
  onStart(): void;
  // Optional identity binding (useLibraryReader().identity): the file is only
  // downloaded while the identity that started the export is still current.
  identity?: IdentityBinding;
}

// Never rejects. "started" means the browser was handed the file, not that it was
// saved to disk — the browser may still block or cancel the download.
export async function runExportAll(deps: RunExportDeps): Promise<void> {
  const s = store.getState();
  if (s.phase === 'preparing') return;
  if (s.phase === 'started' && Date.now() - s.startedAt < DOUBLE_CLICK_MS) return;
  const active = document.activeElement;
  const fromPanel = active instanceof HTMLElement && active.closest('[data-export-feedback]') != null;
  const returnFocus = fromPanel
    ? s.returnFocus
    : active instanceof HTMLElement && active !== document.body ? active : null;
  const token = deps.identity ? deps.identity.current() : null;
  const stillCurrent = () => !deps.identity || deps.identity.isCurrent(token!);
  store.setState({ ...initialResult, phase: 'preparing', returnFocus });
  if (!useImportFeedbackStore.getState().busy()) useImportFeedbackStore.getState().dismiss();
  try {
    deps.onStart();
  } catch {
    // Analytics must not block the export.
  }

  let items: Item[] | null | LibraryCancelled;
  try {
    items = token ? await deps.getItems(token) : await deps.getItems();
  } catch {
    items = null;
  }
  // Never download another identity's library for an export started under this one.
  if (items === LIBRARY_CANCELLED || !stillCurrent()) {
    store.setState({ phase: 'cancelled', total: null });
    return;
  }
  if (items == null) {
    store.setState({ phase: 'failed' });
    return;
  }
  if (items.length === 0) {
    store.setState({ phase: 'empty', total: 0 });
    return;
  }
  store.setState({ total: items.length });
  try {
    deps.download(EXPORT_FILE_NAME, exportAllItemsJson(items));
  } catch {
    store.setState({ phase: 'failed' });
    return;
  }
  store.setState({ phase: 'started', startedAt: Date.now() });
}
