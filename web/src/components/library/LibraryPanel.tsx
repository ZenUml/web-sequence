import { useMemo, useRef } from 'react';
import type { Item, Folder } from '../../domain/types';
import { SearchInput, Button, cn } from '../../ui';
import { useLibraryStore } from '../../state/libraryStore';
import { FolderList } from './FolderList';
import { LibraryItemRow } from './LibraryItemRow';
import { ImportExportBar } from './ImportExportBar';

export interface LibraryPanelProps {
  items: Item[];
  folders: Folder[];
  onOpen(item: Item): void;
  onFork(item: Item): void;
  onDelete(id: string): void;
  onMove(item: Item, folderId: string | null): void;
  onExportAll(): void;
  onImport(text: string): void;
  onExportHtml(item: Item): void;
  onCreateFolder(name: string): void;
  onRenameFolder(id: string, name: string): void;
  onDeleteFolder(id: string): void;
  readOnly?: boolean;
}

// CQ-3 existence check: an item is "unfiled" when it has no folderId OR its
// folderId points to a folder that no longer exists (folder delete leaves the
// item's folderId orphaned — see CQ-3). Used for both filtering and counts.
function isUnfiled(item: Item, folders: Folder[]): boolean {
  return !item.folderId || !folders.some((f) => f.id === item.folderId);
}

// Full library panel on the dark `ink` chrome. REPLACES the M02 ItemListStub.
// Owns three store slices (query / activeFolderId / sort); every other behavior
// is injected via props so the panel stays presentational + testable.
export function LibraryPanel({
  items,
  folders,
  onOpen,
  onFork,
  onDelete,
  onMove,
  onExportAll,
  onImport,
  onExportHtml,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  readOnly = false,
}: LibraryPanelProps) {
  const query = useLibraryStore((s) => s.query);
  const activeFolderId = useLibraryStore((s) => s.activeFolderId);
  const sort = useLibraryStore((s) => s.sort);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const setActiveFolder = useLibraryStore((s) => s.setActiveFolder);
  const setSort = useLibraryStore((s) => s.setSort);

  const listRef = useRef<HTMLDivElement>(null);

  // Counts are computed over the FULL item set (REQ-LIB-1) — they must not
  // change when the user types a query or selects a folder.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, unfiled: 0 };
    for (const f of folders) c[f.id] = 0;
    for (const item of items) {
      if (isUnfiled(item, folders)) {
        c.unfiled += 1;
      } else if (item.folderId) {
        c[item.folderId] = (c[item.folderId] ?? 0) + 1;
      }
    }
    return c;
  }, [items, folders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      // Folder filter.
      if (activeFolderId === 'unfiled') {
        if (!isUnfiled(item, folders)) return false;
      } else if (activeFolderId !== null) {
        if (item.folderId !== activeFolderId) return false;
      }
      // Query filter — case-insensitive substring on title OR diagram source.
      if (q) {
        const inTitle = item.title.toLowerCase().includes(q);
        const inJs = item.js.toLowerCase().includes(q);
        if (!inTitle && !inJs) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => (b.updatedOn ?? 0) - (a.updatedOn ?? 0));
    }
    return sorted;
  }, [items, folders, activeFolderId, query, sort]);

  // Arrow-key roving focus across rows. LibraryItemRow already owns Enter/Space
  // → onOpen, so we only move DOM focus here and let the row handle activation.
  function handleListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const container = listRef.current;
    if (!container) return;
    // Match only row containers, not the per-row kebab (`lib-row-menu-*`),
    // which also starts with `lib-row-`.
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="lib-row-"]'),
    ).filter((el) => !el.getAttribute('data-testid')?.startsWith('lib-row-menu-'));
    if (rows.length === 0) return;
    const current = document.activeElement as HTMLElement | null;
    const idx = current ? rows.indexOf(current) : -1;
    e.preventDefault();
    const next =
      e.key === 'ArrowDown'
        ? rows[Math.min(idx + 1, rows.length - 1)]
        : rows[Math.max(idx - 1, 0)];
    next?.focus();
  }

  const empty = visible.length === 0;
  const libraryEmpty = items.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="library-panel">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          surface="dark"
          data-testid="lib-search"
          placeholder="Search diagrams"
          className="flex-1"
        />
        <span
          data-testid="lib-total-count"
          className="font-mono text-[11px] text-ondark-faint tabular-nums"
        >
          {items.length}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <ImportExportBar onExportAll={onExportAll} onImport={onImport} />
        <Button
          variant="ghost"
          size="sm"
          data-testid="lib-sort"
          onClick={() => setSort(sort === 'updated' ? 'title' : 'updated')}
        >
          {sort === 'updated' ? 'Sort: Recent' : 'Sort: Title'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden pt-2">
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-ink-line px-2 py-2">
          <FolderList
            folders={folders}
            activeFolderId={activeFolderId}
            counts={counts}
            onSelectFolder={setActiveFolder}
            onCreate={onCreateFolder}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
            readOnly={readOnly}
          />
        </aside>

        {empty ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 bg-blueprint p-8"
            data-testid="library-empty"
          >
            <h2 className="font-serif text-[28px] leading-tight tracking-tight text-ondark-strong">
              {libraryEmpty ? 'No diagrams' : 'No matches'}
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ondark-faint">
              {libraryEmpty ? 'Save a diagram to see it here' : 'Try a different search'}
            </p>
          </div>
        ) : (
          <div
            ref={listRef}
            data-testid="library-list"
            className={cn('flex flex-1 flex-col overflow-y-auto')}
            onKeyDown={handleListKeyDown}
          >
            {visible.map((item) => (
              <LibraryItemRow
                key={item.id}
                item={item}
                folders={folders}
                onOpen={onOpen}
                onFork={onFork}
                onDelete={onDelete}
                onMove={onMove}
                onExportHtml={onExportHtml}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
