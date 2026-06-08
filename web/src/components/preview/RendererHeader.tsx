import type { ReactNode } from 'react';
import { IconButton, Tooltip } from '../../ui';

// RendererHeader — the white header bar (`.pv-head`) that sits ABOVE the diagram
// on the renderer/preview side. Pure/presentational: no store access. It hosts a
// `pageTabs` slot on the left (the `.rtabs` cluster) and a controls cluster on the
// right (the `.pv-tools` cluster): a zoom label, an optional Fit button, and a
// Present button.
//
// This bar is the LIGHT paper surface (the diagram is rendered on warm paper, not
// the dark ink chrome) — so every control here is `surface="light"` and the bar
// itself is `bg-white border-b border-paper-line`.
//
// Zoom and Fit are presentational: PreviewFrame's imperative handle exposes only
// `getPng`/`evalConsole`, so there is no zoom/fit API to wire in Phase 1. `zoomLabel`
// defaults to "100%" and `onFit` is optional — the Fit button only renders when a
// handler is supplied (no dead control). Present is the wired action (`onPresent`).
export interface RendererHeaderProps {
  /** Left slot — integration passes `<PageTabs .../>` here. */
  pageTabs: ReactNode;
  /** Wired: toggles Present (fullscreen) mode. */
  onPresent(): void;
  /** Optional fit-to-screen handler. Fit button only renders when provided. */
  onFit?(): void;
  /** Zoom percentage display, e.g. "100%". Presentational; defaults to "100%". */
  zoomLabel?: string;
}

export function RendererHeader({
  pageTabs,
  onPresent,
  onFit,
  zoomLabel = '100%',
}: RendererHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 h-11 px-3 bg-white border-b border-paper-line">
      {/* .rtabs — left cluster, holds the page tabs slot */}
      <div className="flex items-center gap-1 min-w-0">{pageTabs}</div>

      {/* .pv-tools — right controls cluster */}
      <div className="ml-auto flex items-center gap-1">
        {/* .zz — zoom percentage (presentational) */}
        <span className="font-mono text-[11px] text-onlight-muted px-1.5 select-none">
          {zoomLabel}
        </span>

        {onFit && (
          <Tooltip label="Fit to screen">
            <IconButton
              size="md"
              surface="light"
              aria-label="Fit to screen"
              data-testid="renderer-fit"
              onClick={() => onFit()}
            >
              {/* fit/expand-corners icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </IconButton>
          </Tooltip>
        )}

        <Tooltip label="Present">
          <IconButton
            size="md"
            surface="light"
            aria-label="Present"
            data-testid="renderer-present"
            onClick={() => onPresent()}
          >
            {/* present/screen-corners icon (matches design §02 Present glyph) */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3" />
            </svg>
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
