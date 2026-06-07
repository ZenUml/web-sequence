import { useState } from 'react';
import { Button } from '../ui';

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
  return (
    <div
      data-testid="console"
      className={`border-t border-ink-line/60 bg-ink-800 text-ondark-muted ${open ? '' : 'h-8 overflow-hidden'}`}
    >
      <div className="flex items-center justify-between pl-1 pr-2 py-0.5 select-none">
        {/* Real toggle button: keyboard-operable and exposes its open state to AT.
            The whole header row remains double-clickable as an extra affordance. */}
        <button
          type="button"
          data-testid="console-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse console' : 'Expand console'}
          onClick={onToggle}
          onDoubleClick={onToggle}
          className="flex-1 flex items-center gap-1 rounded px-1 py-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ondark-muted hover:text-ondark-strong ring-draft"
        >
          <span aria-hidden="true" className="text-ondark-faint">{open ? '▾' : '▸'}</span>
          <span>Console (<span data-testid="console-count">{entries.length}</span>)</span>
        </button>
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
            className="w-full bg-transparent px-2 py-1 font-mono text-xs text-ondark-strong placeholder:text-ondark-faint outline-none border-t border-ink-line/60 ring-draft"
          />
        </>
      )}
    </div>
  );
}
