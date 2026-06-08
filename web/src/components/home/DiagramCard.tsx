import { useState } from 'react';
import type { Item } from '../../domain/types';
import { cn, Menu, MenuTrigger, MenuContent, MenuItem } from '../../ui';

interface DiagramCardProps {
  item: Item;
  onClick(item: Item): void;
  onDelete?(id: string): void;
  onFork?(item: Item): void;
  onExportHtml?(item: Item): void;
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="h-[14px] w-[14px]" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

export function DiagramCard({ item, onClick, onDelete, onFork, onExportHtml }: DiagramCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const preview = (item.js ?? '').trim().slice(0, 240);
  const updated = item.updatedOn
    ? new Date(item.updatedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const hasMenu = !!(onDelete || onFork || onExportHtml);

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border text-left w-full',
        'transition-all duration-150 ease-draft ring-draft cursor-pointer',
        'bg-ink-800 border-ink-line/40',
        'hover:border-accent/60 hover:shadow-pop-dark hover:-translate-y-[3px]',
      )}
      data-testid={`home-card-${item.id}`}
    >
      {/* Clickable area — thumbnail + footer */}
      <button
        type="button"
        onClick={() => onClick(item)}
        className="flex flex-col w-full text-left focus:outline-none"
        aria-label={`Open ${item.title || 'Untitled'}`}
      >
        {/* DSL code preview */}
        <div
          className="h-28 overflow-hidden rounded-t-xl px-3 pt-3 bg-ink-950 border-b border-ink-line/30 w-full"
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
        <div className="flex flex-col gap-0.5 px-3 py-2.5 min-w-0 w-full">
          <span className="font-sans font-medium text-[13px] text-ondark-strong truncate pr-5">
            {item.title || 'Untitled'}
          </span>
          {updated && (
            <span className="font-mono text-[10px] text-ondark-faint tabular-nums">
              {updated}
            </span>
          )}
        </div>
      </button>

      {/* Kebab menu — appears on group hover */}
      {hasMenu && (
        <div className={cn(
          'absolute top-2 right-2',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-100',
          menuOpen && 'opacity-100',
        )}>
          <Menu open={menuOpen} onOpenChange={setMenuOpen}>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="Diagram options"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'grid place-items-center h-6 w-6 rounded-md',
                  'bg-ink-700/80 text-ondark-muted hover:text-ondark-strong hover:bg-ink-600/80',
                  'transition-colors duration-100 ring-draft',
                )}
              >
                <KebabIcon />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              {onFork && (
                <MenuItem onSelect={() => { setMenuOpen(false); onFork(item); }}>
                  Duplicate
                </MenuItem>
              )}
              {onExportHtml && (
                <MenuItem onSelect={() => { setMenuOpen(false); onExportHtml(item); }}>
                  Export as HTML
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem
                  data-variant="danger"
                  onSelect={() => { setMenuOpen(false); onDelete(item.id); }}
                >
                  Delete
                </MenuItem>
              )}
            </MenuContent>
          </Menu>
        </div>
      )}
    </div>
  );
}
