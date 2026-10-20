import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../../domain/types';
import { getCompleteHtml } from '../../preview/previewHtml';
import { isFrameMessage, type RenderOptions } from '../../preview/previewProtocol';
import { computeCss } from '../../preview/transpilers';
import { placeThumbnail, THUMBNAIL_CHROME_CSS, type ThumbnailPlacement } from './thumbnailLayout';

// One simple renderer per card: a same-origin srcdoc iframe running the existing
// preview bootstrap (consumed read-only, not modified). The diagram renders with
// the light default theme in BOTH appearances, with the item's own custom CSS, and
// is then placed at 70% native size by thumbnailLayout.ts. The preview is
// decorative: it takes no pointer or keyboard input; the card button opens the item.

const FRAME_WIDTH = 1600; // initial layout width; replaced by the measured width
const FRAME_HEIGHT = 640; // enough native height for the visible preview band

type Status = 'loading' | 'ready' | 'error';

const RENDER_OPTIONS: RenderOptions = {
  enableMultiTheme: false,
  enableParticipantStyleEditing: false,
  theme: 'theme-default',
  stickyOffset: 0,
  renderMode: 'html',
};

export function DiagramThumbnail({ item }: { item: Item }) {
  const code = item.js ?? '';
  if (!code.trim()) return <EmptyDiagramPlaceholder />;
  return <RenderedThumbnail item={item} />;
}

function RenderedThumbnail({ item }: { item: Item }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [boxWidth, setBoxWidth] = useState(0);
  const [bounds, setBounds] = useState<{ left: number; right: number; participantTop: number } | null>(null);
  const srcdoc = useMemo(() => getCompleteHtml({ embed: true }), []);
  const latest = useRef(item);
  latest.current = item;
  // Every input that changes the rendered thumbnail: DSL, CSS mode, its CSS source
  // (html for ACSS) and the settings.
  const frameKey = [item.js, item.cssMode, item.css, item.html, safeKey(item.cssSettings)].join('\u0000');

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setBoxWidth(box.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let acked = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setStatus('loading');
    setBounds(null);
    const post = (msg: unknown) => frameRef.current?.contentWindow?.postMessage(msg, '*');

    function measure() {
      const doc = frameRef.current?.contentDocument;
      const diagram = doc?.querySelector('.sequence-diagram');
      const participant = doc?.querySelector('.participant');
      if (!diagram || !participant) return;
      const d = diagram.getBoundingClientRect();
      const p = participant.getBoundingClientRect();
      if (d.width <= 0) return;
      setBounds((prev) =>
        prev && prev.left === d.left && prev.right === d.right && prev.participantTop === p.top
          ? prev
          : { left: d.left, right: d.right, participantTop: p.top },
      );
      setStatus('ready');
    }

    // Same inputs as the Editor (AppRoot): ACSS scans the HTML, other modes compile
    // the CSS, always with cssSettings. A compile that finishes after the inputs
    // changed is dropped (disposed), so it cannot overwrite newer rules.
    async function pushCss() {
      const it = latest.current;
      let css = '';
      if (it.cssMode === 'css' || !it.cssMode) css = it.css ?? '';
      else {
        const source = it.cssMode === 'acss' ? it.html ?? '' : it.css ?? '';
        try {
          css = (await computeCss(source, it.cssMode, it.cssSettings)).code;
        } catch {
          css = '';
        }
      }
      if (!disposed) post({ type: 'updateCss', css });
    }

    // WebKit can drop a single render postMessage to a srcdoc iframe; re-post until
    // the bootstrap acknowledges it (same approach as PreviewFrame).
    function sendRender(tries: number) {
      if (disposed || acked) return;
      post({ type: 'render', code: latest.current.js, options: RENDER_OPTIONS, token: 1 });
      if (tries < 4) retry = setTimeout(() => sendRender(tries + 1), 300);
    }

    function onMessage(e: MessageEvent) {
      const win = frameRef.current?.contentWindow;
      if (!win || e.source !== win || !isFrameMessage(e.data)) return;
      const msg = e.data;
      if (msg.type === 'ready') {
        const doc = frameRef.current?.contentDocument;
        if (doc && !doc.getElementById('diagrams-thumbnail-chrome')) {
          const style = doc.createElement('style');
          style.id = 'diagrams-thumbnail-chrome';
          style.textContent = THUMBNAIL_CHROME_CSS;
          doc.head.appendChild(style);
        }
        void pushCss();
        sendRender(0);
      } else if (msg.type === 'rendered' || msg.type === 'contentSize') {
        if (msg.type === 'rendered') acked = true;
        measure();
      } else if (msg.type === 'error') {
        setStatus((s) => (s === 'ready' ? s : 'error'));
      }
    }

    window.addEventListener('message', onMessage);
    // A diagram that never reports a laid-out participant gets the quiet fallback.
    const timer = setTimeout(() => {
      if (!disposed) setStatus((s) => (s === 'loading' ? 'error' : s));
    }, 20000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(retry);
      window.removeEventListener('message', onMessage);
    };
  }, [frameKey]);

  const placement: ThumbnailPlacement | null = bounds && boxWidth > 0 ? placeThumbnail(boxWidth, bounds) : null;
  const frameWidth = bounds ? Math.max(Math.ceil(bounds.right) + 24, Math.ceil(boxWidth / 0.7)) : FRAME_WIDTH;

  return (
    <span
      ref={boxRef}
      className="dh-thumb"
      data-testid={`home-thumb-${item.id}`}
      data-status={status}
      data-cropped={placement?.cropped ? 'true' : 'false'}
      aria-hidden="true"
    >
      <iframe
        ref={frameRef}
        // Remount the renderer when any rendering input changes.
        key={frameKey}
        title={`Preview of ${item.title || 'Untitled'}`}
        srcDoc={srcdoc}
        tabIndex={-1}
        className="dh-thumb-frame"
        style={{
          width: `${frameWidth}px`,
          height: `${FRAME_HEIGHT}px`,
          transform: placement
            ? `translate(${placement.x}px, ${placement.y}px) scale(${placement.scale})`
            : 'scale(0.7)',
          visibility: status === 'ready' ? 'visible' : 'hidden',
        }}
      />
      {status === 'error' && <span className="dh-thumb-note">Preview unavailable</span>}
    </span>
  );
}

function safeKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

export function EmptyDiagramPlaceholder() {
  return (
    <span className="dh-thumb dh-thumb--empty" aria-hidden="true">
      <svg viewBox="0 0 38 38" width="38" height="38" fill="none" className="dh-empty-icon">
        <path
          d="M9.5 3.5h13l7 7v24h-20z M22.5 3.5v7h7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="dh-empty-label">Empty diagram</span>
    </span>
  );
}
