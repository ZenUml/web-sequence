import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const snapshot: PreviewExportSnapshot = { code: 'A->B: Hello', css: '', theme: 'theme-darcula', renderMode: 'html' };
const onOpenChange = vi.fn();

beforeEach(() => {
  localStorage.clear();
  renderExportMock.mockReset();
  renderExportMock.mockImplementation(async (_snapshot: unknown, _choice: string, format: string, _signal?: AbortSignal): Promise<string> =>
    format === 'svg' ? '<svg viewBox="0 0 10 10"></svg>' : 'data:image/png;base64,iVBORw0KGgo=');
  downloadBlobMock.mockClear();
  onOpenChange.mockClear();
});

describe('ExportDialog', () => {
  it('defaults to Light and remembers Match current theme', async () => {
    const user = userEvent.setup();
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" />);
    const theme = screen.getByRole('combobox', { name: 'Export theme' }) as HTMLSelectElement;
    expect(theme.value).toBe('light');
    await screen.findByRole('img', { name: 'Diagram export preview' });
    expect(renderExportMock).toHaveBeenCalledWith(snapshot, 'light', 'png', expect.any(AbortSignal));
    await user.selectOptions(theme, 'match');
    expect(localStorage.getItem('zenuml.export.themeChoice')).toBe('match');
    await waitFor(() => expect(renderExportMock).toHaveBeenCalledWith(snapshot, 'match', 'png', expect.any(AbortSignal)));
  });

  it('explains and disables SVG when Match resolves to a dark HTML theme', () => {
    localStorage.setItem('zenuml.export.themeChoice', 'match');
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" initialFormat="svg" />);
    expect((screen.getByRole('combobox', { name: 'Export format' }) as HTMLSelectElement).value).toBe('png');
    expect(screen.getByRole('option', { name: 'SVG' })).toBeDisabled();
    expect(screen.getByText(/SVG supports Light only/)).toBeInTheDocument();
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
    render(<ExportDialog open onOpenChange={onOpenChange} snapshot={snapshot} title="Example" initialFormat="svg" />);
    await screen.findByRole('img', { name: 'Diagram export preview' });
    await user.click(screen.getByTestId('export-download'));
    await waitFor(() => expect(downloadBlobMock).toHaveBeenCalledWith('example.svg', expect.objectContaining({ type: 'image/svg+xml' })));
    expect(renderExportMock).toHaveBeenCalledWith(snapshot, 'light', 'svg');
  });
});
