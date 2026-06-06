import { useRef } from 'react';
import { Button } from '../../ui';

export interface ImportExportBarProps {
  onExportAll(): void;
  onImport(text: string): void;
}

// Presentational toolbar for bulk library import/export. Lives on the dark `ink`
// chrome, so Buttons use the default dark surface with quiet variants. The Import
// button proxies to a hidden file input; reading the file's text is local I/O
// (no service calls) so it stays presentational and testable.
export function ImportExportBar({ onExportAll, onImport }: ImportExportBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    onImport(text);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="subtle" size="sm" data-testid="lib-export-all" onClick={onExportAll}>
        Export all
      </Button>
      <Button
        variant="ghost"
        size="sm"
        data-testid="lib-import"
        onClick={() => inputRef.current?.click()}
      >
        Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        data-testid="lib-import-input"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
