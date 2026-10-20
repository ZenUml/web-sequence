import { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent } from '../../ui';
import type { PreviewExportSnapshot } from '../../preview/PreviewFrame';
import { canExportSvg, renderDiagramExport, resolveExportTheme, type ExportFormat, type ExportThemeChoice } from '../../services/renderExport';
import { diagramFilename, pngDataUrlToBlob, svgOutputToBlob } from '../../services/diagramOutput';
import { downloadBlob } from '../../services/download';

const THEME_KEY = 'zenuml.export.themeChoice';

function savedThemeChoice(): ExportThemeChoice {
  try { return localStorage.getItem(THEME_KEY) === 'match' ? 'match' : 'light'; }
  catch { return 'light'; }
}

export interface ExportDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  snapshot: PreviewExportSnapshot | null;
  title: string;
  initialFormat?: ExportFormat;
  onExported?(format: ExportFormat): void;
}

export function ExportDialog({ open, onOpenChange, snapshot, title, initialFormat = 'png', onExported }: ExportDialogProps) {
  const [choice, setChoice] = useState<ExportThemeChoice>(savedThemeChoice);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgAllowed = !!snapshot && canExportSvg(snapshot, choice);

  useEffect(() => {
    if (open) setFormat(initialFormat === 'svg' && !svgAllowed ? 'png' : initialFormat);
    // Only reset when opening; theme changes are handled by chooseTheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFormat]);

  useEffect(() => {
    if (!open || !snapshot) return;
    let active = true;
    const controller = new AbortController();
    setPreview(null);
    setError(null);
    setLoading(true);
    void renderDiagramExport(snapshot, choice, 'png', controller.signal).then((dataUrl) => {
      if (active) setPreview(dataUrl);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not render the export preview.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [open, snapshot, choice]);

  function chooseTheme(value: ExportThemeChoice) {
    setChoice(value);
    try { localStorage.setItem(THEME_KEY, value); } catch { /* private storage can be unavailable */ }
    if (value === 'match' && snapshot && !canExportSvg(snapshot, value)) setFormat('png');
  }

  async function download() {
    if (!snapshot || !preview || downloading || (format === 'svg' && !svgAllowed)) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = format === 'png'
        ? pngDataUrlToBlob(preview)
        : svgOutputToBlob(await renderDiagramExport(snapshot, choice, 'svg'));
      downloadBlob(diagramFilename(title, format), blob);
      onExported?.(format);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not download the diagram.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Download diagram" description="Preview the exact rendered diagram before downloading." className="w-[min(720px,calc(100vw-2rem))]">
        <div data-testid="export-dialog" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">Theme
              <select aria-label="Export theme" value={choice} onChange={(event) => chooseTheme(event.target.value as ExportThemeChoice)} className="rounded border border-ink-line bg-ink-900 px-3 py-2 text-ondark-strong">
                <option value="light">Light</option>
                <option value="match">Match current theme</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Format
              <select aria-label="Export format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="rounded border border-ink-line bg-ink-900 px-3 py-2 text-ondark-strong">
                <option value="png">PNG</option>
                <option value="svg" disabled={!svgAllowed}>SVG</option>
              </select>
            </label>
          </div>
          {snapshot && choice === 'match' && resolveExportTheme(snapshot, choice) === 'theme-default' && (
            <p className="text-xs text-ondark-muted">The current diagram uses Light, so both theme choices look the same.</p>
          )}
          {!svgAllowed && <p className="text-xs text-ondark-muted">SVG supports Light only. Choose Light to download SVG.</p>}
          {!snapshot && <p role="status" className="text-xs text-ondark-muted">The diagram is still rendering. Close this window and try again.</p>}
          <div className="flex min-h-48 max-h-[45vh] items-center justify-center overflow-auto rounded border border-ink-line bg-white p-3">
            {preview ? <img src={preview} alt="Diagram export preview" className="max-h-[42vh] max-w-full object-contain" />
              : <span className="text-sm text-ink-600">{loading ? 'Rendering export preview…' : 'Preview unavailable'}</span>}
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button data-testid="export-download" variant="primary" disabled={!preview || loading || downloading || (format === 'svg' && !svgAllowed)} onClick={() => void download()}>
              {downloading ? 'Preparing…' : `Download ${format.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
