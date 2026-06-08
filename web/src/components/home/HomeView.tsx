import { useMemo, useState } from 'react';
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
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
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
  // Per-card actions (card kebab menu — wired but UI pending).
  onDeleteItem?(id: string): void;
  onForkItem?(item: Item): void;
  onMoveItem?(item: Item, folderId: string | null): void;
  onExportHtml?(item: Item): void;
  // Toolbar actions.
  onExportAll?(): void;
  onImport?(text: string): void;
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
  onDeleteItem,
  onForkItem,
  onExportHtml,
  readOnly = false,
}: HomeViewProps) {
  const query = useLibraryStore((s) => s.query);
  const activeFolderId = useLibraryStore((s) => s.activeFolderId);
  const sort = useLibraryStore((s) => s.sort);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const setActiveFolder = useLibraryStore((s) => s.setActiveFolder);
  const setSort = useLibraryStore((s) => s.setSort);

  // "Start something new" block collapsed state.
  const [startHidden, setStartHidden] = useState(false);

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

        {/* Spacer pushes search to center */}
        <div className="flex-1" />

        {/* Search — centred; fixed 288px on sm+, full-width flex-shrink on mobile */}
        <div className="relative flex-1 sm:flex-none sm:w-72 min-w-0">
          <SearchInput
            value={query}
            onChange={setQuery}
            surface="dark"
            placeholder="Search your diagrams…"
            data-testid="home-search"
            className="w-full"
          />
          {!query && (
            <kbd
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2',
                'inline-flex items-center justify-center h-5 min-w-[18px] px-1 rounded',
                'bg-ink-700 border border-ink-line/50 font-mono text-[10px] text-ondark-faint select-none',
              )}
            >
              /
            </kbd>
          )}
        </div>

        {/* Spacer mirrors brand width to keep search centred */}
        <div className="flex-1" />

        {/* Right-hand actions — split New button + avatar/sign-in */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Split New button: primary "New" + caret opening a mini-menu */}
          <div className="flex items-stretch">
            <Button
              variant="primary"
              size="md"
              data-testid="home-new"
              onClick={onNewDiagram}
              className="rounded-r-none border-r border-white/20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">New</span>
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More new diagram options"
                  className={cn(
                    'grid place-items-center h-8 px-1.5 rounded-r-md rounded-l-none',
                    'bg-accent hover:bg-accent-hover active:bg-accent-press text-white',
                    'transition-colors duration-150 ease-draft ring-draft',
                    'border-l border-white/20',
                  )}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" />
                  </svg>
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onSelect={onNewDiagram}>Blank diagram</MenuItem>
                <MenuItem onSelect={onBrowseTemplates}>From template…</MenuItem>
              </MenuContent>
            </Menu>
          </div>

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
              className="hidden sm:flex"
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      {/* Body — sidebar + main */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Folder sidebar — 236px per design spec */}
        <aside
          className="hidden sm:flex sm:flex-col w-[236px] shrink-0 bg-ink-950 border-r border-ink-line/40 overflow-y-auto px-2 py-3"
          data-testid="home-sidebar"
        >
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
          {/* "Start something new" — collapsible template row */}
          {!libraryEmpty && !query && !startHidden && (
            <div className="border-b border-ink-line/40 px-5 py-4" data-testid="home-start-block">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-sans font-semibold text-[13px] text-ondark-strong">Start something new</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ondark-faint">templates &amp; styles</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setStartHidden(true)}
                  className="font-sans text-[12px] text-ondark-faint hover:text-ondark-muted transition-colors duration-150"
                >
                  Hide
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {TEMPLATE_STUBS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={onBrowseTemplates}
                    className={cn(
                      'flex flex-col items-start gap-1.5 rounded-lg border border-ink-line/40 p-3 shrink-0 w-36',
                      'bg-ink-900 hover:border-accent/60 hover:bg-ink-800 transition-colors duration-150 ring-draft text-left',
                    )}
                  >
                    <div className="h-16 w-full rounded bg-ink-800 flex items-center justify-center text-ondark-faint text-[9px] font-mono">
                      {t.icon}
                    </div>
                    <span className="font-sans text-[11px] font-medium text-ondark-strong">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
            <div className="p-4 pt-5">
              {/* "My diagrams" heading + sort */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-sans font-semibold text-[13.5px] text-ondark-strong">
                  My diagrams
                  <span
                    data-testid="home-count"
                    className="ml-1.5 font-mono text-[11px] font-normal text-ondark-faint tabular-nums"
                  >
                    {visible.length}
                  </span>
                </h2>
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

              {/* Auto-fill card grid — minmax(232px) per design spec */}
              <div
                data-testid="home-grid"
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
              >
                {visible.map((item) => (
                  <DiagramCard
                    key={item.id}
                    item={item}
                    onClick={onOpen}
                    onDelete={onDeleteItem}
                    onFork={onForkItem}
                    onExportHtml={onExportHtml}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ZenUML brand icon — cobalt rounded square with the two-participant sequence glyph.
function BrandIcon() {
  return (
    <span
      className={cn(
        'grid place-items-center h-[30px] w-[30px] rounded-lg text-white shrink-0',
        'bg-gradient-to-br from-accent to-accent-press shadow-inset',
      )}
      aria-hidden="true"
    >
      <span className="h-[17px] w-[17px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <rect x="3" y="4" width="7" height="5" rx="1" />
          <rect x="14" y="4" width="7" height="5" rx="1" />
          <path d="M6.5 9v11M17.5 9v6" />
          <path d="M6.5 13h9M15 11l2 2-2 2" />
        </svg>
      </span>
    </span>
  );
}

// Stub template cards — clicking any opens the full template picker (CreateNewModal).
const TEMPLATE_STUBS = [
  { id: 'blank', label: 'Blank', icon: '—' },
  { id: 'api', label: 'REST API', icon: 'API' },
  { id: 'auth', label: 'Auth flow', icon: '🔑' },
  { id: 'microservices', label: 'Microservices', icon: '⬡' },
  { id: 'ecommerce', label: 'Checkout', icon: '🛒' },
];
