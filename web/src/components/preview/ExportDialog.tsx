import { useEffect, useId, useState } from 'react';
import { Button, Dialog, DialogContent, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../ui';
import type { PreviewExportSnapshot } from '../../preview/PreviewFrame';
import { canExportSvg, renderDiagramExport, resolveExportTheme, type ExportFormat, type ExportThemeChoice } from '../../services/renderExport';
import { diagramFilename, pngDataUrlToBlob, svgOutputToBlob } from '../../services/diagramOutput';
import { downloadBlob } from '../../services/download';
import { useSettingsStore } from '../../state/settingsStore';
import './export-dialog.css';

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
  const workspaceAppearance = useSettingsStore((s) => s.settings.appearance);
  const formatId = useId();
  const themeId = useId();
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
      <DialogContent
        bare
        title="Download diagram"
        description="Preview the exact rendered diagram before downloading."
        className="dl-dialog ui-surface-dark"
        titleClassName="dl-title"
        descriptionClassName="dl-description"
        bodyClassName="dl-body"
        closeClassName="dl-close"
        overlayClassName="dl-overlay"
        restoreFocus
        focusContentOnOpen
      >
        <div data-testid="export-dialog" className="dl-grid">
          <section className="dl-preview-column" aria-label="Export preview">
            <p className="dl-caption">Export preview</p>
            <div className="dl-preview ui-surface-light" aria-busy={loading}>
              {preview ? <img src={preview} alt="Diagram export preview" draggable={false} />
                : <span role="status">{loading ? 'Rendering export preview…' : 'Preview unavailable'}</span>}
            </div>
          </section>
          <div className="dl-settings">
            <div className="dl-fields">
              <div className="dl-field">
                <label htmlFor={formatId}>Format</label>
                <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                  <SelectTrigger id={formatId} surface="dark" aria-label="Export format"><SelectValue /></SelectTrigger>
                  <SelectContent surface="dark" className="dl-select-menu">
                    <SelectItem value="png">PNG image</SelectItem>
                    <SelectItem value="svg" disabled={!svgAllowed}>SVG image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="dl-field">
                <label htmlFor={themeId}>Export theme</label>
                <Select value={choice} onValueChange={(value) => chooseTheme(value as ExportThemeChoice)}>
                  <SelectTrigger id={themeId} surface="dark" aria-label="Export theme"><SelectValue /></SelectTrigger>
                  <SelectContent surface="dark" className="dl-select-menu">
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="match">Match current theme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="dl-helpers">
              <p>Your workspace stays {workspaceAppearance}.</p>
              <p>We’ll remember your export choice.</p>
              {snapshot && choice === 'match' && resolveExportTheme(snapshot, choice) === 'theme-default' && (
                <p>The current diagram uses Light, so both theme choices look the same.</p>
              )}
              {!svgAllowed && <p>{snapshot?.css.trim() ? 'Use PNG to preserve custom CSS. SVG uses a different diagram structure.' : 'SVG supports Light only. Choose Light to download SVG.'}</p>}
              {!snapshot && <p role="status">The diagram is still rendering. Close this window and try again.</p>}
            </div>
            {error && <p role="alert" className="dl-error">{error}</p>}
            <div className="dl-actions">
              <Button surface="dark" variant="subtle" className="dl-cancel" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button surface="dark" data-testid="export-download" variant="primary" className="dl-download" disabled={!preview || loading || downloading || (format === 'svg' && !svgAllowed)} onClick={() => void download()}>
                {downloading ? 'Preparing…' : `Download ${format.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
