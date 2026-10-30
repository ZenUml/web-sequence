import type { ReactNode } from 'react';
import { Tooltip } from '../../ui';

// RendererHeader — the toolbar at the top of the floating preview card. Pure and
// presentational: no store access. Left: the page tabs slot. Right: Download,
// optional Refresh, then the zoom group (fit width, fit height, fit diagram,
// zoom out, current zoom, zoom in).
//
// Every control renders only when its handler is supplied, so the toolbar never
// shows a dead control. Present lives in the app header only.
export interface RendererHeaderProps {
  /** Left slot — integration passes `<PageTabs .../>` here. */
  pageTabs: ReactNode;
  /** Open the rendered diagram download preview. */
  onDownload?(): void;
  /**
   * #824: optional manual re-render handler. The Refresh button renders ONLY when this
   * is supplied — AppRoot passes it solely when auto-preview is OFF, so the default UI
   * (auto-preview ON, the 99% case) is unchanged and shows no extra control.
   */
  onRefresh?(): void;
  /** Zoom controls. The zoom group renders only when `zoom` is supplied. */
  zoom?: {
    label: string;
    onFitWidth(): void;
    onFitHeight(): void;
    onFitDiagram(): void;
    onZoomOut(): void;
    onZoomIn(): void;
    onActualSize(): void;
  };
}

function ToolButton({
  label,
  testId,
  onClick,
  children,
}: {
  label: string;
  testId: string;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} data-testid={testId} onClick={() => onClick()} className="editor-tool-button">
        {children}
      </button>
    </Tooltip>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function RendererHeader({ pageTabs, onDownload, onRefresh, zoom }: RendererHeaderProps) {
  return (
    <div className="editor-renderer-header">
      <div className="editor-renderer-tabs">{pageTabs}</div>

      <div className="editor-renderer-tools">
        {onDownload && (
          <Tooltip label="Download diagram">
            <button
              type="button"
              aria-label="Download diagram"
              data-testid="renderer-download"
              onClick={() => onDownload()}
              className="editor-download-button"
            >
              <svg {...iconProps} width={16} height={16}>
                <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />
              </svg>
              <span className="editor-download-label">Download</span>
            </button>
          </Tooltip>
        )}

        {/* #824: manual Refresh — only present when auto-preview is OFF. */}
        {onRefresh && (
          <ToolButton label="Refresh preview" testId="renderer-refresh" onClick={onRefresh}>
            <svg {...iconProps}>
              <path d="M20 12a8 8 0 1 1-2.35-5.65" />
              <path d="M20 4.5v4h-4" />
            </svg>
          </ToolButton>
        )}

        {zoom && (
          <div className="editor-zoom-group" role="group" aria-label="Zoom">
            <ToolButton label="Fit to width" testId="renderer-fit-width" onClick={zoom.onFitWidth}>
              <svg {...iconProps}>
                <path d="M4 5v14M20 5v14M7.5 12h9M10 9.5 7.5 12l2.5 2.5M14 9.5l2.5 2.5-2.5 2.5" />
              </svg>
            </ToolButton>
            <ToolButton label="Fit to height" testId="renderer-fit-height" onClick={zoom.onFitHeight}>
              <svg {...iconProps}>
                <path d="M5 4h14M5 20h14M12 7.5v9M9.5 10 12 7.5l2.5 2.5M9.5 14l2.5 2.5 2.5-2.5" />
              </svg>
            </ToolButton>
            <ToolButton label="Fit diagram" testId="renderer-fit" onClick={zoom.onFitDiagram}>
              <svg {...iconProps}>
                <path d="M4 8.5V4h4.5M15.5 4H20v4.5M20 15.5V20h-4.5M8.5 20H4v-4.5" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </ToolButton>
            <span className="editor-zoom-gap" aria-hidden="true" />
            <ToolButton label="Zoom out" testId="renderer-zoom-out" onClick={zoom.onZoomOut}>
              <svg {...iconProps}>
                <path d="M6 12h12" />
              </svg>
            </ToolButton>
            <Tooltip label="Reset to 100%">
              <button
                type="button"
                data-testid="renderer-zoom-label"
                aria-label={`Zoom ${zoom.label}. Reset to 100%`}
                onClick={() => zoom.onActualSize()}
                className="editor-zoom-label"
              >
                {zoom.label}
              </button>
            </Tooltip>
            <ToolButton label="Zoom in" testId="renderer-zoom-in" onClick={zoom.onZoomIn}>
              <svg {...iconProps}>
                <path d="M12 6v12M6 12h12" />
              </svg>
            </ToolButton>
          </div>
        )}
      </div>
    </div>
  );
}
