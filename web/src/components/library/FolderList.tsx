import { useRef, useState } from 'react';
import type { Folder } from '../../domain/types';
import { IconButton, TextInput, cn } from '../../ui';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export interface FolderListProps {
  folders: Folder[];
  activeFolderId: string | null | 'unfiled';
  counts: Record<string, number>;
  onSelectFolder(id: string | null | 'unfiled'): void;
  onCreate(name: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  readOnly?: boolean;
}

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M2.5 3.5h9M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Presentational folder navigation for the library panel (rendered on ink).
// Handlers are injected so the component stays testable and store-free.
export function FolderList({
  folders,
  activeFolderId,
  counts,
  onSelectFolder,
  onCreate,
  onRename,
  onDelete,
  readOnly = false,
}: FolderListProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Escape sets this so the subsequent (or unmount-driven) blur is a no-op.
  const cancelledRef = useRef(false);

  function commitCreate() {
    const name = newName.trim();
    if (name) onCreate(name);
    setCreating(false);
    setNewName('');
  }

  function startRename(folder: Folder) {
    if (readOnly) return;
    cancelledRef.current = false;
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  }

  function commitRename() {
    if (cancelledRef.current) return;
    const id = renamingId;
    if (!id) return;
    const name = renameValue.trim();
    if (name) onRename(id, name);
    setRenamingId(null);
    setRenameValue('');
  }

  function cancelRename() {
    cancelledRef.current = true;
    setRenamingId(null);
    setRenameValue('');
  }

  const entryBase =
    'group flex items-center gap-2 w-full rounded px-2 h-8 text-[13px] text-left ' +
    'transition-colors duration-150 ease-draft ring-draft';

  function entryClass(active: boolean) {
    return cn(
      entryBase,
      active
        ? 'bg-accent-soft text-ondark-strong border-l-2 border-accent'
        : 'text-ondark-muted hover:text-ondark-strong hover:bg-white/5 border-l-2 border-transparent',
    );
  }

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Folders">
      <button
        type="button"
        data-testid="folder-all"
        className={entryClass(activeFolderId === null)}
        onClick={() => onSelectFolder(null)}
      >
        <span className="flex-1 truncate">All</span>
        <span className="font-mono text-[11px] text-ondark-faint">{counts['all'] ?? 0}</span>
      </button>

      <button
        type="button"
        data-testid="folder-unfiled"
        className={entryClass(activeFolderId === 'unfiled')}
        onClick={() => onSelectFolder('unfiled')}
      >
        <span className="flex-1 truncate">Unfiled</span>
        <span className="font-mono text-[11px] text-ondark-faint">{counts['unfiled'] ?? 0}</span>
      </button>

      {folders.map((folder) => {
        const active = activeFolderId === folder.id;
        const isRenaming = renamingId === folder.id;
        return (
          <div
            key={folder.id}
            data-testid={`folder-${folder.id}`}
            className={entryClass(active)}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!isRenaming) onSelectFolder(folder.id);
            }}
            onKeyDown={(e) => {
              if (isRenaming) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectFolder(folder.id);
              } else if (e.key === 'F2' && !readOnly) {
                // Keyboard rename affordance — onDoubleClick is mouse-only, leaving
                // keyboard/AT users with no path to rename (Delete is reachable via the
                // focusable IconButton). F2 mirrors the platform rename convention and
                // adds no nested interactive element (adversarial review).
                e.preventDefault();
                startRename(folder);
              }
            }}
          >
            {isRenaming ? (
              <TextInput
                autoFocus
                data-testid={`folder-rename-${folder.id}`}
                aria-label="Rename folder"
                className="flex-1 h-6"
                value={renameValue}
                onChange={(e) => setRenameValue(e.currentTarget.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={commitRename}
              />
            ) : (
              <span
                className="flex-1 truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(folder);
                }}
              >
                {folder.name}
              </span>
            )}

            {!isRenaming && (
              <span className="font-mono text-[11px] text-ondark-faint">
                {counts[folder.id] ?? 0}
              </span>
            )}

            {!readOnly && !isRenaming && (
              <IconButton
                size="sm"
                aria-label={`Delete folder ${folder.name}`}
                data-testid={`folder-delete-${folder.id}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(folder.id);
                }}
                // Stop the keydown from bubbling to the parent row's onKeyDown, which
                // preventDefault()s Enter/Space and selects the folder — swallowing the
                // button's own activation so the delete confirm never opens. Mirrors the
                // kebab fix in LibraryItemRow.tsx (adversarial review).
                onKeyDown={(e) => e.stopPropagation()}
              >
                <TrashIcon />
              </IconButton>
            )}
          </div>
        );
      })}

      {!readOnly &&
        (creating ? (
          <TextInput
            autoFocus
            data-testid="folder-new-input"
            aria-label="New folder name"
            className="mt-1 h-7"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitCreate();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setCreating(false);
                setNewName('');
              }
            }}
            onBlur={() => {
              setCreating(false);
              setNewName('');
            }}
          />
        ) : (
          <IconButton
            size="sm"
            aria-label="New folder"
            data-testid="folder-new"
            className="mt-1 self-start"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </IconButton>
        ))}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Delete folder?"
        message="Items move to Unfiled."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
        }}
      />
    </nav>
  );
}
