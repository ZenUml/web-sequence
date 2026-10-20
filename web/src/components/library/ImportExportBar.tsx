import { useId, useRef } from 'react';
import { Button } from '../../ui';
import { readImportFile, useImportBusy, type ImportFileContext } from './importFeedbackStore';
import { useExportBusy, useExportDisabled } from './exportFeedbackStore';

export interface ImportExportBarProps {
  onExportAll(): void;
  // `context` carries the identity captured before the file was read (IE-C1).
  onImport(text: string, context?: ImportFileContext): void;
}

// Presentational toolbar for bulk library import/export. Lives on the dark `ink`
// chrome, so Buttons use the default dark surface with quiet variants. Import and
// Export are peer actions, so they share the SAME quiet weight (both `ghost`) and
// sit in one grouped cluster — no subtle/filled vs ghost mismatch. The Import
// button proxies to a hidden file input; readImportFile records the chosen file's
// name for the import feedback panel, then hands its text to onImport unchanged.
export function ImportExportBar({ onExportAll, onImport }: ImportExportBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useImportBusy();
  const exporting = useExportBusy();
  // Known-empty library: Export all is disabled with its reason. It stays focusable
  // (aria-disabled), and activating it shows the "No diagrams to export" panel.
  const nothingToExport = useExportDisabled();
  const exportReasonId = useId();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change event.
    e.target.value = '';
    // No file = the picker was canceled: a normal cancel, not an error.
    if (!file) return;
    await readImportFile(file, onImport);
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded border border-ink-line/40 p-0.5"
      role="group"
      aria-label="Import and export"
    >
      <Button
        variant="ghost"
        size="sm"
        data-testid="lib-export-all"
        aria-disabled={exporting || nothingToExport || undefined}
        aria-busy={exporting || undefined}
        aria-describedby={nothingToExport ? exportReasonId : undefined}
        className={exporting ? 'cursor-progress opacity-60' : nothingToExport ? 'opacity-50' : undefined}
        onClick={() => { if (!exporting) onExportAll(); }}
      >
        Export all
      </Button>
      {nothingToExport && (
        <span id={exportReasonId} hidden>
          No diagrams to export
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        data-testid="lib-import"
        // aria-disabled (not disabled) while pending: a disabled button drops focus to
        // <body>, losing the place keyboard users return to after the import.
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        className={busy ? 'cursor-progress opacity-60' : undefined}
        onClick={() => { if (!busy) inputRef.current?.click(); }}
      >
        {busy ? 'Importing…' : 'Import'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        data-testid="lib-import-input"
        className="hidden"
        disabled={busy}
        onChange={handleFileChange}
      />
    </div>
  );
}
