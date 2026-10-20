import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportFeedback } from './ImportFeedback';
import { ImportExportBar } from './ImportExportBar';
import { useImportFeedbackStore, runImport, readImportFile, useImportBusy } from './importFeedbackStore';

// Local fixture data only.
const exportText = (...ids: string[]) =>
  JSON.stringify({ items: ids.map((id) => ({ id, title: id, js: 'A.b()', css: '' })) });

function fileWith(text: string, name = 'zenuml-diagrams.json'): File {
  const f = new File([text], name, { type: 'application/json' });
  f.text = () => Promise.resolve(text);
  return f;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Mirrors AppRoot wiring: Home renders ImportExportBar (via HomeView) and the
// app root renders ImportFeedback, both driving the same import handler.
function Harness({
  saveItems = async () => {},
  existingIds = [] as string[],
  onItemsAdded = vi.fn(),
}: {
  saveItems?: (items: Record<string, unknown>) => Promise<void>;
  existingIds?: string[];
  onItemsAdded?: (n: number) => void;
}) {
  const onImport = (text: string) => runImport(text, { existingIds, saveItems: saveItems as never, onItemsAdded });
  return (
    <>
      <ImportExportBar onExportAll={vi.fn()} onImport={(t) => void onImport(t)} />
      <a href="#elsewhere">Browse diagrams</a>
      <ImportFeedback onImport={onImport} />
    </>
  );
}

async function choose(file: File, testId = 'lib-import-input') {
  const input = screen.getByTestId(testId) as HTMLInputElement;
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
}

beforeEach(() => {
  useImportFeedbackStore.getState().reset();
  document.documentElement.removeAttribute('data-appearance');
});

describe('ImportFeedback — success', () => {
  it('shows real filename and separate added/updated counts in a nonmodal status', async () => {
    render(<Harness existingIds={['e1']} />);
    await choose(fileWith(exportText('n1', 'n1', 'e1', 'n2'), 'team-backup.json'));
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'success');
    // Announced through the always-mounted polite region, not as an alert.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Import complete. team-backup.json. 2 diagrams added. 1 diagram updated.',
    );
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(panel).toHaveTextContent('team-backup.json');
    expect(panel).toHaveTextContent('2 diagrams added.');
    expect(panel).toHaveTextContent('1 diagram updated.');
    // Nonmodal labelled region: no dialog semantics, no overlay, page stays interactive.
    expect(screen.getByRole('region', { name: 'Import complete' })).toBe(panel);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Browse diagrams')).not.toHaveAttribute('aria-hidden');
  });

  it('does not steal focus on success; Done dismisses and leaves nothing behind', async () => {
    render(<Harness />);
    const importBtn = screen.getByTestId('lib-import');
    importBtn.focus();
    await choose(fileWith(exportText('a')));
    await screen.findByTestId('import-feedback');
    expect(document.activeElement).toBe(importBtn);
    expect(screen.getByTestId('import-feedback')).toHaveTextContent('1 diagram added.');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('import-feedback')).toBeNull();
  });

  it('shows an update-only message when every id already existed', async () => {
    render(<Harness existingIds={['a', 'b']} />);
    await choose(fileWith(exportText('a', 'b')));
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'success');
    expect(panel).toHaveTextContent('2 diagrams updated.');
    expect(panel).not.toHaveTextContent('added');
  });
});

