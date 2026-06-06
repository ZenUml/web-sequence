// M03: replace with full library panel
import { useState } from 'react';
import type { Item } from '../../domain/types';
import { IconButton, cn } from '../../ui';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export interface ItemListStubProps {
  items: Item[];
  onOpen(item: Item): void;
  onDelete(id: string): void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ItemListStub({ items, onOpen, onDelete }: ItemListStubProps) {
  // confirmingId tracks which item's delete dialog is open (at list level — not nested
  // inside a row, so portal confirm-click cannot bubble up to any row's onClick).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 bg-blueprint p-8"
        data-testid="library-empty"
      >
        <h2 className="font-serif text-[28px] leading-tight tracking-tight text-ondark-strong">
          No saved diagrams yet
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ondark-faint">
          Save a diagram to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto" data-testid="library-list">
      {items.map((item) => (
        <div
          key={item.id}
          data-testid={`library-item-${item.id}`}
          role="button"
          tabIndex={0}
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-2.5',
            'cursor-pointer hover:bg-white/5 focus:outline-none ring-draft',
            'border-b border-ink-line',
          )}
          onClick={() => onOpen(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen(item);
            }
          }}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-sans text-[13px] text-ondark-strong truncate">
              {item.title || 'Untitled'}
            </span>
            {item.updatedOn != null && (
              <span className="font-mono text-[11px] text-ondark-faint">
                {formatDate(item.updatedOn)}
              </span>
            )}
          </div>
          <IconButton
            aria-label="Delete diagram"
            data-testid={`library-delete-${item.id}`}
            size="sm"
            surface="dark"
            onClick={(e) => {
              e.stopPropagation(); // prevent row's onOpen from firing
              setConfirmingId(item.id);
            }}
          >
            {/* Minimal trash icon via inline SVG — no extra dep */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.75 3.5h10.5M5.25 3.5V2.333a.583.583 0 0 1 .583-.583h2.334a.583.583 0 0 1 .583.583V3.5m1.75 0v8.167a.583.583 0 0 1-.583.583H4.083a.583.583 0 0 1-.583-.583V3.5h7Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        </div>
      ))}

      {/* Single ConfirmDialog rendered at list level — not inside a row — so
          portal confirm-click cannot bubble to any row's onClick handler. */}
      <ConfirmDialog
        open={confirmingId !== null}
        onOpenChange={(o) => { if (!o) setConfirmingId(null); }}
        title="Delete this diagram?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => {
          if (confirmingId !== null) onDelete(confirmingId);
        }}
      />
    </div>
  );
}
