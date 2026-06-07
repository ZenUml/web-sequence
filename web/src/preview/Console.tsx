import { useState } from 'react';
import { Button, cn } from '../ui';
import { countErrors } from './consoleFilter';

export interface ConsoleEntry { level: string; args: string[]; }
export interface ConsoleProps {
  open: boolean;
  entries: ConsoleEntry[];
  onClear(): void;
  onEval(expr: string): void;
  onToggle(): void;
}

// Console drawer for the preview pane. Lives on the dark `ink` surface (it sits
// under the editor-side preview), so it uses ondark text + ink panel tokens
// rather than off-palette black/gray literals.
export function Console({ open, entries, onClear, onEval, onToggle }: ConsoleProps) {
  const [expr, setExpr] = useState('');
  // Entries arrive already filtered (the controller applies `filterStarterNoise`).
  // A clean run reads green "No issues"; real errors surface as a red count.
  const errorCount = countErrors(entries);
  const clean = errorCount === 0;
  return (
    <div
      data-testid="console"
      className={`border-t border-ink-line/60 bg-ink-800 text-ondark-muted ${open ? '' : 'h-8 overflow-hidden'}`}
    >
      <div className="flex items-center justify-between pl-1 pr-2 py-0.5 select-none">
        {/* Real toggle button: keyboard-operable and exposes its open state to AT. */}
        <button
          type="button"
          data-testid="console-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse console' : 'Expand console'}
          onClick={onToggle}
          className={cn(
            'flex-1 flex items-center gap-1 rounded px-1 py-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] ring-draft',
            // Design (.console.clean/.err .lbl): tint the whole label by state —
            // emerald when clean, danger when errors.
            clean ? 'text-ok hover:text-ok/80' : 'text-danger hover:text-danger/80',
          )}
        >
          <span aria-hidden="true" className="text-ondark-faint">{open ? '▾' : '▸'}</span>
          <span>Console (<span data-testid="console-count">{entries.length}</span>)</span>
        </button>
        <span
          data-testid="console-status"
          data-clean={clean ? 'true' : 'false'}
          className={cn(
            'mr-2 select-none rounded-[5px] px-[7px] py-0.5 font-mono text-[10px] font-semibold tracking-wide',
            clean
              ? 'bg-ok/10 text-ok'
              : 'bg-danger/15 text-danger',
          )}
        >
          {clean ? 'No issues' : `${errorCount} error${errorCount === 1 ? '' : 's'}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          surface="dark"
          data-testid="console-clear"
          onClick={onClear}
          className="font-mono text-[11px] uppercase tracking-[0.12em]"
        >
          Clear
        </Button>
      </div>
      {open && (
        <>
          <div className="max-h-40 overflow-auto px-2 font-mono text-xs text-ondark-strong">
            {entries.map((e, i) => (
              <div key={i} className={e.level === 'error' ? 'text-danger' : undefined}>
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
            className="w-full bg-transparent px-2 py-1 font-mono text-xs text-ondark-strong placeholder:text-ondark-muted outline-none border-t border-ink-line/60 ring-draft"
          />
        </>
      )}
    </div>
  );
}
