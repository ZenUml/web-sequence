import { useState, useRef, useEffect } from 'react';
import type { Page, Appearance } from '../../domain/types';
import { IconButton, PlusIcon, TextInput, cn } from '../../ui';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export interface PageTabsProps {
  pages: Page[];
  currentPageId: string;
  onSwitch(id: string): void;
  onAdd(): void;
  onDelete(id: string): void;
  onRename(id: string, title: string): void;
  readOnly?: boolean;
  // Which chrome the tabs sit on. 'dark' = the ink editor side (legacy default).
  // 'light' = the white renderer header (.pv-head) — page tabs now live there
  // (redesign §02), so they must wear the light .rtab tokens instead of dark ink.
  surface?: 'dark' | 'light';
  appearance?: Appearance;
}

export function PageTabs({
  pages,
  currentPageId,
  onSwitch,
  onAdd,
  onDelete,
  onRename,
  readOnly = false,
  surface = 'dark',
  appearance,
}: PageTabsProps) {
  const light = surface === 'light';
  // editingId: which tab is currently being renamed (null = none)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // deleteId: which tab's confirm-delete dialog is open (null = none)
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Fix 2: cancellation guard — prevents blur from committing after Escape
  const cancelledRef = useRef(false);

  // Focus the input when entering rename mode
  useEffect(() => {
    if (editingId !== null) {
      inputRef.current?.select();
    }
  }, [editingId]);

  function startRename(page: Page) {
    if (readOnly) return;
    cancelledRef.current = false; // reset on every new rename
    setEditingId(page.id);
    setDraft(page.title);
  }

  function commitRename() {
    if (editingId === null) return;
    // Fix 2: if Escape was pressed, the blur that follows must no-op
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const trimmed = draft.trim();
    if (trimmed) {
      onRename(editingId, trimmed);
    }
    setEditingId(null);
  }

  function cancelRename() {
    cancelledRef.current = true;
    setEditingId(null);
  }

  return (
    <div
      role="tablist"
      aria-label="Pages"
      className={cn(
        'editor-page-tabs flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto',
        // Light: the white RendererHeader (.pv-head) owns the surface + border, so the
        // tablist adds neither — only its tab pills. Dark: legacy ink strip.
        light ? 'min-w-0' : 'px-2 py-1 bg-ink-900 border-b border-ink-line',
      )}
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
                surface={appearance ?? surface}
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
              // Fix 1: use <div role="tab"> so IconButton (a <button>) is NOT nested inside a <button>
              <div
                role="tab"
                data-testid={`page-tab-${page.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSwitch(page.id)}
                onDoubleClick={() => startRename(page)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onSwitch(page.id); }
                  if (e.key === ' ') { e.preventDefault(); onSwitch(page.id); }
                }}
                className={cn(
                  'relative flex items-center gap-1 select-none whitespace-nowrap cursor-pointer',
                  'transition-colors duration-150 ease-draft focus-visible:outline-none',
                  // Light (editor preview card): the active underline is drawn on the
                  // label wrapper (styled in globals.css).
                  // Dark (legacy): accent-soft tab + accent underline.
                  light
                    ? 'editor-page-tab'
                    : 'h-7 px-2.5 text-[11px] font-mono uppercase tracking-[0.1em] rounded-t ring-draft',
                  isActive
                    ? light
                      ? 'editor-page-tab--active'
                      : [
                          'bg-accent-soft text-ondark-strong',
                          'after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-accent after:rounded-t',
                        ]
                    : light
                      ? 'editor-page-tab--idle'
                      : 'text-ondark-muted hover:text-ondark-strong hover:bg-white/5',
                )}
              >
                {/* The label wrapper carries the light active underline, so label and
                    underline share a centre even when the tab also holds a delete ×. */}
                <span className={cn('relative flex min-w-0 items-center self-stretch', light && 'editor-page-tab-label')}>
                  <span className="max-w-[180px] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={page.title}>
                    {page.title}
                  </span>
                </span>
                {canDelete && (
                  // Fix 1: IconButton is a sibling to the label text, not nested in a <button>
                  <IconButton
                    size="sm"
                    surface={appearance ?? surface}
                    aria-label="Delete page"
                    data-testid={`page-delete-${page.id}`}
                    className="ml-0.5 h-4 w-4"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(page.id); }}
                  >
                    {/* × close icon */}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
                      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </IconButton>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <IconButton
          size="sm"
          surface={appearance ?? surface}
          aria-label="Add page"
          data-testid="page-add"
          // Wrap so the click event is NOT forwarded as onAdd's first arg — onAdd
          // is `(): void` and the store's addPage(title?) would otherwise receive
          // the SyntheticEvent as `title`, rendering an object as a React child
          // (crashes the editor subtree). Caught by the multi-page E2E.
          onClick={() => onAdd()}
          className={light ? 'editor-page-add' : 'ml-1'}
        >
          <PlusIcon size={light ? 16 : 10} strokeWidth={light ? 1 : 1.5} />
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
