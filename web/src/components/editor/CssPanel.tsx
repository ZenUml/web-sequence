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
  /** Trailing content on the panel's row in both states (e.g. Report a bug). */
  trailing?: ReactNode;
}

// Chevron: points down while collapsed and flips up when expanded (the panel
// opens upward from the bottom of the code column).
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
        'h-[18px] w-[18px] shrink-0 transition-transform duration-150 ease-draft',
        open && 'rotate-180',
      )}
    >
      <path d="M8 10l4 4 4-4" />
    </svg>
  );
}

/**
 * Collapsible CSS section at the bottom of the editor's code column. Collapsed it
 * is a single row (chevron + "Custom CSS" + optional trailing action); expanded it
 * adds the CSS mode controls and the CSS editor body. Colors come from the editor
 * semantic tokens in globals.css.
 */
export function CssPanel({
  isEmpty,
  collapsed,
  onToggle,
  headerControls,
  children,
  trailing,
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
      <div className="editor-css-panel-strip">
        <button
          type="button"
          data-testid="css-panel-strip"
          aria-expanded={false}
          aria-label="Expand custom CSS"
          onClick={() => setOpen(true)}
          className="editor-css-panel-toggle"
        >
          <Chevron open={false} />
          <span>Custom CSS</span>
        </button>
        {trailing}
      </div>
    );
  }

  return (
    <div data-testid="css-panel-expanded" className="editor-css-panel">
      <div className="editor-css-panel-header">
        <button
          type="button"
          data-testid="css-panel-collapse"
          aria-expanded
          aria-label="Collapse custom CSS"
          onClick={() => setOpen(false)}
          className="editor-css-panel-toggle"
        >
          <Chevron open />
          <span>Custom CSS</span>
        </button>
        <div className="editor-css-panel-controls">{headerControls}</div>
        {trailing}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
