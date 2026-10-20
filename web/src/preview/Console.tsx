import { useState } from 'react';
import { cn } from '../ui';
import { countErrors } from './consoleFilter';

export interface ConsoleEntry { level: string; args: string[]; }
export interface ConsoleProps {
  open: boolean;
  entries: ConsoleEntry[];
  onClear(): void;
  onEval(expr: string): void;
  onToggle(): void;
}

// Console drawer docked at the bottom of the preview card. Colors come from the
// editor semantic tokens in globals.css (light and dark appearance).
export function Console({ open, entries, onClear, onEval, onToggle }: ConsoleProps) {
  const [expr, setExpr] = useState('');
  // Entries arrive already filtered (the controller applies `filterStarterNoise`).
  // A clean run shows only the count; real errors surface as a red count badge.
  const errorCount = countErrors(entries);
  const clean = errorCount === 0;
  return (
    <div
      data-testid="console"
      className={cn('editor-console', open ? 'editor-console--open' : 'editor-console--collapsed')}
    >
      <div className="editor-console-bar">
        {/* Real toggle button: keyboard-operable and exposes its open state to AT. */}
        <button
          type="button"
          data-testid="console-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse console' : 'Expand console'}
          onClick={onToggle}
          className={cn('editor-console-toggle', !clean && 'editor-console-toggle--error')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cn('editor-console-chevron', open && 'rotate-180')}
          >
            <path d="M8 10l4 4 4-4" />
          </svg>
          <span>Console (<span data-testid="console-count">{entries.length}</span>)</span>
        </button>
        {!clean && (
          <span data-testid="console-status" data-clean="false" className="editor-console-errors">
            {`${errorCount} error${errorCount === 1 ? '' : 's'}`}
          </span>
        )}
        <button
          type="button"
          data-testid="console-clear"
          onClick={onClear}
          className="editor-console-clear"
        >
          Clear
        </button>
      </div>
      {open && (
        <>
          <div className="editor-console-log max-h-40 overflow-auto px-5 font-mono text-xs">
            {entries.map((e, i) => (
              <div key={i} className={e.level === 'error' ? 'editor-console-error' : undefined}>
                {e.args.join(' ')}
              </div>
            ))}
          </div>
          <input
            data-testid="console-eval"
            aria-label="Evaluate console expression"
            value={expr}
            onChange={(ev) => setExpr(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' && expr.trim()) { onEval(expr); setExpr(''); } }}
            placeholder="Evaluate expression…"
            className="editor-console-eval w-full bg-transparent px-5 py-1.5 font-mono text-xs outline-none"
          />
        </>
      )}
    </div>
  );
}
