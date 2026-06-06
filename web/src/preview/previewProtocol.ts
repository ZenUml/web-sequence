// Typed host<->iframe protocol for the ZenUML preview (roadmap §5).
// The iframe is a same-origin srcdoc; messages are validated by `type`.
export interface RenderOptions {
  enableMultiTheme: false;
  theme: 'theme-default';
  stickyOffset: number; // from the host router search params — NOT window.location inside the iframe
}

// host → iframe
export type HostMessage =
  | { type: 'render'; code: string; options: RenderOptions }
  | { type: 'updateCss'; css: string }
  | { type: 'getPng'; id: number }
  | { type: 'evalConsole'; id: number; expr: string };

// iframe → host
export type FrameMessage =
  | { type: 'ready' }
  | { type: 'rendered' }
  | { type: 'codeChange'; code: string }
  | { type: 'png'; id: number; dataUrl: string | null }
  | { type: 'console'; level: string; args: string[] }
  | { type: 'evalResult'; id: number; ok: boolean; value: string }
  | { type: 'error'; message: string };

const FRAME_TYPES = new Set([
  'ready', 'rendered', 'codeChange', 'png', 'console', 'evalResult', 'error',
]);

export function isFrameMessage(data: unknown): data is FrameMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string' &&
    FRAME_TYPES.has((data as { type: string }).type)
  );
}
