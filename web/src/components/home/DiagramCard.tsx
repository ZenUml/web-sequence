import type { Item } from '../../domain/types';
import { cn } from '../../ui';

interface DiagramCardProps {
  item: Item;
  onClick(item: Item): void;
}

export function DiagramCard({ item, onClick }: DiagramCardProps) {
  const preview = (item.js ?? '').trim().slice(0, 240);
  const updated = item.updatedOn
    ? new Date(item.updatedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      type="button"
      data-testid={`home-card-${item.id}`}
      onClick={() => onClick(item)}
      className={cn(
        'group relative flex flex-col rounded-xl border text-left w-full',
        'transition-all duration-150 ease-draft ring-draft cursor-pointer',
        'bg-ink-800 border-ink-line/40',
        'hover:border-accent/60 hover:shadow-pop-dark',
      )}
    >
      {/* DSL code preview */}
      <div
        className="h-28 overflow-hidden rounded-t-xl px-3 pt-3 bg-ink-950 border-b border-ink-line/30"
        aria-hidden="true"
      >
        <pre
          className={cn(
            'font-mono text-[9.5px] leading-[1.65] text-ondark-faint',
            'whitespace-pre-wrap break-all select-none',
          )}
          style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 8, overflow: 'hidden' }}
        >
          {preview || '# empty diagram'}
        </pre>
      </div>

      {/* Card footer */}
      <div className="flex flex-col gap-0.5 px-3 py-2.5 min-w-0">
        <span className="font-sans font-medium text-[13px] text-ondark-strong truncate">
          {item.title || 'Untitled'}
        </span>
        {updated && (
          <span className="font-mono text-[10px] text-ondark-faint tabular-nums">
            {updated}
          </span>
        )}
      </div>
    </button>
  );
}
