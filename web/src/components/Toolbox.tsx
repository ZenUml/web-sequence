import { SNIPPETS } from '../editor/snippets';

export function Toolbox({ onInsert }: { onInsert: (snippetCode: string) => void }) {
  return (
    <div className="hidden md:flex flex-wrap gap-1 px-2 py-1.5 border-b border-ink-line/40 bg-ink-800">
      {SNIPPETS.map((s) => (
        <button
          key={s.id}
          data-testid={`snippet-${s.id}`}
          title={s.label}
          onClick={() => onInsert(s.code)}
          className="px-2 py-1 text-[12px] rounded text-ondark-muted hover:bg-ink-700 hover:text-ondark-strong transition-colors duration-150 ease-draft ring-draft"
        >{s.label}</button>
      ))}
    </div>
  );
}