describe('ImportFeedback — invalid file', () => {
  it('invalid JSON: actionable copy, no raw parser text, focus on Choose another file', async () => {
    render(<Harness />);
    await choose(fileWith('{"items": [ broken', 'notes.json'));
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('This file can’t be imported. notes.json.');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(panel).toHaveTextContent('notes.json');
    expect(panel).toHaveTextContent('Choose a ZenUML JSON export file.');
    expect(panel).toHaveTextContent('isn’t valid JSON');
    expect(panel.textContent).not.toMatch(/SyntaxError|Unexpected token|at line|position/i);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Choose another file' }));
  });

  it('empty or unsupported export explains what ZenUML JSON export is expected', async () => {
    render(<Harness />);
    await choose(fileWith('{"items":[]}', 'empty.json'));
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'invalid');
    expect(panel).toHaveTextContent('No diagrams were found');
    expect(panel).toHaveTextContent('Export all');
    expect(panel).not.toHaveTextContent('Import complete');
  });

  it('file read failure offers Choose another file, not Try again', async () => {
    render(<Harness />);
    const f = new File(['x'], 'moved.json');
    f.text = () => Promise.reject(new DOMException('could not be read', 'NotReadableError'));
    await choose(f);
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'readFailed');
    expect(panel).toHaveTextContent('moved.json');
    expect(panel).toHaveTextContent('couldn’t be read');
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('Choose another file opens a picker, and the next file replaces the error', async () => {
    render(<Harness />);
    await choose(fileWith('nope'));
    await screen.findByTestId('import-feedback');
    const picker = screen.getByTestId('import-feedback-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(picker, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
    expect(clickSpy).toHaveBeenCalled();
    await choose(fileWith(exportText('ok'), 'good.json'), 'import-feedback-input');
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'success'));
    expect(panel).toHaveTextContent('good.json');
  });

  it('a canceled picker (no file) is a normal cancel: no error, existing state kept', async () => {
    render(<Harness />);
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { files: [] } }); });
    expect(screen.queryByTestId('import-feedback')).toBeNull();
    expect(useImportFeedbackStore.getState().phase).toBe('idle');
  });

  it('Cancel and Escape dismiss failure feedback and return focus to the Import button', async () => {
    render(<Harness />);
    const importBtn = screen.getByTestId('lib-import');
    importBtn.focus();
    await choose(fileWith('nope'));
    await screen.findByTestId('import-feedback');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('import-feedback')).toBeNull();
    expect(document.activeElement).toBe(importBtn);

    importBtn.focus();
    await choose(fileWith('nope'));
    await screen.findByTestId('import-feedback');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('import-feedback')).toBeNull();
    expect(document.activeElement).toBe(importBtn);
  });

  it('the same file can be chosen again (input value is reset)', async () => {
    render(<Harness />);
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await choose(fileWith('nope'));
    expect(input.value).toBe('');
  });
});

describe('ImportFeedback — save failure', () => {
  it('rejected save shows Couldn’t finish importing without claiming counts or rollback', async () => {
    const onItemsAdded = vi.fn();
    render(
      <Harness
        onItemsAdded={onItemsAdded}
        saveItems={async () => { throw new Error('FirebaseError: [code=unavailable]: stack trace'); }}
      />,
    );
    await choose(fileWith(exportText('a', 'b', 'c')));
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'saveFailed');
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t finish importing');
    expect(panel).toHaveTextContent('Some diagrams may not have been saved.');
    expect(panel).toHaveTextContent('Retry the same file, or choose another one.');
    expect(panel.textContent).not.toMatch(/FirebaseError|stack|\d+ diagrams?|no diagrams (were )?changed|rolled back/i);
    expect(onItemsAdded).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }));
  });

  it('Try again resubmits the held input with the same ids, then succeeds', async () => {
    const saveItems = vi
      .fn<(items: Record<string, unknown>) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    render(<Harness saveItems={saveItems} />);
    await choose(fileWith(exportText('a', 'b'), 'retry-me.json'));
    await screen.findByTestId('import-feedback');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'success'));
    expect(panel).toHaveTextContent('retry-me.json');
    expect(panel).toHaveTextContent('2 diagrams added.');
    expect(saveItems).toHaveBeenCalledTimes(2);
    expect(Object.keys(saveItems.mock.calls[1][0])).toEqual(Object.keys(saveItems.mock.calls[0][0]));
  });

  it('pending save disables Import and blocks a second submission', async () => {
    const d = deferred();
    const saveItems = vi.fn(() => d.promise);
    render(<Harness saveItems={saveItems} />);
    await choose(fileWith(exportText('a')));
    const importBtn = screen.getByTestId('lib-import');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    expect(importBtn).toHaveAttribute('aria-disabled', 'true');
    expect(importBtn).toHaveAttribute('aria-busy', 'true');
    expect(importBtn).toHaveTextContent('Importing…');
    expect(input).toBeDisabled();
    const clickSpy = vi.spyOn(input, 'click');
    await userEvent.click(importBtn);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('import-feedback')).toBeNull();
    // Even a change event that slips through (e.g. a second picker) is ignored.
    await choose(fileWith(exportText('b')));
    expect(saveItems).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve(); });
    expect(await screen.findByTestId('import-feedback')).toHaveAttribute('data-state', 'success');
    expect(screen.getByTestId('lib-import')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('lib-import')).toHaveTextContent('Import');
  });
});

