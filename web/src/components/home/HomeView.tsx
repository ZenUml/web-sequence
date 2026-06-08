import { useMemo } from 'react';
import type { Item, Folder, AppUser } from '../../domain/types';
import {
  SearchInput,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  cn,
} from '../../ui';
import { useLibraryStore } from '../../state/libraryStore';
import { FolderList } from '../library/FolderList';
import { DiagramCard } from './DiagramCard';

function buildCounts(items: Item[], folders: Folder[]) {
  const c: Record<string, number> = { all: items.length, unfiled: 0 };
  for (const f of folders) c[f.id] = 0;
  for (const item of items) {
    if (!item.folderId || !folders.some((f) => f.id === item.folderId)) {
      c.unfiled += 1;
    } else if (item.folderId) {
      c[item.folderId] = (c[item.folderId] ?? 0) + 1;
    }
  }
  return c;
}

export interface HomeViewProps {
  items: Item[];
  folders: Folder[];
  user: AppUser | null;
  onOpen(item: Item): void;
  onNewDiagram(): void;
  onBrowseTemplates(): void;
  onOpenSignIn(): void;
  onLogout(): void;
  onCreateFolder(name: string): void;
  onRenameFolder(id: string, name: string): void;
  onDeleteFolder(id: string): void;
  readOnly?: boolean;
}

export function HomeView({
  items,
  folders,
  user,
  onOpen,
  onNewDiagram,
  onBrowseTemplates,
  onOpenSignIn,
  onLogout,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  readOnly = false,
}: HomeViewProps) {
  const query = useLibraryStore((s) => s.query);
  const activeFolderId = useLibraryStore((s) => s.activeFolderId);
  const sort = useLibraryStore((s) => s.sort);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const setActiveFolder = useLibraryStore((s) => s.setActiveFolder);
  const setSort = useLibraryStore((s) => s.setSort);

  const counts = useMemo(() => buildCounts(items, folders), [items, folders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (activeFolderId === 'unfiled') {
        if (item.folderId && folders.some((f) => f.id === item.folderId)) return false;
      } else if (activeFolderId !== null) {
        if (item.folderId !== activeFolderId) return false;
      }
      if (q) {
        return item.title.toLowerCase().includes(q) || (item.js ?? '').toLowerCase().includes(q);
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

  const libraryEmpty = items.length === 0;
  const hasResults = visible.length > 0;

  return (
    <div className="flex flex-col h-full w-full" data-testid="home-view">
      {/* Hub topbar — brand · search · actions */}
      <header className="bg-ink-900 border-b border-ink-line/40 h-14 px-4 flex items-center gap-3 shrink-0">
        {/* Brand mark */}
        <div className="flex items-center gap-2 shrink-0">
          <BrandIcon />
          <span className="font-serif text-[17px] tracking-tight text-ondark-strong hidden sm:block">
            ZenUML
          </span>
        </div>

        {/* Search — centred, expands to fill space */}
        <div className="flex-1 min-w-0 max-w-xs mx-auto">
          <SearchInput
            value={query}
            onChange={setQuery}
            surface="dark"
            placeholder="Search diagrams…"
            data-testid="home-search"
          />
        </div>

        {/* Right-hand actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="md"
            data-testid="home-new"
            onClick={onNewDiagram}
          >
            New diagram
          </Button>
          {user ? (
            <button
              type="button"
              data-testid="home-avatar"
              onClick={onLogout}
              title={`Signed in as ${user.displayName ?? user.email ?? user.uid}. Click to sign out.`}
              aria-label="Account"
              className={cn(
                'flex h-8 w-8 items-center justify-center shrink-0 rounded-full',
                'bg-accent text-white text-[12px] font-bold select-none',
                'ring-draft transition-opacity hover:opacity-80',
              )}
            >
              {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
            </button>
          ) : (
            <Button
              variant="subtle"
              size="md"
              data-testid="home-signin"
              onClick={onOpenSignIn}
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      {/* Body — sidebar + main */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Folder sidebar */}
        <aside className="w-44 shrink-0 bg-ink-950 border-r border-ink-line/40 overflow-y-auto px-2 py-3">
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

        {/* Main diagram grid */}
        <main className="flex-1 bg-blueprint overflow-y-auto">
          {/* Empty library — first-run CTA */}
          {libraryEmpty && !query && (
            <div
              className="flex flex-col items-center justify-center gap-4 h-full min-h-[320px] px-8"
              data-testid="home-empty"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-line bg-ink-700 text-ondark-muted">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                  aria-hidden="true"
                >
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="font-serif text-[28px] leading-tight tracking-tight text-ondark-strong">
                  No diagrams yet
                </h2>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ondark-muted">
                  Start from scratch, or pick a styled template.
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  data-testid="home-empty-new"
                  onClick={onNewDiagram}
                >
                  New diagram
                </Button>
                <Button
                  variant="subtle"
                  size="md"
                  data-testid="home-empty-templates"
                  onClick={onBrowseTemplates}
                >
                  Browse templates
                </Button>
              </div>
            </div>
          )}

          {/* No search matches */}
          {!hasResults && query && (
            <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[240px]">
              <h2 className="font-serif text-[22px] text-ondark-strong">No matches</h2>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ondark-muted">
                Try a different search
              </p>
            </div>
          )}

          {/* Diagram grid */}
          {hasResults && (
            <div className="p-4">
              {/* Sort / count bar */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span
                  data-testid="home-count"
                  className="font-mono text-[11px] text-ondark-faint tabular-nums"
                >
                  {visible.length} {visible.length === 1 ? 'diagram' : 'diagrams'}
                </span>
                <Select
                  value={sort}
                  onValueChange={(v) => setSort(v as 'updated' | 'title')}
                >
                  <SelectTrigger
                    surface="dark"
                    data-testid="home-sort"
                    aria-label="Sort diagrams"
                    className="shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Recent</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-fill card grid — minmax(200px) matches the design's 232px target */}
              <div
                data-testid="home-grid"
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
              >
                {visible.map((item) => (
                  <DiagramCard key={item.id} item={item} onClick={onOpen} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Minimal ZenUML brand icon — cobalt rounded square with a sequence-like glyph.
function BrandIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <rect width="26" height="26" rx="6" fill="#2F6BFF" />
      <path
        d="M7 9h12l-5 4 5 4H7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
