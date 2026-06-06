import { SNIPPETS } from '../editor/snippets';

export function Toolbox({ onInsert }: { onInsert: (snippetCode: string) => void }) {
  return (
    <div className="hidden md:flex flex-wrap gap-1 p-1 border-b border-white/10 bg-gray-900">
      {SNIPPETS.map((s) => (
        <button
          key={s.id}
          data-testid={`snippet-${s.id}`}
          title={s.label}
          onClick={() => onInsert(s.code)}
          className="px-2 py-1 text-xs rounded text-gray-300 hover:bg-gray-700 hover:text-white"
        >{s.label}</button>
      ))}
    </div>
  );
}
