import { getCompleteHtml } from '../preview/previewHtml';
import type { PreviewExportSnapshot } from '../preview/PreviewFrame';
import type { FrameMessage, RenderOptions } from '../preview/previewProtocol';

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

  const waitFor = (predicate: (message: FrameMessage) => boolean, timeoutMs = 15000) => new Promise<FrameMessage>((resolve, reject) => {
    if (abort.signal.aborted) {
      reject(new Error('Diagram export cancelled.'));
      return;
    }
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); abort.signal.removeEventListener('abort', cancelled); };
    const cancelled = () => { cleanup(); reject(new Error('Diagram export cancelled.')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Diagram export timed out.')); }, timeoutMs);
    function receive(event: MessageEvent) {
      if (event.source !== iframe.contentWindow || !event.data || typeof event.data.type !== 'string') return;
      const message = event.data as FrameMessage;
      if (message.type === 'error') {
        cleanup(); reject(new Error(message.message));
      } else if (predicate(message)) {
        cleanup(); resolve(message);
      }
    }
    window.addEventListener('message', receive);
    abort.signal.addEventListener('abort', cancelled, { once: true });
  });

  try {
    const ready = waitFor((message) => message.type === 'ready');
    iframe.srcdoc = getCompleteHtml();
    document.body.appendChild(iframe);
    await ready;
    const post = (message: unknown) => iframe.contentWindow?.postMessage(message, '*');
    const theme = resolveExportTheme(snapshot, choice);
    const token = 1;
    const rendered = waitFor((message) => message.type === 'rendered' && message.token === token);
    const options: RenderOptions = {
      enableMultiTheme: false,
      theme,
      stickyOffset: 0,
      renderMode: snapshot.renderMode,
      enableParticipantStyleEditing: false,
    };
    post({ type: 'updateCss', css: snapshot.css });
    post({ type: 'render', code: snapshot.code, options, token });
    await rendered;
    // Core commits layout after its render promise. Read the actual DOM twice so
    // long/wide diagrams do not inherit the provisional first contentSize report.
    for (let pass = 0; pass < 2; pass += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const doc = iframe.contentDocument;
      const width = doc?.querySelector('.bg-skin-canvas')?.scrollWidth ?? doc?.getElementById('diagram')?.scrollWidth ?? 0;
      const height = doc?.getElementById('diagram')?.scrollHeight ?? 0;
      if (width > 0) iframe.style.width = `${width + 24}px`;
      if (height > 0) iframe.style.height = `${height + 24}px`;
    }
    const output = waitFor((message) => format === 'png'
      ? message.type === 'png' && message.id === 2
      : message.type === 'svg' && message.id === 2);
    post({ type: format === 'png' ? 'getPng' : 'getSvg', id: 2 });
    const result = await output;
    const value = result.type === 'png' ? result.dataUrl : result.type === 'svg' ? result.svg : null;
    if (!value) throw new Error('Diagram export returned no image.');
    return value;
  } finally {
    abort.abort();
    signal?.removeEventListener('abort', cancelExternal);
    iframe.remove();
  }
}
