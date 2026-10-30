import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item, Folder, AppUser, Appearance } from '../../domain/types';
import { BrandLogo, Tooltip } from '../../ui';
import { useLibraryStore } from '../../state/libraryStore';
import { TEMPLATES, blankTemplate } from '../../domain/templates';
import { DiagramCard } from './DiagramCard';
import { DeleteDiagramDialog } from './DeleteDiagramDialog';
import { HomeSidebar } from './HomeSidebar';
import { MoveStatusPanel, useMoveController } from './moveController';
import { FolderOutlineIcon, MoonIcon, PlusIcon, SunIcon } from './icons';
import blankArt from './assets/template-blank.svg';
import blackWhiteArt from './assets/template-black-white.svg';
import blueArt from './assets/template-blue.svg';
import classicArt from './assets/template-classic-uml.svg';
import './home.css';

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
  // Create a diagram directly from a template's content and open it in the editor.
  // The "Start something new" cards use this so one click creates the chosen
  // template — they must NOT reopen the CreateNewModal picker.
  onCreateFromTemplate(item: Partial<Item>): void;
  onOpenSignIn(): void;
  onLogout(): void;
  // Folder writes. Return the persistence Promise so the sidebar can show pending
  // and failure states (a rejection keeps the typed name and offers Try again).
  onCreateFolder(name: string): Promise<void> | void;
  onRenameFolder(id: string, name: string): Promise<void> | void;
  onDeleteFolder(id: string): Promise<void> | void;
  // Card actions. Delete returns a Promise so the confirmation dialog can show
  // pending/failure states; it is only called after explicit confirmation.
  onDeleteItem?(id: string): Promise<void>;
  onForkItem?(item: Item): void;
  // Move a diagram to a folder (null = Not in a folder). Return the persistence
  // Promise so failures can be shown and retried, and Undo can be offered.
  onMoveItem?(item: Item, folderId: string | null): Promise<void> | void;
  // HTML export stays available to callers; the Diagrams cards no longer offer it.
  onExportHtml?(item: Item): void;
  // Library tools.
  onExportAll?(): void;
  onImport?(text: string): void;
  // Preferred import entry: the picked File goes to the central import controller.
  // When given, it is used instead of onImport. Pending until the Promise settles.
  onImportFile?(file: File): Promise<void>;
  // True while an import runs elsewhere; the Import button ignores new picks.
  importPending?: boolean;
  // Legacy onImport path only: reading the picked file failed.
  onImportError?(error: unknown): void;
  // Report a bug, rendered as the last Library tool (keeps it out of the card grid).
  reportBug?: ReactNode;
  // Global appearance (the same persisted setting the Editor uses).
  appearance?: Appearance;
  onToggleAppearance?(): void;
  readOnly?: boolean;
}

interface QuickStart {
  id: string;
  label: string;
  description: string;
  art: string;
  item: Partial<Item>;
}

function templateItem(id: string): Partial<Item> {
  const t = TEMPLATES.find((tpl) => tpl.id === id);
  if (!t) throw new Error(`Missing template ${id}`);
  return t.item;
}

// "Start something new" quick starts. Basic is intentionally not offered here; it
// remains in TEMPLATES and in the full picker (Browse templates / CreateNewModal).
export const QUICK_STARTS: QuickStart[] = [
  { id: 'blank', label: 'Blank', description: 'Start with an empty diagram.', art: blankArt, item: blankTemplate() },
  { id: 'black-white', label: 'Black & White', description: 'Sharp ink. Crisp shadows.', art: blackWhiteArt, item: templateItem('black-white') },
  { id: 'blue', label: 'Blue', description: 'Soft blue. Rounded details.', art: blueArt, item: templateItem('blue') },
  { id: 'starUMLTheme', label: 'Classic UML', description: 'Pale yellow. Rose-red lines.', art: classicArt, item: templateItem('starUMLTheme') },
];

