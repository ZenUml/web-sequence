import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from './ExportDialog';
import type { PreviewExportSnapshot } from '../../preview/PreviewFrame';

const renderExportMock = vi.hoisted(() => vi.fn(async (_snapshot: unknown, _choice: string, format: string, _signal?: AbortSignal): Promise<string> =>
  format === 'svg' ? '<svg viewBox="0 0 10 10"></svg>' : 'data:image/png;base64,iVBORw0KGgo='));
const downloadBlobMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/renderExport', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../services/renderExport')>(),
  renderDiagramExport: renderExportMock,
}));
vi.mock('../../services/download', () => ({ downloadBlob: downloadBlobMock }));

const snapshot: PreviewExportSnapshot = { code: 'A->B: Hello', css: '', theme: 'theme-dark', renderMode: 'html' };
const onOpenChange = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

async function chooseOption(name: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

async function expectSvgDisabled() {
  await userEvent.click(screen.getByRole('combobox', { name: 'Export format' }));
  expect(await screen.findByRole('option', { name: 'SVG image' })).toHaveAttribute('aria-disabled', 'true');
  await userEvent.keyboard('{Escape}');
}

beforeEach(() => {
  localStorage.clear();
  renderExportMock.mockReset();
  renderExportMock.mockImplementation(async (_snapshot: unknown, _choice: string, format: string, _signal?: AbortSignal): Promise<string> =>
    format === 'svg' ? '<svg viewBox="0 0 10 10"></svg>' : 'data:image/png;base64,iVBORw0KGgo=');
  downloadBlobMock.mockReset();
  onOpenChange.mockClear();
});

describe('ExportDialog', () => {
  it.each(['Cancel', 'Close', 'Escape'])('%s returns focus to the opener without downloading', async (action) => {
    function Host() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open download</button><ExportDialog open={open} onOpenChange={setOpen} snapshot={snapshot} title="Example" /></>;
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open download' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Preview the exact rendered diagram before downloading.');
    expect(screen.getByRole('dialog')).toHaveFocus();
    if (action === 'Escape') await userEvent.keyboard('{Escape}');
    else await userEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(downloadBlobMock).not.toHaveBeenCalled();
  });

  it('chooses the persisted theme by keyboard and skips disabled SVG without leaving the dialog', async () => {
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={{ ...snapshot, css: '.participant{color:blue}' }} title="Example" />);
    const theme = screen.getByRole('combobox', { name: 'Export theme' });
    theme.focus();
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    expect(theme).toHaveTextContent('Match current theme');
    expect(localStorage.getItem('zenuml.export.themeChoice')).toBe('match');
    const format = screen.getByRole('combobox', { name: 'Export format' });
    format.focus();
    await userEvent.keyboard('{ArrowDown}{End}{Enter}');
    expect(format).toHaveTextContent('PNG image');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps styled HTML exports on PNG with an explicit CSS compatibility explanation', async () => {
    const styled = { ...snapshot, css: '#diagram .sequence-diagram .participant { background: blue; }' };
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={styled} title="Styled" initialFormat="svg" />);
    await screen.findByRole('img', { name: 'Diagram export preview' });
    await expectSvgDisabled();
    expect(screen.getByRole('combobox', { name: 'Export format' })).toHaveTextContent('PNG image');
    expect(screen.getByText(/use PNG to preserve custom CSS/i)).toBeVisible();
  });

  it('keeps download unavailable until the frozen, styled snapshot preview resolves', async () => {
    const user = userEvent.setup();
    const preview = deferred<string>();
    const onExported = vi.fn();
    const styledSnapshot = Object.freeze({ ...snapshot, css: '.participant { color: red; }' });
    renderExportMock.mockReturnValueOnce(preview.promise);
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={styledSnapshot} title="Example" onExported={onExported} />);

    expect(screen.getByText('Rendering export preview…')).toBeVisible();
    expect(screen.queryByRole('img', { name: 'Diagram export preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(onExported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(renderExportMock).toHaveBeenCalledWith(styledSnapshot, 'light', 'png', expect.any(AbortSignal));

    await act(async () => preview.resolve('data:image/png;base64,iVBORw0KGgo='));
    expect(screen.getByRole('img', { name: 'Diagram export preview' })).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgo=');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    expect(styledSnapshot).toEqual({ ...snapshot, css: '.participant { color: red; }' });
  });

  it('shows a rejected preview without success and retries when the dialog is reopened', async () => {
    const user = userEvent.setup();
    const failedPreview = deferred<string>();
    const retryPreview = deferred<string>();
    const onExported = vi.fn();
    renderExportMock.mockReturnValueOnce(failedPreview.promise).mockReturnValueOnce(retryPreview.promise);
    const props = { onOpenChange, snapshot, title: 'Example', onExported };
    const { rerender } = render(<ExportDialog open {...props} />);

    await act(async () => failedPreview.reject(new Error('Preview renderer unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('Preview renderer unavailable');
    expect(screen.getByText('Preview unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(onExported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(<ExportDialog open={false} {...props} />);
    rerender(<ExportDialog open {...props} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Rendering export preview…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    await act(async () => retryPreview.resolve('data:image/png;base64,iVBORw0KGgo='));
    expect(screen.getByRole('img', { name: 'Diagram export preview' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    expect(renderExportMock).toHaveBeenCalledTimes(2);
    expect(onExported).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('ignores a stale preview %s after a theme change', async (settlement) => {
    const stalePreview = deferred<string>();
    const currentPreview = deferred<string>();
    renderExportMock.mockReturnValueOnce(stalePreview.promise).mockReturnValueOnce(currentPreview.promise);
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" />);
    const staleSignal = renderExportMock.mock.calls[0][3] as AbortSignal;
    await chooseOption('Export theme', 'Match current theme');
    expect(staleSignal.aborted).toBe(true);
    await act(async () => currentPreview.resolve('data:image/png;base64,Y3VycmVudA=='));
    await act(async () => {
      if (settlement === 'resolve') stalePreview.resolve('data:image/png;base64,c3RhbGU=');
      else stalePreview.reject(new Error('Stale preview failed'));
    });

    expect(screen.getByRole('img', { name: 'Diagram export preview' })).toHaveAttribute('src', 'data:image/png;base64,Y3VycmVudA==');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Export format' }));
    expect(await screen.findByRole('option', { name: 'SVG image' })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('ignores a stale snapshot preview %s after the document changes', async (settlement) => {
    const stale = deferred<string>();
    const current = deferred<string>();
    renderExportMock.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    const { rerender } = render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="First" />);
    const signal = renderExportMock.mock.calls[0][3] as AbortSignal;
    const next = { ...snapshot, code: 'Different -> Diagram: Current' };
    rerender(<ExportDialog open onOpenChange={onOpenChange} snapshot={next} title="Second" />);
    expect(signal.aborted).toBe(true);
    await act(async () => current.resolve('data:image/png;base64,Y3VycmVudA=='));
    await act(async () => {
      if (settlement === 'resolve') stale.resolve('data:image/png;base64,c3RhbGU=');
      else stale.reject(new Error('Old document failed'));
    });
    expect(screen.getByRole('img', { name: 'Diagram export preview' })).toHaveAttribute('src', 'data:image/png;base64,Y3VycmVudA==');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('export-download')).toBeEnabled();
    expect(downloadBlobMock).not.toHaveBeenCalled();
  });

  it('keeps SVG preparation pending, shows rejection, and downloads only after a successful retry', async () => {
    const user = userEvent.setup();
    const failedDownload = deferred<string>();
    const retryDownload = deferred<string>();
    const onExported = vi.fn();
    renderExportMock.mockResolvedValueOnce('data:image/png;base64,iVBORw0KGgo=')
      .mockReturnValueOnce(failedDownload.promise).mockReturnValueOnce(retryDownload.promise);
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" initialFormat="svg" onExported={onExported} />);
    await screen.findByRole('img', { name: 'Diagram export preview' });
    await user.click(screen.getByRole('button', { name: 'Download SVG' }));
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(onExported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Preparing…' }));
    expect(renderExportMock).toHaveBeenCalledTimes(2);

    await act(async () => failedDownload.reject(new Error('SVG renderer unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('SVG renderer unavailable');
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
    expect(downloadBlobMock).not.toHaveBeenCalled();
    expect(onExported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Download SVG' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    expect(onExported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => retryDownload.resolve('<svg viewBox="0 0 10 10"></svg>'));
    expect(downloadBlobMock).toHaveBeenCalledExactlyOnceWith('example.svg', expect.objectContaining({ type: 'image/svg+xml' }));
    expect(onExported).toHaveBeenCalledExactlyOnceWith('svg');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(downloadBlobMock.mock.invocationCallOrder[0]).toBeLessThan(onExported.mock.invocationCallOrder[0]);
    expect(onExported.mock.invocationCallOrder[0]).toBeLessThan(onOpenChange.mock.invocationCallOrder[0]);
  });

  it('keeps the dialog open when starting the browser download throws and allows the same PNG to retry', async () => {
    const user = userEvent.setup();
    const onExported = vi.fn();
    downloadBlobMock.mockImplementationOnce(() => { throw new Error('Browser download unavailable'); });
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" onExported={onExported} />);
    await screen.findByRole('img', { name: 'Diagram export preview' });
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Browser download unavailable');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
    expect(onExported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Download PNG' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(downloadBlobMock).toHaveBeenCalledTimes(2);
    expect(downloadBlobMock).toHaveBeenLastCalledWith('example.png', expect.objectContaining({ type: 'image/png' }));
    expect(renderExportMock).toHaveBeenCalledTimes(1);
    expect(onExported).toHaveBeenCalledExactlyOnceWith('png');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('defaults to Light and remembers Match current theme', async () => {
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" />);
    const theme = screen.getByRole('combobox', { name: 'Export theme' });
    expect(theme).toHaveTextContent('Light');
    await screen.findByRole('img', { name: 'Diagram export preview' });
    expect(renderExportMock).toHaveBeenCalledWith(snapshot, 'light', 'png', expect.any(AbortSignal));
    await chooseOption('Export theme', 'Match current theme');
    expect(localStorage.getItem('zenuml.export.themeChoice')).toBe('match');
    await waitFor(() => expect(renderExportMock).toHaveBeenCalledWith(snapshot, 'match', 'png', expect.any(AbortSignal)));
  });

  it('allows native dark SVG with Match current theme', async () => {
    localStorage.setItem('zenuml.export.themeChoice', 'match');
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" initialFormat="svg" />);
    expect(screen.getByRole('combobox', { name: 'Export format' })).toHaveTextContent('SVG image');
    expect(screen.queryByText(/SVG supports Light only/)).not.toBeInTheDocument();
    await screen.findByRole('img', { name: 'Diagram export preview' });
  });

  it('aborts a pending export preview when closed', async () => {
    renderExportMock.mockImplementation(() => new Promise(() => {}));
    const { rerender } = render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" />);
    await waitFor(() => expect(renderExportMock).toHaveBeenCalledTimes(1));
    const signal = renderExportMock.mock.calls[0][3] as AbortSignal;
    expect(signal.aborted).toBe(false);
    rerender(<ExportDialog open={false} onOpenChange={onOpenChange} snapshot={snapshot} title="Example" />);
    expect(signal.aborted).toBe(true);
  });

  it('downloads the selected SVG after a Light export preview', async () => {
    const user = userEvent.setup();
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" />);
    await screen.findByRole('img', { name: 'Diagram export preview' });
    await chooseOption('Export format', 'SVG image');
    await user.click(screen.getByTestId('export-download'));
    await waitFor(() => expect(downloadBlobMock).toHaveBeenCalledWith('example.svg', expect.objectContaining({ type: 'image/svg+xml' })));
    expect(renderExportMock).toHaveBeenCalledWith(snapshot, 'light', 'svg');
  });
});
