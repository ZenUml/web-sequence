// Typed host<->iframe protocol for the ZenUML preview (roadmap §5).
// The iframe is a same-origin srcdoc; messages are validated by `type`.
export interface RenderOptions {
  enableMultiTheme: false;
  theme: 'theme-default';
  stickyOffset: number; // from the host router search params — NOT window.location inside the iframe
  // Renderer selection. 'html' (default) = @zenuml/core's interactive React diagram.
  // 'svg' = the native vector SVG (renderToSvg), used on mobile where the fixed-px HTML
  // layout overflows the narrow viewport; the SVG fits-to-width and shows the full diagram.
  renderMode?: 'html' | 'svg';
}

// host → iframe
export type HostMessage =
  // `token` (optional) enables acknowledged delivery: the iframe echoes it back in
  // `rendered` so the host can detect a dropped render and re-post. WebKit/Safari can
  // silently drop a single fire-and-forget render postMessage to a srcdoc iframe under
  // tight timing (prod build), leaving the preview stale — the ack+retry makes delivery
  // reliable across engines. Optional so existing tests/callers still type-check.
  | { type: 'render'; code: string; options: RenderOptions; token?: number }
  | { type: 'updateCss'; css: string }
  | { type: 'getPng'; id: number }
  | { type: 'evalConsole'; id: number; expr: string };

// iframe → host
export type FrameMessage =
  | { type: 'ready' }
  // `token` echoes the render message's token (acknowledged delivery — see HostMessage).
  | { type: 'rendered'; token?: number }
  | { type: 'codeChange'; code: string }
  | { type: 'png'; id: number; dataUrl: string | null }
  | { type: 'console'; level: string; args: string[] }
  | { type: 'evalResult'; id: number; ok: boolean; value: string }
  | { type: 'error'; message: string }
  // Embed-only: posted after each render so the host can shrink-wrap the iframe
  // to its natural content size (both width AND height). Only sent when the bootstrap
  // was started in embed mode (previewHtml's `embed=true` path); ignored by non-embed
  // PreviewFrame instances.
  // width  = .bg-skin-canvas.scrollWidth + 16px right buffer (so lifeline tails / right
  //           edges are not clipped by the card edge).
  // height = #diagram.scrollHeight + 24px bottom buffer (so lifeline dashes at the
  //           foot of each column are not clipped by the iframe bottom).
  | { type: 'contentSize'; width: number; height: number };

const FRAME_TYPES = new Set([
  'ready', 'rendered', 'codeChange', 'png', 'console', 'evalResult', 'error',
  'contentSize',
]);

export function isFrameMessage(data: unknown): data is FrameMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string' &&
    FRAME_TYPES.has((data as { type: string }).type)
  );
}