export function HomeView({
  items,
  folders,
  user,
  onOpen,
  onNewDiagram,
  onBrowseTemplates,
  onCreateFromTemplate,
  onOpenSignIn,
  onLogout,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteItem,
  onForkItem,
  onMoveItem,
  onExportAll,
  onImport,
  onImportFile,
  importPending,
  onImportError,
  reportBug,
  appearance = 'light',
  onToggleAppearance,
  readOnly = false,
}: HomeViewProps) {
  const query = useLibraryStore((s) => s.query);
  const activeFolderId = useLibraryStore((s) => s.activeFolderId);
  const sort = useLibraryStore((s) => s.sort);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const setActiveFolder = useLibraryStore((s) => s.setActiveFolder);
  const setSort = useLibraryStore((s) => s.setSort);

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const counts = useMemo(() => buildCounts(items, folders), [items, folders]);
  const canMove = Boolean(onMoveItem) && !readOnly && folders.length > 0;
  const move = useMoveController({ items, folders, onMoveItem });

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

  // "/" focuses search (the hint shown inside the field), unless typing elsewhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const libraryEmpty = items.length === 0;
  const activeFolder =
    activeFolderId !== null && activeFolderId !== 'unfiled' ? folders.find((f) => f.id === activeFolderId) ?? null : null;
  const hasResults = visible.length > 0;
  const dark = appearance === 'dark';
  const appearanceLabel = dark ? 'Switch to light appearance' : 'Switch to dark appearance';

  return (
    <div className={move.status ? 'diagrams-home has-status' : 'diagrams-home'} data-testid="home-view">
      <header className="dh-topbar">
        <div className="dh-brand">
          <span className="dh-brand-mark" aria-hidden="true">
            <BrandLogo className="dh-brand-logo" />
          </span>
          <span className="dh-brand-name">ZenUML</span>
        </div>
        <div className="dh-topbar-actions">
          <button type="button" className="dh-button dh-button--primary dh-new" data-testid="home-new" onClick={onNewDiagram}>
            <PlusIcon />
            New
          </button>
          {onToggleAppearance && (
            <Tooltip label={appearanceLabel}>
              <button
                type="button"
                className="dh-appearance"
                data-testid="home-appearance"
                aria-label={appearanceLabel}
                onClick={onToggleAppearance}
              >
                {dark ? <SunIcon /> : <MoonIcon />}
              </button>
            </Tooltip>
          )}
          {user ? (
            <button
              type="button"
              data-testid="home-avatar"
              onClick={onLogout}
              title={`Signed in as ${user.displayName ?? user.email ?? user.uid}. Click to sign out.`}
              aria-label="Account"
              className="dh-avatar"
            >
              {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
            </button>
          ) : (
            <button type="button" className="dh-button dh-button--secondary" data-testid="home-signin" onClick={onOpenSignIn}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <div className="dh-body">
        <HomeSidebar
          folders={folders}
          activeFolderId={activeFolderId}
          counts={counts}
          onSelectFolder={setActiveFolder}
          onCreate={onCreateFolder}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
          readOnly={readOnly}
          onExportAll={onExportAll}
          onImport={onImport}
          onImportFile={onImportFile}
          importPending={importPending}
          onImportError={onImportError}
          reportBug={reportBug}
          drag={move.drag}
          dropTarget={move.dropTarget}
          onDragOverTarget={move.setDropTarget}
          onDropOnTarget={move.dropOn}
          status={move.status ? <MoveStatusPanel status={move.status} earlier={move.earlier} onUndo={move.undo} onRetry={move.retry} onDismiss={move.dismiss} /> : null}
        />

        <main className="dh-surface">
          {!query && (
            <section className="dh-section" aria-labelledby="dh-start-heading" data-testid="home-start-block">
              <h2 id="dh-start-heading" className="dh-section-title">Start something new</h2>
              <div className="dh-templates">
                {QUICK_STARTS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="dh-template"
                    data-testid={`home-template-${t.id}`}
                    onClick={() => onCreateFromTemplate(t.item)}
                  >
                    <span className="dh-template-art">
                      <img src={t.art} alt="" draggable={false} />
                    </span>
                    <span className="dh-pocket dh-pocket--template">
                      <span className="dh-template-title">{t.label}</span>
                      <span className="dh-template-desc">{t.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {libraryEmpty && !query ? (
            <div className="dh-empty" data-testid="home-empty">
              <h2 className="dh-empty-title">No diagrams yet</h2>
              <p className="dh-empty-text">Start from scratch, or pick a styled template.</p>
              <div className="dh-empty-actions">
                <button type="button" className="dh-button dh-button--primary" data-testid="home-empty-new" onClick={onNewDiagram}>
                  New diagram
                </button>
                <button type="button" className="dh-button dh-button--secondary" data-testid="home-empty-templates" onClick={onBrowseTemplates}>
                  Browse templates
                </button>
              </div>
            </div>
          ) : (
            <section className="dh-section" aria-labelledby="dh-diagrams-heading">
              <div className="dh-diagrams-head">
                <h2 id="dh-diagrams-heading" ref={headingRef} tabIndex={-1} className="dh-diagrams-title">
                  Diagrams
                  <span className="dh-count" data-testid="home-count">{visible.length}</span>
                </h2>
                <div className="dh-search">
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your diagrams…"
                    aria-label="Search your diagrams"
                    data-testid="home-search"
                    className="dh-search-input"
                  />
                  {query ? (
                    <button
                      type="button"
                      className="dh-search-clear"
                      aria-label="Clear search"
                      data-testid="search-clear"
                      onClick={() => {
                        setQuery('');
                        searchRef.current?.focus();
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  ) : (
                    <kbd className="dh-search-kbd" aria-hidden="true">/</kbd>
                  )}
                </div>
                <div className="dh-sort" role="group" aria-label="Sort diagrams" data-testid="home-sort">
                  <button
                    type="button"
                    className={sort === 'updated' ? 'dh-sort-option is-selected' : 'dh-sort-option'}
                    aria-pressed={sort === 'updated'}
                    data-testid="home-sort-updated"
                    onClick={() => setSort('updated')}
                  >
                    Last modified
                  </button>
                  <button
                    type="button"
                    className={sort === 'title' ? 'dh-sort-option is-selected' : 'dh-sort-option'}
                    aria-pressed={sort === 'title'}
                    data-testid="home-sort-title"
                    onClick={() => setSort('title')}
                  >
                    Name A–Z
                  </button>
                </div>
              </div>

              {!hasResults && query && (
                <div className="dh-no-results" data-testid="home-no-results">
                  <p className="dh-no-results-title">No matches</p>
                  <p className="dh-no-results-text">
                    No diagrams match “<span className="dh-no-results-term">{query.trim()}</span>”.
                  </p>
                  <button
                    type="button"
                    className="dh-button dh-button--secondary dh-no-results-clear"
                    data-testid="home-no-results-clear"
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                  >
                    Clear search
                  </button>
                </div>
              )}

              {!hasResults && !query && activeFolder && (
                <div className="dh-folder-empty" data-testid="home-folder-empty">
                  <span className="dh-folder-empty-icon"><FolderOutlineIcon /></span>
                  <p className="dh-folder-empty-title">No diagrams in this folder</p>
                  <p className="dh-folder-empty-text">
                    {canMove ? 'Drag a diagram here, or use Move to folder on a diagram.' : 'Drag a diagram here.'}
                  </p>
                </div>
              )}

              {!hasResults && !query && activeFolderId === 'unfiled' && (
                <div className="dh-folder-empty" data-testid="home-unfiled-empty">
                  <p className="dh-folder-empty-title">Every diagram is in a folder</p>
                  <p className="dh-folder-empty-text">Diagrams you take out of a folder appear here.</p>
                </div>
              )}

              {hasResults && (
                <div className="dh-grid" data-testid="home-grid">
                  {visible.map((item) => (
                    <DiagramCard
                      key={item.id}
                      item={item}
                      onOpen={onOpen}
                      onFork={onForkItem}
                      folders={canMove ? folders : undefined}
                      currentTarget={move.targetOf(item)}
                      onMove={canMove ? (it, to) => void move.moveItem(it, to) : undefined}
                      onDragStart={move.startDrag}
                      onDragEnd={move.endDrag}
                      onRequestDelete={
                        onDeleteItem
                          ? (target, trigger) => {
                              deleteTriggerRef.current = trigger;
                              setDeleteTarget(target);
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {onDeleteItem && (
        <DeleteDiagramDialog
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async (item) => {
            await onDeleteItem(item.id);
            setDeleteTarget(null);
          }}
          returnFocusTo={deleteTriggerRef.current}
          onDeleted={() => headingRef.current?.focus()}
        />
      )}
    </div>
  );
}
