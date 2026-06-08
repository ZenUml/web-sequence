import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportExportBar } from './ImportExportBar';

describe('ImportExportBar', () => {
  it('clicking lib-export-all calls onExportAll', async () => {
    const onExportAll = vi.fn();
    render(<ImportExportBar onExportAll={onExportAll} onImport={vi.fn()} />);
    await userEvent.click(screen.getByTestId('lib-export-all'));
    expect(onExportAll).toHaveBeenCalledTimes(1);
  });

  it('clicking lib-import does not call onExportAll', async () => {
    const onExportAll = vi.fn();
    render(<ImportExportBar onExportAll={onExportAll} onImport={vi.fn()} />);
    await userEvent.click(screen.getByTestId('lib-import'));
    expect(onExportAll).not.toHaveBeenCalled();
  });

  it('changing lib-import-input reads the file text and calls onImport with it', async () => {
    const onImport = vi.fn();
    render(<ImportExportBar onExportAll={vi.fn()} onImport={onImport} />);

    const text = '{"items":[]}';
    const file = new File([text], 'library.json', { type: 'application/json' });
    // jsdom's File.text() is unreliable across versions — make the source of truth explicit.
    file.text = () => Promise.resolve(text);

    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // onImport is invoked asynchronously after the file text resolves.
    await vi.waitFor(() => expect(onImport).toHaveBeenCalledWith(text));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('changing lib-import-input with no file does not call onImport', () => {
    const onImport = vi.fn();
    render(<ImportExportBar onExportAll={vi.fn()} onImport={onImport} />);
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onImport).not.toHaveBeenCalled();
  });
});
