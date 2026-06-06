import { useState, useRef, useEffect } from 'react';
import type { Page } from '../../domain/types';
import { IconButton, TextInput, cn } from '../../ui';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export interface PageTabsProps {
  pages: Page[];
  currentPageId: string;
  onSwitch(id: string): void;
  onAdd(): void;
  onDelete(id: string): void;
  onRename(id: string, title: string): void;
  readOnly?: boolean;
}

export function PageTabs({
  pages,
  currentPageId,
  onSwitch,
  onAdd,
  onDelete,
  onRename,
  readOnly = false,
}: PageTabsProps) {
  // editingId: which tab is currently being renamed (null = none)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // deleteId: which tab's confirm-delete dialog is open (null = none)
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when entering rename mode
  useEffect(() => {
    if (editingId !== null) {
      inputRef.current?.select();
    }
  }, [editingId]);

  function startRename(page: Page) {
    if (readOnly) return;
    setEditingId(page.id);
    setDraft(page.title);
  }

  function commitRename() {
    if (editingId === null) return;
    const trimmed = draft.trim();
    if (trimmed) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
  }

  function cancelRename() {
    setEditingId(null);
  }

  return (
    <div
      role="tablist"
      aria-label="Pages"
      className="flex items-center gap-0.5 px-2 py-1 bg-ink-900 border-b border-ink-line"
    >
      {pages.map((page) => {
        const isActive = page.id === currentPageId;
        const isRenaming = editingId === page.id;
        const canDelete = !page.isDefault && !readOnly;

        return (
          <div key={page.id} className="relative flex items-center">
            {isRenaming ? (
              <TextInput
                ref={inputRef}
                surface="dark"
                data-testid={`page-rename-${page.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                }}
                onBlur={commitRename}
                className="h-6 px-1.5 text-[11px] font-mono w-28 min-w-0"
                aria-label="Rename page"
              />
            ) : (
              <button
                role="tab"
                data-testid={`page-tab-${page.id}`}
                aria-selected={isActive}
                onClick={() => onSwitch(page.id)}
                onDoubleClick={() => startRename(page)}
                className={cn(
                  'relative flex items-center gap-1 h-7 px-2.5 rounded-t text-[11px] font-mono uppercase tracking-[0.1em]',
                  'transition-colors duration-150 ease-draft select-none whitespace-nowrap',
                  'focus-visible:outline-none ring-draft',
                  isActive
                    ? [
                        'bg-accent-soft text-ondark-strong',
                        // accent underline at bottom of tab
                        'after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-accent after:rounded-t',
                      ]
                    : 'text-ondark-muted hover:text-ondark-strong hover:bg-white/5',
                )}
              >
                {page.title}
                {canDelete && (
                  <span
                    role="presentation"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(page.id); }}
                    className="ml-0.5"
                  >
                    <IconButton
                      size="sm"
                      surface="dark"
                      aria-label="Delete page"
                      data-testid={`page-delete-${page.id}`}
                      className="h-4 w-4"
                      // Don't propagate to the tab button (handled by onClick above)
                      onClick={(e) => { e.stopPropagation(); setDeleteId(page.id); }}
                    >
                      {/* × close icon */}
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                        <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </IconButton>
                  </span>
                )}
              </button>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <IconButton
          size="sm"
          surface="dark"
          aria-label="Add page"
          data-testid="page-add"
          onClick={onAdd}
          className="ml-1"
        >
          {/* + icon */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </IconButton>
      )}

      {/* Confirm-before-delete dialog */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        title="Delete page?"
        message="This page and its diagram will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => {
          if (deleteId !== null) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}
