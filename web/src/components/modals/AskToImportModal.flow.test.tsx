import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { AskToImportModal } from './AskToImportModal';
import { useImportOnLogin } from '../../hooks/useImportOnLogin';
import { useAuthStore } from '../../state/authStore';
import * as localItems from '../../services/localItems';
import { localStore } from '../../services/storage';
import type { Item } from '../../domain/types';

// Real hook + real modal, wired the way the AppRoot integration patch wires them.
// AC-C1 (2026-10-20): a failed "Don't ask again" write must be visible and
// retryable while the initial check error is still shown.
function Host({ saveItems }: { saveItems: (m: Record<string, Item>) => Promise<void> }) {
  const h = useImportOnLogin(saveItems);
  return (
    <AskToImportModal
      open={h.pending || h.checkError != null}
      onOpenChange={(o) => { if (!o) void h.dismiss(); }}
      count={h.count}
      busy={h.busy}
      error={h.error}
      failedAction={h.failedAction}
      checkError={h.checkError}
      onRetryCheck={() => void h.retryCheck()}
      onImport={() => void h.doImport()}
      onDismiss={() => void h.dismiss()}
    />
  );
}

function makeItem(id: string): Item {
  return {
    id, title: id, js: '', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js',
    pages: [], currentPageId: '', updatedOn: 1,
  };
}

const FLAG = 'askedToImportCreations';

beforeEach(async () => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await localItems.add('x');
  await localStore.set('x', makeItem('x'));
});

async function openWithFailedCheck(saveItems = vi.fn(async () => {})) {
  vi.spyOn(localItems, 'list').mockRejectedValueOnce(new Error('read'));
  useAuthStore.setState({ user: { uid: 'u1', email: null, displayName: null, photoURL: null }, online: true });
  render(<Host saveItems={saveItems} />);
  await screen.findByTestId('import-check-error');
  return saveItems;
}

describe('AskToImportModal + useImportOnLogin — check failure, then dismissal failure (AC-C1)', () => {
  it('shows the failed "Don\'t ask again" write, keeps the flag unset, uploads nothing, keeps records', async () => {
    const saveItems = await openWithFailedCheck();
    const realSet = localStore.set.bind(localStore);
    vi.spyOn(localStore, 'set').mockImplementation(async (k: string, v: unknown) => {
      if (k === FLAG) throw new Error('quota');
      return realSet(k, v);
    });

    fireEvent.click(screen.getByTestId('import-dismiss'));
    const alert = await screen.findByTestId('import-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/couldn.t save .*don.t ask again/i);
    // The check failure is still shown: the count is still unknown.
    expect(screen.getByTestId('import-check-error')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(expect.stringMatching(/couldn.t save/i));
    // No fabricated count and no import control.
    expect(screen.getByRole('dialog').textContent).not.toMatch(/\d+ diagrams? (is|are) saved|Import \d/);
    expect(window.localStorage.getItem(FLAG)).toBeNull();
    expect(saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('x', null)).not.toBeNull();
  });

  it('retrying the choice after storage recovers persists the flag and closes', async () => {
    await openWithFailedCheck();
    const realSet = localStore.set.bind(localStore);
    const setSpy = vi.spyOn(localStore, 'set').mockImplementationOnce(async () => { throw new Error('quota'); });
    fireEvent.click(screen.getByTestId('import-dismiss'));
    await screen.findByTestId('import-error');
    setSpy.mockImplementation(realSet);

    fireEvent.click(screen.getByTestId('import-dismiss'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await localStore.get(FLAG, false)).toBe(true);
    expect(await localStore.get('x', null)).not.toBeNull();
  });

  it('re-check still recovers without uploading after a failed dismissal', async () => {
    const saveItems = await openWithFailedCheck();
    vi.spyOn(localStore, 'set').mockImplementationOnce(async () => { throw new Error('quota'); });
    fireEvent.click(screen.getByTestId('import-dismiss'));
    await screen.findByTestId('import-error');

    fireEvent.click(screen.getByTestId('import-confirm')); // "Try again" = re-check
    await waitFor(() => expect(screen.getByTestId('import-confirm')).toHaveTextContent('Import 1 diagram'));
    expect(screen.queryByTestId('import-check-error')).toBeNull();
    expect(saveItems).not.toHaveBeenCalled();
  });

  it('busy: a second dismissal or a re-check during the flag write is excluded', async () => {
    await openWithFailedCheck();
    let release!: () => void;
    const realSet = localStore.set.bind(localStore);
    const setSpy = vi.spyOn(localStore, 'set').mockImplementation(async (k: string, v: unknown) => {
      if (k === FLAG) await new Promise<void>((r) => { release = r; });
      return realSet(k, v);
    });
    const listSpy = vi.spyOn(localItems, 'list');
    listSpy.mockClear(); // drop the initial (failed) check call

    fireEvent.click(screen.getByTestId('import-dismiss'));
    await waitFor(() => expect(screen.getByTestId('import-dismiss')).toBeDisabled());
    fireEvent.click(screen.getByTestId('import-dismiss'));
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(setSpy.mock.calls.filter(([k]) => k === FLAG)).toHaveLength(1);
    expect(listSpy).not.toHaveBeenCalled();

    await act(async () => { release(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('AskToImportModal — failed dismissal in the normal (count known) state', () => {
  it('a failed "Don\'t ask again" does not turn Import into a mislabelled retry', async () => {
    useAuthStore.setState({ user: { uid: 'u1', email: null, displayName: null, photoURL: null }, online: true });
    const saveItems = vi.fn(async () => {});
    render(<Host saveItems={saveItems} />);
    await screen.findByText('Import 1 diagram');
    vi.spyOn(localStore, 'set').mockImplementationOnce(async () => { throw new Error('quota'); });
    fireEvent.click(screen.getByTestId('import-dismiss'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/couldn.t save .*don.t ask again/i);
    expect(screen.getByTestId('import-confirm')).toHaveTextContent('Import 1 diagram');
    expect(saveItems).not.toHaveBeenCalled();
  });
});
