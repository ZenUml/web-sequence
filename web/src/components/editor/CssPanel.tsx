import { useState, type ReactNode } from 'react';
import { cn } from '../../ui/cn';

export interface CssPanelProps {
  /** True when the CSS source is empty — drives the default-collapsed behavior. */
  isEmpty: boolean;
  /**
   * Controlled open/collapsed state. When provided, the panel is fully controlled
   * and the parent owns the state via `onToggle`. When omitted, the panel manages
   * its own state, defaulting to collapsed while `isEmpty` is true.
   */
  collapsed?: boolean;
  /** Fired with the NEXT open state (true = expanded) when the user toggles. */
  onToggle?: (open: boolean) => void;
  /**
   * Controls rendered in the expanded header row, right of the "CSS" label —
   * the parent passes the existing css-mode Select + acss button. Not rendered
   * while collapsed.
   */
  headerControls: ReactNode;
  /** The expanded body — the parent passes the CSS CodeEditor. */
  children: ReactNode;
}

// A right-pointing chevron (rotates to point down when expanded) — mirrors the
// design's `.cssbar svg` (path d="M9 18l6-6-6-6").
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        'h-[13px] w-[13px] shrink-0 transition-transform duration-150 ease-draft',
        open && 'rotate-90',
      )}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/**
 * Collapsible CSS section for the editor pane. Recreates the design's `.cssbar`
 * collapsed strip and the expanded header + editor body using repo Tailwind tokens.
 *
 * The design's `--ink-870` (#121723) has no token in the repo scale; `ink-850`
 * (#141925) is the nearest existing token and is used for the strip/header chrome.
 */
export function CssPanel({
  isEmpty,
  collapsed,
  onToggle,
  headerControls,
  children,
}: CssPanelProps) {
  const isControlled = collapsed !== undefined;
  // Uncontrolled default: collapsed iff the CSS is empty.
  const [internalCollapsed, setInternalCollapsed] = useState(isEmpty);
  const resolvedCollapsed = isControlled ? collapsed : internalCollapsed;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalCollapsed(!next);
    onToggle?.(next);
  };

  if (resolvedCollapsed) {
    return (
      <button
        type="button"
        data-testid="css-panel-strip"
        aria-expanded={false}
        aria-label="Expand custom CSS"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 border-t border-ink-line bg-ink-850 px-3.5 text-left text-[12px] text-ondark-muted transition-colors duration-150 ease-draft ring-draft hover:text-ondark-strong"
      >
        <Chevron open={false} />
        <span>Custom CSS</span>
        {isEmpty && (
          <span className="ml-auto font-mono text-[10px] tracking-[0.08em] text-ondark-faint">
            empty · click to expand
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-testid="css-panel-expanded"
      className="flex flex-1 min-h-0 flex-col border-t border-ink-line"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink-line/40 bg-ink-850 px-2 py-1.5">
        <button
          type="button"
          data-testid="css-panel-collapse"
          aria-expanded
          aria-label="Collapse custom CSS"
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ondark-muted transition-colors duration-150 ease-draft ring-draft hover:text-ondark-strong"
        >
          <Chevron open />
          CSS
        </button>
        <div className="flex items-center gap-2">{headerControls}</div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
