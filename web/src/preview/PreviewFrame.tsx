import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { getCompleteHtml } from './previewHtml';
import { isFrameMessage, type RenderOptions } from './previewProtocol';
import { PREVIEW_DEBOUNCE } from '../config/constants';

export interface PreviewHandle {
  getPng(): Promise<string | null>;
}

export interface PreviewFrameProps {
  code: string;
  css: string;
  stickyOffset: number;
  autoPreview?: boolean;
  onCodeChange?: (code: string) => void;
  onConsole?: (entry: { level: string; args: string[] }) => void;
  onError?: (message: string) => void;
}

export const PreviewFrame = forwardRef<PreviewHandle, PreviewFrameProps>(function PreviewFrame(
  { code, css, stickyOffset, autoPreview = true, onCodeChange, onConsole, onError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pngWaiters = useRef(new Map<number, (v: string | null) => void>());
  const pngId = useRef(0);
  // Refs hold the latest values so the `[]`-deps message listener never reads
  // a stale closure (e.g. after a css-driven iframe reload re-fires `ready`).
  const codeRef = useRef(code); codeRef.current = code;
  const stickyRef = useRef(stickyOffset); stickyRef.current = stickyOffset;
  const cbRef = useRef({ onCodeChange, onConsole, onError });
  cbRef.current = { onCodeChange, onConsole, onError };
  // Build srcdoc ONCE from the css at mount; later css updates use the fast path
  // (REQ-PRV-5) rather than rebuilding the iframe.
  const initialCss = useRef(css);
  const srcdoc = useMemo(() => getCompleteHtml({ css: initialCss.current }), []);

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
          break;
        case 'codeChange': cbRef.current.onCodeChange?.(msg.code); break;
        case 'console': cbRef.current.onConsole?.({ level: msg.level, args: msg.args }); break;
        case 'error': cbRef.current.onError?.(msg.message); break;
        case 'png': {
          const w = pngWaiters.current.get(msg.id);
          if (w) { w(msg.dataUrl); pngWaiters.current.delete(msg.id); }
          break;
        }
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
  }));

  return (
    <iframe
      ref={iframeRef}
      data-testid="preview-iframe"
      title="ZenUML preview"
      srcDoc={srcdoc}
      className="h-full w-full border-0"
      allowFullScreen
    />
  );
});
