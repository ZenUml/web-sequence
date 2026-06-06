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
  // Build srcdoc once per CSS identity; DSL changes go via postMessage.
  const srcdoc = useMemo(() => getCompleteHtml({ css }), [css]);

  const renderOptions = (): RenderOptions => ({ enableMultiTheme: false, theme: 'theme-default', stickyOffset });

  const post = (msg: unknown) => iframeRef.current?.contentWindow?.postMessage(msg, '*');

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isFrameMessage(e.data)) return;
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          readyRef.current = true;
          post({ type: 'render', code, options: renderOptions() });
          break;
        case 'codeChange': onCodeChange?.(msg.code); break;
        case 'console': onConsole?.({ level: msg.level, args: msg.args }); break;
        case 'error': onError?.(msg.message); break;
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
    const t = setTimeout(() => post({ type: 'render', code, options: renderOptions() }), PREVIEW_DEBOUNCE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stickyOffset, autoPreview]);

  // Rebuilding srcdoc resets readiness; the new doc posts `ready` again.
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
