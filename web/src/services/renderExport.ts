import { getCompleteHtml } from '../preview/previewHtml';
import type { PreviewExportSnapshot } from '../preview/PreviewFrame';
import type { RenderOptions } from '../preview/previewProtocol';
import { createPreviewRpc, PreviewRpcError } from '../preview/previewRpc';
import { documentPaletteFor } from '../preview/documentPalette';

export type ExportThemeChoice = 'light' | 'match';
export type ExportFormat = 'png' | 'svg';

export function resolveExportTheme(snapshot: PreviewExportSnapshot, choice: ExportThemeChoice): RenderOptions['theme'] {
  return choice === 'match' ? snapshot.theme : 'theme-default';
}

export function canExportSvg(snapshot: PreviewExportSnapshot, _choice: ExportThemeChoice): boolean {
  return !snapshot.css.trim();
}

/** Render a snapshot in a separate iframe so export never repaints the live preview. */
export async function renderDiagramExport(
  snapshot: PreviewExportSnapshot,
  choice: ExportThemeChoice,
  format: ExportFormat,
  signal?: AbortSignal,
  backingColor?: string,
): Promise<string> {
  if (format === 'svg' && !canExportSvg(snapshot, choice)) {
    throw new Error('SVG export does not support custom CSS. Use PNG to preserve custom CSS.');
  }
  const iframe = document.createElement('iframe');
  const abort = new AbortController();
  const cancelExternal = () => abort.abort();
  signal?.addEventListener('abort', cancelExternal, { once: true });
  if (signal?.aborted) abort.abort();
  iframe.title = 'Diagram export renderer';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-100000px;top:0;width:1600px;height:1200px;border:0;pointer-events:none';
  const theme = resolveExportTheme(snapshot, choice);
  const palette = documentPaletteFor(theme);

  const rpc = createPreviewRpc(() => iframe.contentWindow);
  const options = { signal: abort.signal, timeoutMs: 15000 };

  try {
    const ready = rpc.wait((message) => message.type === 'ready', options);
    iframe.srcdoc = getCompleteHtml({ initialTheme: theme, initialPalette: palette });
    document.body.appendChild(iframe);
    await ready;
    const token = 1;
    const rendered = rpc.wait((message) => message.type === 'rendered' && message.token === token, options);
    const renderOptions: RenderOptions = {
      enableMultiTheme: false,
      theme,
      palette,
      stickyOffset: 0,
      renderMode: snapshot.renderMode,
      enableParticipantStyleEditing: false,
    };
    rpc.post({ type: 'updateCss', css: snapshot.css, revision: 1 });
    rpc.post({ type: 'render', code: snapshot.code, options: renderOptions, token });
    await rendered;
    const result = format === 'png'
      ? await rpc.request((id) => ({ type: 'getPng', id, backingColor }), (message, id) => message.type === 'png' && message.id === id, options)
      : await rpc.request((id) => ({ type: 'getSvg', id, backingColor }), (message, id) => message.type === 'svg' && message.id === id, options);
    const value = result.type === 'png' ? result.dataUrl : result.type === 'svg' ? result.svg : null;
    if (!value) throw new Error('Diagram export returned no image.');
    return value;
  } catch (error) {
    if (error instanceof PreviewRpcError && error.reason === 'aborted') throw new Error('Diagram export cancelled.', { cause: error });
    if (error instanceof PreviewRpcError && error.reason === 'timeout') throw new Error('Diagram export timed out.', { cause: error });
    throw error;
  } finally {
    rpc.dispose();
    abort.abort();
    signal?.removeEventListener('abort', cancelExternal);
    iframe.remove();
  }
}