describe('ImportFeedback — appearance', () => {
  it('uses scoped semantic-token classes, follows data-appearance, actions are real buttons', async () => {
    document.documentElement.dataset.appearance = 'dark';
    render(<Harness saveItems={async () => { throw new Error('x'); }} />);
    await choose(fileWith(exportText('a')));
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveClass('import-feedback');
    // Theme comes from the shared :root[data-appearance] tokens, not a private palette.
    expect(panel.getAttribute('style') ?? '').not.toMatch(/#[0-9a-f]{3,6}/i);
    for (const name of ['Cancel', 'Try again']) {
      const b = screen.getByRole('button', { name });
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
    }
    // Status icons are decorative; the heading carries the meaning.
    panel.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    expect(panel).toHaveAttribute('aria-labelledby');
  });
});

// Integration contract for any other import trigger (e.g. the Diagrams HomeSidebar):
// call readImportFile(file, onImport) instead of onImport(await file.text()), and use
// useImportBusy() for the control's pending state.
function SidebarLikeImport({ onImport }: { onImport(text: string): void }) {
  const busy = useImportBusy();
  return (
    <label>
      {busy ? 'Importing…' : 'Import diagrams'}
      <input
        type="file"
        data-testid="sidebar-import-input"
        aria-busy={busy || undefined}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) await readImportFile(file, onImport);
        }}
      />
    </label>
  );
}

describe('Public import API (sidebar contract)', () => {
  function SidebarHarness({ saveItems }: { saveItems: (items: Record<string, unknown>) => Promise<void> }) {
    const onImport = (text: string) =>
      runImport(text, { existingIds: async () => ['old'], saveItems: saveItems as never, onItemsAdded: vi.fn() });
    return (
      <>
        <SidebarLikeImport onImport={(t) => void onImport(t)} />
        <ImportFeedback onImport={onImport} />
      </>
    );
  }

  it('gets filename, busy state, duplicate/update counts and blocks a concurrent second file', async () => {
    const d = deferred();
    const saveItems = vi.fn(() => d.promise);
    render(<SidebarHarness saveItems={saveItems} />);
    await choose(fileWith(exportText('old', 'new', 'new'), 'sidebar.json'), 'sidebar-import-input');
    expect(screen.getByText('Importing…')).toBeInTheDocument();
    await choose(fileWith(exportText('other')), 'sidebar-import-input');
    expect(saveItems).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve(); });
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveTextContent('sidebar.json');
    expect(panel).toHaveTextContent('1 diagram added. 1 diagram updated.');
    expect(screen.getByText('Import diagrams')).toBeInTheDocument();
  });

  it('read failure and save failure surface as feedback with no unhandled rejection', async () => {
    const saveItems = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<SidebarHarness saveItems={saveItems} />);
    const bad = new File(['x'], 'gone.json');
    bad.text = () => Promise.reject(new DOMException('x', 'NotReadableError'));
    await choose(bad, 'sidebar-import-input');
    expect(await screen.findByTestId('import-feedback')).toHaveAttribute('data-state', 'readFailed');
    await choose(fileWith(exportText('new'), 'retry.json'), 'sidebar-import-input');
    await waitFor(() => expect(screen.getByTestId('import-feedback')).toHaveAttribute('data-state', 'saveFailed'));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('import-feedback')).toHaveAttribute('data-state', 'success'));
    expect(screen.getByTestId('import-feedback')).toHaveTextContent('retry.json');
  });
});

describe('ImportFeedback — account changed (cancelled)', () => {
  it('before any write: says nothing was imported, offers Choose another file, alerts', async () => {
    useImportFeedbackStore.setState({ phase: 'cancelled', fileName: 'team-backup.json', writesMayHaveStarted: false });
    render(<ImportFeedback onImport={vi.fn()} />);
    const panel = screen.getByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'cancelled');
    expect(panel).toHaveTextContent('Import canceled');
    expect(panel).toHaveTextContent('No diagrams were imported.');
    expect(panel).not.toHaveTextContent(/added|updated|complete/i);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(screen.getByTestId('library-feedback-alert')).toHaveTextContent('Import canceled');
  });

  it('after writes may have started: no rollback claim, nothing claimed for the current library', async () => {
    useImportFeedbackStore.setState({ phase: 'cancelled', fileName: 'team-backup.json', writesMayHaveStarted: true });
    render(<ImportFeedback onImport={vi.fn()} />);
    const panel = screen.getByTestId('import-feedback');
    expect(panel).toHaveTextContent('Import interrupted');
    expect(panel).toHaveTextContent('Some diagrams may have been saved before the change.');
    // IE-C2: after A → B → A an issued A commit may have reached the library shown
    // now, so the copy makes no claim about it either way.
    expect(panel).not.toHaveTextContent('Nothing was saved to the library shown now.');
    expect(panel).toHaveTextContent('Check your diagrams before importing this file again.');
    expect(panel).not.toHaveTextContent(/rolled back|undone|reverted/i);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
