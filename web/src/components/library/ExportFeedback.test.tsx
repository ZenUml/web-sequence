import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryFeedback } from './LibraryFeedback';
import { ImportExportBar } from './ImportExportBar';
import { useExportFeedbackStore, runExportAll } from './exportFeedbackStore';
import { useImportFeedbackStore } from './importFeedbackStore';
import type { Item } from '../../domain/types';

// Local fixtures only.
const item = (id: string) => ({ id, title: id, js: 'A.b()', css: '', updatedOn: 1, pages: [] }) as unknown as Item;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

// Mirrors AppRoot wiring: the bar (via HomeView) and the app-level feedback host
// share the same export handler.
function Harness({
  getItems,
  download = vi.fn(),
}: {
  getItems: () => Promise<Item[] | null>;
  download?: (name: string, json: string) => void;
}) {
  const onExportAll = () => runExportAll({ getItems, download, onStart: vi.fn() });
  return (
    <>
      <ImportExportBar onExportAll={() => void onExportAll()} onImport={vi.fn()} />
      <LibraryFeedback onImport={vi.fn()} onExportAll={onExportAll} />
    </>
  );
}

beforeEach(() => {
  useExportFeedbackStore.getState().reset();
  useImportFeedbackStore.getState().reset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Export all feedback', () => {
  it('Download started: real total and filename, says nothing about saving to disk', async () => {
    render(<Harness getItems={async () => [item('a'), item('b'), item('c')]} />);
    await userEvent.click(screen.getByTestId('lib-export-all'));
    const panel = await screen.findByTestId('export-feedback');
    expect(panel).toHaveAttribute('data-state', 'started');
    expect(panel).toHaveTextContent('Download started');
    expect(panel).toHaveTextContent('zenuml-diagrams.json');
    expect(panel).toHaveTextContent('3 diagrams included.');
    expect(panel).toHaveTextContent('Check your browser’s downloads for the file.');
    expect(panel.textContent).not.toMatch(/saved|complete|finished/i);
    expect(screen.getByRole('status')).toHaveTextContent('Download started');
    // Passive success: focus stays where the user was.
    expect(document.activeElement).toBe(screen.getByTestId('lib-export-all'));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('export-feedback')).toBeNull();
  });

  it('Preparing appears only when preparation actually takes time, with no fake progress', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const d = deferred<Item[] | null>();
    render(<Harness getItems={() => d.promise} />);
    await act(async () => { screen.getByTestId('lib-export-all').click(); });
    // Not shown for a quick export.
    expect(screen.queryByTestId('export-feedback')).toBeNull();
    const btn = screen.getByTestId('lib-export-all');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    await act(async () => { vi.advanceTimersByTime(500); });
    const panel = screen.getByTestId('export-feedback');
    expect(panel).toHaveAttribute('data-state', 'preparing');
    expect(panel).toHaveTextContent('Preparing your export');
    expect(panel).toHaveTextContent('Keep browsing while the file is prepared.');
    expect(panel).toHaveTextContent('Preparing…');
    expect(panel.textContent).not.toMatch(/%/);
    expect(screen.queryByRole('button', { name: /done|try again/i })).toBeNull();
    await act(async () => { d.resolve([item('a'), item('b')]); });
    expect(screen.getByTestId('export-feedback')).toHaveAttribute('data-state', 'started');
    expect(screen.getByTestId('export-feedback')).toHaveTextContent('2 diagrams included.');
  });

  it('failure offers Cancel and Try again; Try again re-runs the export', async () => {
    const download = vi.fn().mockImplementationOnce(() => { throw new Error('blocked'); });
    render(<Harness getItems={async () => [item('a')]} download={download} />);
    await userEvent.click(screen.getByTestId('lib-export-all'));
    const panel = await screen.findByTestId('export-feedback');
    expect(panel).toHaveAttribute('data-state', 'failed');
    expect(panel).toHaveTextContent('Couldn’t prepare the export');
    expect(panel).toHaveTextContent('The download couldn’t be started.');
    expect(panel).toHaveTextContent('Your diagrams are still available. Try again.');
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t prepare the export');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('export-feedback')).toHaveAttribute('data-state', 'started');
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('Cancel dismisses failure and returns focus to Export all', async () => {
    render(<Harness getItems={async () => null} />);
    const btn = screen.getByTestId('lib-export-all');
    await userEvent.click(btn);
    await screen.findByTestId('export-feedback');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('export-feedback')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('with no diagrams, Export all is disabled with a reason; activating it shows the empty state', async () => {
    useExportFeedbackStore.getState().setLibraryCount(0);
    const download = vi.fn();
    render(<Harness getItems={async () => []} download={download} />);
    const btn = screen.getByTestId('lib-export-all');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAccessibleDescription('No diagrams to export');
    await userEvent.click(btn);
    const panel = await screen.findByTestId('export-feedback');
    expect(panel).toHaveAttribute('data-state', 'empty');
    expect(panel).toHaveTextContent('No diagrams to export');
    expect(panel).toHaveTextContent('0 diagrams');
    expect(panel).toHaveTextContent('There are no saved diagrams in this library.');
    expect(panel).toHaveTextContent('Create or import a diagram first.');
    expect(download).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('export-feedback')).toBeNull();
  });

  it('starting an export clears finished import feedback so panels never pile up', async () => {
    useImportFeedbackStore.setState({ phase: 'success', added: 1, updated: 0, fileName: 'x.json' });
    render(<Harness getItems={async () => [item('a')]} />);
    expect(screen.getByTestId('import-feedback')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('lib-export-all'));
    await screen.findByTestId('export-feedback');
    expect(screen.queryByTestId('import-feedback')).toBeNull();
  });

  it('panels use the shared scoped classes and decorative icons', async () => {
    render(<Harness getItems={async () => [item('a')]} />);
    await userEvent.click(screen.getByTestId('lib-export-all'));
    const panel = await screen.findByTestId('export-feedback');
    expect(panel).toHaveClass('import-feedback');
    expect(panel).toHaveAttribute('aria-labelledby');
    panel.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
  });
});

describe('Export all feedback — account changed (cancelled)', () => {
  it('says no file was downloaded and offers Export again for the current library', async () => {
    const onExportAll = vi.fn();
    useExportFeedbackStore.setState({ phase: 'cancelled' });
    render(<LibraryFeedback onImport={vi.fn()} onExportAll={onExportAll} />);
    const panel = screen.getByTestId('export-feedback');
    expect(panel).toHaveAttribute('data-state', 'cancelled');
    expect(panel).toHaveTextContent('Export canceled');
    expect(panel).toHaveTextContent('No file was downloaded.');
    expect(panel).not.toHaveTextContent(/Download started|included/);
    await userEvent.click(screen.getByRole('button', { name: 'Export again' }));
    expect(onExportAll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('library-feedback-status')).toHaveTextContent('Export canceled');
  });
});
