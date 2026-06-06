import { useState } from 'react';

export interface ConsoleEntry { level: string; args: string[]; }
export interface ConsoleProps {
  open: boolean;
  entries: ConsoleEntry[];
  onClear(): void;
  onEval(expr: string): void;
  onToggle(): void;
}

export function Console({ open, entries, onClear, onEval, onToggle }: ConsoleProps) {
  const [expr, setExpr] = useState('');
  return (
    <div data-testid="console" className={`border-t border-white/10 bg-black text-gray-200 ${open ? '' : 'h-8 overflow-hidden'}`}>
      <div className="flex items-center justify-between px-2 py-1 cursor-pointer select-none" onDoubleClick={onToggle}>
        <span>Console (<span data-testid="console-count">{entries.length}</span>)</span>
        <button data-testid="console-clear" onClick={onClear} className="text-xs text-gray-400 hover:text-white">Clear</button>
      </div>
      {open && (
        <>
          <div className="max-h-40 overflow-auto px-2 font-mono text-xs">
            {entries.map((e, i) => (<div key={i} className={e.level === 'error' ? 'text-red-400' : ''}>{e.args.join(' ')}</div>))}
          </div>
          <input
            data-testid="console-eval"
            value={expr}
            onChange={(ev) => setExpr(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' && expr.trim()) { onEval(expr); setExpr(''); } }}
            placeholder="Evaluate expression…"
            className="w-full bg-transparent px-2 py-1 font-mono text-xs outline-none border-t border-white/10"
          />
        </>
      )}
    </div>
  );
}
