import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  /**
   * Present (fullscreen) fit. When `true` AND the iframe has reported its natural
   * `contentSize`, the iframe is sized to that natural size and CSS-`transform:
   * scale()`d to fit — and centred within — its wrapper. Self-contained: the
   * controller only needs `fit={fullscreen}`; the scale is computed here from a
   * ResizeObserver on the wrapper (feature-detected — absent in jsdom → scale 1).
   * Has no effect in embed mode (embed sizing stays byte-identical). Default false.
   */
  fit?: boolean;
  /**
   * Render the native vector SVG instead of the HTML diagram. Used on mobile, where
   * @zenuml/core's fixed-px HTML layout overflows the narrow viewport with no reflow.
   * The SVG carries a viewBox and is sized fit-to-width inside the iframe, so the full
   * diagram width is visible by default (tall diagrams scroll vertically; vector stays
   * crisp at any zoom). Forwarded to the iframe as `renderMode: 'svg'`. Default false.
   */
  svgMode?: boolean;
  onCodeChange?: (code: string) => void;
  onConsole?: (entry: { level: string; args: string[] }) => void;
  onError?: (message: string) => void;
}

export const PreviewFrame = forwardRef<PreviewHandle, PreviewFrameProps>(function PreviewFrame(
  { code, css, stickyOffset, autoPreview = true, embed, fit = false, svgMode = false, onCodeChange, onConsole, onError },
  ref,
) {
  // Self-determine embed from the runtime mode (same source AppRoot reads) so the
  // embed iframe suppresses core chrome without any AppRoot edit. An explicit
  // `embed` prop overrides.
  const embedMode = embed ?? detectFromEnv().isEmbed;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  // Iframe natural content size reported via 'contentSize' message, in ALL modes.
  // null = no report yet (iframe uses h-full / default width during initial load).
  // - embed: drives the explicit shrink-wrap px style (byte-identical to before).
  // - fit (present): drives the scale-to-fit transform.
  // - editor (neither): stored but not applied (stays h-full w-full).
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null);
  // Present-mode fit scale. 1 = no down-scale (also the safe fallback when the
  // wrapper has no measurable size or ResizeObserver is unavailable).
  const [fitScale, setFitScale] = useState(1);
  const pngWaiters = useRef(new Map<number, (v: string | null) => void>());
  const pngId = useRef(0);
  const evalWaiters = useRef(new Map<number, (r: { ok: boolean; value: string }) => void>());
  const evalId = useRef(0);
  // Refs hold the latest values so the `[]`-deps message listener never reads
  // a stale closure (e.g. after a css-driven iframe reload re-fires `ready`).
  const codeRef = useRef(code); codeRef.current = code;
  const cssRef = useRef(css); cssRef.current = css;
  const stickyRef = useRef(stickyOffset); stickyRef.current = stickyOffset;
  const svgModeRef = useRef(svgMode); svgModeRef.current = svgMode;
  const cbRef = useRef({ onCodeChange, onConsole, onError });
  cbRef.current = { onCodeChange, onConsole, onError };
  // Build srcdoc ONCE with an EMPTY style; css is pushed via updateCss after
  // `ready` (and on subsequent css changes) rather than baked into the document.
  // The embed chrome-suppression CSS IS baked here (not via updateCss) so there is
  // no chrome flash on first paint.
  const srcdoc = useMemo(() => getCompleteHtml({ embed: embedMode }), [embedMode]);

  const renderOptions = (): RenderOptions => ({
    enableMultiTheme: false,
    theme: 'theme-default',
    stickyOffset: stickyRef.current,
    renderMode: svgModeRef.current ? 'svg' : 'html',
  });

  const post = (msg: unknown) => iframeRef.current?.contentWindow?.postMessage(msg, '*');

  // Acknowledged render delivery (WebKit fix). A single fire-and-forget render
  // postMessage to the srcdoc iframe is silently dropped by WebKit/Safari under tight
  // prod-build timing, leaving the preview stale (it never re-renders after first paint).
  // So each render carries a token; the iframe echoes it in `rendered`; if the ack does
  // not arrive within RENDER_ACK_MS we re-post (up to RENDER_MAX_RETRIES). Idempotent —
  // a duplicate render that did land just re-renders the same code. Chromium acks on the
  // first try, so the retry path is WebKit-only in practice.
  const RENDER_ACK_MS = 250;
  const RENDER_MAX_RETRIES = 4;
  const renderSeq = useRef(0);
  const pendingRender = useRef<{ token: number; code: string; tries: number } | null>(null);
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armAck = () => {
    if (ackTimer.current) clearTimeout(ackTimer.current);
    ackTimer.current = setTimeout(() => {
      const p = pendingRender.current;
      if (!p || p.tries >= RENDER_MAX_RETRIES) { pendingRender.current = null; return; }
      p.tries += 1;
      post({ type: 'render', code: p.code, options: renderOptions(), token: p.token });
      armAck();
    }, RENDER_ACK_MS);
  };
  const postRender = (code: string) => {
    const token = ++renderSeq.current;
    pendingRender.current = { token, code, tries: 0 };
    post({ type: 'render', code, options: renderOptions(), token });
    armAck();
  };

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isFrameMessage(e.data)) return;
      const msg = e.data;
      switch (msg.type) {
        case 'ready':
          readyRef.current = true;
          postRender(codeRef.current);
          // Push the LATEST css on ready so css that resolved before the heavy
          // @zenuml bundle fired `ready` (e.g. async-transpiled SCSS/LESS) is not
          // dropped — the empty initial <style> would otherwise stay empty.
          post({ type: 'updateCss', css: cssRef.current });
          break;
        case 'rendered':
          // Ack for acknowledged render delivery: the iframe applied this token's render,
          // so stop retrying it (only when it matches the latest in-flight render).
          if (pendingRender.current && msg.token === pendingRender.current.token) {
            pendingRender.current = null;
            if (ackTimer.current) clearTimeout(ackTimer.current);
          }
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
          // Store the diagram's natural content size (width × height) in ALL modes.
          // embed: shrink-wraps the iframe (card wrapper in AppRoot supplies max-w /
          // max-h + overflow-auto so an oversized diagram scrolls). fit: feeds the
          // scale-to-fit transform. editor: stored but never applied to the iframe.
          setContentSize({ width: msg.width, height: msg.height });
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (ackTimer.current) clearTimeout(ackTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-render on DSL change (only once ready + autoPreview on).
  useEffect(() => {
    if (!readyRef.current || !autoPreview) return;
    const t = setTimeout(() => postRender(codeRef.current), PREVIEW_DEBOUNCE);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stickyOffset, autoPreview, svgMode]);

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

  // Present-mode fit: compute scale = min(containerW/contentW, containerH/contentH, 1)
  // and keep it current as the wrapper resizes (window resize / orientation change).
  // Self-contained so the controller only passes `fit`. Guards:
  //  - only runs when `fit` AND a contentSize is known (else nothing to fit against);
  //  - ResizeObserver may be absent (jsdom / old browsers) → feature-detect, the
  //    one-shot measure below still computes an initial scale;
  //  - a 0/non-finite wrapper size (jsdom has no layout) → fall back to scale 1, so
  //    we never apply scale(0) or NaN. Deps are [fit, contentSize] only (NOT fitScale,
  //    which would loop).
  useEffect(() => {
    if (!fit || contentSize === null) { setFitScale(1); return; }
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const measure = () => {
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      const s = Math.min(cw / contentSize.width, ch / contentSize.height, 1);
      setFitScale(Number.isFinite(s) && s > 0 ? s : 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [fit, contentSize]);

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

  const iframeEl = (className: string, style?: CSSProperties) => (
    <iframe
      ref={iframeRef}
      data-testid="preview-iframe"
      title="ZenUML preview"
      srcDoc={srcdoc}
      className={className}
      style={style}
      allowFullScreen
    />
  );

  // EMBED (byte-identical to before): a BARE iframe — no wrapper. Once the bootstrap
  // reports contentSize, set explicit pixel width+height so the iframe shrinks to its
  // content on both axes; before the first report fall back to h-full (so the card is
  // not a 0-px collapsed box during load). embed never enters fit, so it short-circuits
  // first and its DOM stays exactly what it was prior to Phase 2.
  if (embedMode) {
    return contentSize !== null
      ? iframeEl('border-0', { width: `${contentSize.width}px`, height: `${contentSize.height}px` })
      : iframeEl('h-full w-full border-0');
  }

  // NON-EMBED: keep a STABLE DOM shape (wrapper > iframe) across the editor↔present
  // transition so toggling `fit` never remounts the iframe (which would reload the
  // heavy @zenuml bundle and lose render state). The wrapper is what the
  // ResizeObserver measures in fit mode.
  //  - present fit (fit && contentSize known): iframe sized to natural px + scaled to
  //    fit, centred. overflow-hidden clips any sub-pixel rounding.
  //  - editor (else): iframe fills the wrapper h-full w-full; contentSize, if
  //    reported, is stored but intentionally not applied.
  const presenting = fit && contentSize !== null;
  return (
    <div
      ref={wrapperRef}
      className={presenting ? 'h-full w-full flex items-center justify-center overflow-hidden' : 'h-full w-full'}
    >
      {presenting
        ? iframeEl('border-0', {
            width: `${contentSize.width}px`,
            height: `${contentSize.height}px`,
            transform: `scale(${fitScale})`,
            transformOrigin: 'center center',
          })
        : iframeEl('h-full w-full border-0')}
    </div>
  );
});
