import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { getCompleteHtml } from './previewHtml';
import { isFrameMessage, type RenderOptions } from './previewProtocol';
import { PREVIEW_DEBOUNCE } from '../config/constants';
import { detectFromEnv } from '../app/runtimeMode';

export interface PreviewHandle {
  getPng(): Promise<string | null>;
  evalConsole(expr: string): Promise<{ ok: boolean; value: string }>;
}

export interface PreviewFrameProps {
  code: string;
  css: string;
  stickyOffset: number;
  autoPreview?: boolean;
  /**
   * Embed mode: suppress @zenuml/core's interactive chrome (toolbar/zoom/info/
   * version/watermark/shield) in the preview iframe. Defaults to the runtime
   * `?embed` flag so the embed path is correct with no call-site wiring; a caller
   * may override explicitly (e.g. `embed={isEmbed}` in AppRoot if preferred).
   */
  embed?: boolean;
  onCodeChange?: (code: string) => void;
  onConsole?: (entry: { level: string; args: string[] }) => void;
  onError?: (message: string) => void;
}

export const PreviewFrame = forwardRef<PreviewHandle, PreviewFrameProps>(function PreviewFrame(
  { code, css, stickyOffset, autoPreview = true, embed, onCodeChange, onConsole, onError },
  ref,
) {
  // Self-determine embed from the runtime mode (same source AppRoot reads) so the
  // embed iframe suppresses core chrome without any AppRoot edit. An explicit
  // `embed` prop overrides.
  const embedMode = embed ?? detectFromEnv().isEmbed;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  // Embed-only: iframe natural content size reported via 'contentSize' message.
  // null = no report yet (iframe uses h-full / default width during initial load).
  const [embedContentSize, setEmbedContentSize] = useState<{ width: number; height: number } | null>(null);
  const pngWaiters = useRef(new Map<number, (v: string | null) => void>());
  const pngId = useRef(0);
  const evalWaiters = useRef(new Map<number, (r: { ok: boolean; value: string }) => void>());
  const evalId = useRef(0);
  // Refs hold the latest values so the `[]`-deps message listener never reads
  // a stale closure (e.g. after a css-driven iframe reload re-fires `ready`).
  const codeRef = useRef(code); codeRef.current = code;
  const cssRef = useRef(css); cssRef.current = css;
  const stickyRef = useRef(stickyOffset); stickyRef.current = stickyOffset;
  const cbRef = useRef({ onCodeChange, onConsole, onError });
  cbRef.current = { onCodeChange, onConsole, onError };
  // Build srcdoc ONCE with an EMPTY style; css is pushed via updateCss after
  // `ready` (and on subsequent css changes) rather than baked into the document.
  // The embed chrome-suppression CSS IS baked here (not via updateCss) so there is
  // no chrome flash on first paint.
  const srcdoc = useMemo(() => getCompleteHtml({ embed: embedMode }), [embedMode]);

  const renderOptions = (): RenderOptions => ({ enableMultiTheme: false, theme: 'theme-default', stickyOffset: stickyRef.current });

  const post = (msg: unknown) => iframeRef.current?.contentWindow?.postMessage(msg, '*');

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isFrameMessage(e.data)) return;
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          readyRef.current = true;
          post({ type: 'render', code: codeRef.current, options: renderOptions() });
          // Push the LATEST css on ready so css that resolved before the heavy
          // @zenuml bundle fired `ready` (e.g. async-transpiled SCSS/LESS) is not
          // dropped — the empty initial <style> would otherwise stay empty.
          post({ type: 'updateCss', css: cssRef.current });
          break;
        case 'codeChange': cbRef.current.onCodeChange?.(msg.code); break;
        case 'console': cbRef.current.onConsole?.({ level: msg.level, args: msg.args }); break;
        case 'error': cbRef.current.onError?.(msg.message); break;
        case 'png': {
          const w = pngWaiters.current.get(msg.id);
          if (w) { w(msg.dataUrl); pngWaiters.current.delete(msg.id); }
          break;
        }
        case 'evalResult': {
          const w = evalWaiters.current.get(msg.id);
          if (w) { w({ ok: msg.ok, value: msg.value }); evalWaiters.current.delete(msg.id); }
          break;
        }
        case 'contentSize':
          // Embed-only: shrink-wrap the iframe to the diagram's natural content size
          // (width × height). The card wrapper in AppRoot supplies max-w / max-h +
          // overflow-auto, so a diagram larger than the viewport cap scrolls.
          if (embedMode) setEmbedContentSize({ width: msg.width, height: msg.height });
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-render on DSL change (only once ready + autoPreview on).
  useEffect(() => {
    if (!readyRef.current || !autoPreview) return;
    const t = setTimeout(() => post({ type: 'render', code: codeRef.current, options: renderOptions() }), PREVIEW_DEBOUNCE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stickyOffset, autoPreview]);

  // CSS-only fast path (REQ-PRV-5): once ready, push CSS via postMessage on css
  // changes instead of rebuilding/reloading the iframe.
  useEffect(() => {
    if (!readyRef.current) return;
    post({ type: 'updateCss', css });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [css]);

  // srcdoc is now stable for the component's life, so this is a one-time no-op;
  // kept as a safety net should the iframe ever reload and re-fire `ready`.
  useEffect(() => { readyRef.current = false; }, [srcdoc]);

  useImperativeHandle(ref, () => ({
    getPng() {
      return new Promise((resolve) => {
        const id = ++pngId.current;
        pngWaiters.current.set(id, resolve);
        post({ type: 'getPng', id });
        setTimeout(() => { if (pngWaiters.current.delete(id)) resolve(null); }, 5000);
      });
    },
    evalConsole(expr: string) {
      return new Promise((resolve) => {
        const id = ++evalId.current;
        evalWaiters.current.set(id, resolve);
        post({ type: 'evalConsole', id, expr });
        setTimeout(() => { if (evalWaiters.current.delete(id)) resolve({ ok: false, value: 'timeout' }); }, 5000);
      });
    },
  }));

  // In embed mode: once the bootstrap reports contentSize, set explicit pixel
  // width and height so the iframe shrinks to its content on both axes. Before the
  // first report, fall back to h-full (editor-style fill) so the card is not a 0-px
  // collapsed box during initial load.
  // In editor mode: always h-full w-full (fills the split-pane right panel).
  const iframeStyle =
    embedMode && embedContentSize !== null
      ? { width: `${embedContentSize.width}px`, height: `${embedContentSize.height}px` }
      : undefined;

  return (
    <iframe
      ref={iframeRef}
      data-testid="preview-iframe"
      title="ZenUML preview"
      srcDoc={srcdoc}
      className={embedMode && embedContentSize !== null ? 'border-0' : 'h-full w-full border-0'}
      style={iframeStyle}
      allowFullScreen
    />
  );
});
