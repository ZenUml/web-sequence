import { useRef, useState, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import type { Folder } from '../../domain/types';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { ExportIcon, ImportIcon, PencilIcon, TrashIcon } from './icons';

export type FolderFilter = string | null | 'unfiled';

/** A diagram being dragged over the sidebar. */
export interface SidebarDrag {
  title: string;
  /** The sidebar target the diagram is in now: a folder id or 'unfiled'. */
  currentTarget: string;
}

export interface HomeSidebarProps {
  folders: Folder[];
  activeFolderId: FolderFilter;
  counts: Record<string, number>;
  onSelectFolder(id: FolderFilter): void;
  /** Persist a new folder. Reject to keep the typed name and offer Try again. */
  onCreate(name: string): Promise<void> | void;
  /** Persist a rename. Reject to keep the typed name and offer Try again. */
  onRename(id: string, name: string): Promise<void> | void;
  /** Delete the folder only; its diagrams stay and show under Not in a folder. */
  onDelete(id: string): Promise<void> | void;
  readOnly?: boolean;
  onExportAll?(): void;
  /** Legacy import: receives the file text. */
  onImport?(text: string): void;
  /** Preferred import: receives the picked file. Pending until it settles. */
  onImportFile?(file: File): Promise<void>;
  /** An import is running elsewhere (e.g. the central import controller). */
  importPending?: boolean;
  /** Legacy path only: the picked file could not be read. */
  onImportError?(error: unknown): void;
  /** Extra tool rendered last in the Library tools group (Report a bug). */
  reportBug?: ReactNode;
  // Drag a diagram onto a folder (HomeView owns the drag state).
  drag?: SidebarDrag | null;
  dropTarget?: string | null;
  onDragOverTarget?(target: string): void;
  onDropOnTarget?(target: string): void;
  /** Move result / Undo panel, shown under the folders. */
  status?: ReactNode;
}

type Edit = { mode: 'create' } | { mode: 'rename'; id: string; original: string };

// Diagrams sidebar (Figma F48 folder states). All diagrams / Not in a folder /
// Folders with one "New folder" entry. Create and rename are inline: Enter commits,
// Esc cancels, a blank name does nothing. While a write is pending the input is
// read-only and Enter is ignored, so a name is never written twice. A failed write
// keeps the typed name and offers Try again. Clicking away cancels a create and
// commits a rename (the existing rename behaviour). Folder rows are drop targets for
// dragged diagrams. Library tools sit at the bottom. On narrow screens the same markup
// becomes a horizontally scrolling strip (home.css) so every control stays reachable.
export function HomeSidebar({
  folders,
  activeFolderId,
  counts,
  onSelectFolder,
  onCreate,
  onRename,
  onDelete,
  readOnly = false,
  onExportAll,
  onImport,
  onImportFile,
  importPending = false,
  onImportError,
  reportBug,
  drag = null,
  dropTarget = null,
  onDragOverTarget,
  onDropOnTarget,
  status,
}: HomeSidebarProps) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const pendingRef = useRef(false);
  const editRef = useRef<HTMLDivElement>(null);
  const newFolderRef = useRef<HTMLButtonElement>(null);

  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const unfiledRef = useRef<HTMLButtonElement>(null);

  const lastPointerRef = useRef<string>('mouse');
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const importBusy = importPending || reading;

  // A pending create/rename owns the edit (its name, error and retry) until it
  // settles. Blur from the rename input starts the save before this click arrives.
  function startCreate() {
    if (pendingRef.current) return;
    setEdit({ mode: 'create' });
    setValue('');
    setFailed(false);
  }

  function startRename(folder: Folder) {
    if (readOnly || pendingRef.current) return;
    setEdit({ mode: 'rename', id: folder.id, original: folder.name });
    setValue(folder.name);
    setFailed(false);
  }

  function close() {
    const wasCreate = edit?.mode === 'create';
    const renamedId = edit?.mode === 'rename' ? edit.id : null;
    setEdit(null);
    setValue('');
    setFailed(false);
    // Keep keyboard users in place after the input disappears.
    // Only when focus was lost with the input: never pull it out of a control the
    // user reached meanwhile (for example a New folder input opened right after).
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (wasCreate) newFolderRef.current?.focus();
      else if (renamedId) document.querySelector<HTMLElement>(`[data-testid="folder-${renamedId}"]`)?.focus();
    });
  }

  function cancel() {
    if (pendingRef.current) return;
    close();
  }

  async function submit() {
    if (!edit || pendingRef.current) return;
    const name = value.trim();
    if (!name) return; // blank does nothing
    if (edit.mode === 'rename' && name === edit.original) {
      close();
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setFailed(false);
    try {
      if (edit.mode === 'create') await onCreate(name);
      else await onRename(edit.id, name);
      close();
    } catch {
      setFailed(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  // Focus left the input. Ignore moves into the edit panel (Try again / Cancel).
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && editRef.current?.contains(next)) return;
    if (pendingRef.current || failed || !edit) return;
    if (edit.mode === 'create') close();
    else if (value.trim()) void submit();
    else close();
  }

  function editPanel() {
    if (!edit) return null;
    const isCreate = edit.mode === 'create';
    const testId = isCreate ? 'folder-new-input' : `folder-rename-${edit.id}`;
    return (
      <div ref={editRef} className="dh-folder-edit" data-testid="folder-edit">
        <input
          autoFocus
          className="dh-nav-input"
          data-testid={testId}
          aria-label={isCreate ? 'New folder name' : 'Rename folder'}
          aria-describedby="dh-folder-edit-hint"
          aria-invalid={failed || undefined}
          aria-busy={pending || undefined}
          readOnly={pending}
          value={value}
          onChange={(e) => {
            setValue(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
          onBlur={handleBlur}
        />
        {failed ? (
          <div className="dh-folder-error" role="alert" data-testid="folder-edit-error">
            <p className="dh-folder-error-title">
              {isCreate ? 'Couldn’t create this folder' : 'Couldn’t rename this folder'}
            </p>
            <p className="dh-folder-error-text">Check your connection and try again.</p>
            <p className="dh-folder-hint" id="dh-folder-edit-hint">Your folder name is kept.</p>
            <div className="dh-folder-error-actions">
              <button type="button" className="dh-button dh-button--secondary dh-button--small" data-testid="folder-edit-cancel" onClick={cancel}>
                Cancel
              </button>
              <button
                type="button"
                className="dh-button dh-button--primary dh-button--small"
                data-testid="folder-edit-retry"
                aria-disabled={pending || undefined}
                onClick={() => void submit()}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <p className="dh-folder-hint" id="dh-folder-edit-hint" aria-live="polite">
            {pending
              ? isCreate
                ? 'Creating…'
                : 'Saving…'
              : isCreate
                ? 'Enter to create · Esc to cancel'
                : 'Enter to rename · Esc to cancel'}
          </p>
        )}
      </div>
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Reset so picking the same file again still fires change.
    input.value = '';
    if (!file || importBusy) return; // cancelled picker, or an import is already running
    setReading(true);
    try {
      if (onImportFile) {
        await onImportFile(file);
      } else if (onImport) {
        let text: string;
        try {
          text = await file.text();
        } catch (err) {
          onImportError?.(err);
          return;
        }
        onImport(text);
      }
    } catch {
      // onImportFile owns its own feedback; never leave an unhandled rejection.
    } finally {
      setReading(false);
    }
  }

  // Drop-target props for a sidebar row. Only rows other than the dragged diagram's
  // current place accept the drop.
  function dropProps(target: string) {
    if (!drag || drag.currentTarget === target) return {};
    const accept = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTarget !== target) onDragOverTarget?.(target);
    };
    return {
      // Marks the row for the drag controller: entering anything without this
      // attribute clears the highlight (dragleave is unreliable: it also fires when
      // the pointer moves onto the row's own label).
      'data-drop-target': target,
      // Accept on enter as well as over: a browser may deliver only dragenter for
      // the final pointer position before the drop.
      onDragEnter: accept,
      onDragOver: accept,
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        onDropOnTarget?.(target);
      },
    };
  }

  const rowClass = (active: boolean, target: string) =>
    [
      'dh-nav-item',
      active && 'is-active',
      drag && drag.currentTarget !== target && 'is-droppable',
      dropTarget === target && 'is-drop-target',
    ]
      .filter(Boolean)
      .join(' ');

  const dropBadge = (target: string) =>
    dropTarget === target ? (
      <span className="dh-drop-badge" aria-hidden="true">
        +1
      </span>
    ) : null;

  const deleteCount = deleteFolder ? counts[deleteFolder.id] ?? 0 : 0;
  const hasTools = Boolean(onExportAll && (onImport || onImportFile)) || Boolean(reportBug);

  return (
    <aside
      className={['dh-sidebar', edit && 'is-editing', drag && 'is-dragging'].filter(Boolean).join(' ')}
      data-testid="home-sidebar"
    >
      <nav className="dh-nav" aria-label="Folders">
        <button
          type="button"
          data-testid="folder-all"
          className={rowClass(activeFolderId === null, '__all')}
          aria-current={activeFolderId === null ? 'page' : undefined}
          onClick={() => onSelectFolder(null)}
        >
          <span className="dh-nav-label">All diagrams</span>
          <span className="dh-nav-count">{counts.all ?? 0}</span>
        </button>
        <button
          ref={unfiledRef}
          type="button"
          data-testid="folder-unfiled"
          className={rowClass(activeFolderId === 'unfiled', 'unfiled')}
          aria-current={activeFolderId === 'unfiled' ? 'page' : undefined}
          onClick={() => onSelectFolder('unfiled')}
          {...dropProps('unfiled')}
        >
          <span className="dh-nav-label">Not in a folder</span>
          {dropBadge('unfiled') ?? <span className="dh-nav-count">{counts.unfiled ?? 0}</span>}
        </button>

        {(folders.length > 0 || !readOnly) && (
          <div className="dh-nav-heading" aria-hidden="true">Folders</div>
        )}

        {folders.map((folder) => {
          const active = activeFolderId === folder.id;
          if (edit?.mode === 'rename' && edit.id === folder.id) {
            return (
              <div key={folder.id} className="dh-nav-row dh-nav-row--editing">
                {editPanel()}
              </div>
            );
          }
          return (
            <div key={folder.id} className={active ? 'dh-nav-row is-active' : 'dh-nav-row'}>
              <button
                type="button"
                data-testid={`folder-${folder.id}`}
                className={rowClass(active, folder.id)}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  onSelectFolder(folder.id);
                  // On the narrow strip, bring the folder's Rename/Delete into view.
                  const row = e.currentTarget.parentElement;
                  requestAnimationFrame(() => row?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
                }}
                onPointerDown={(e) => {
                  lastPointerRef.current = e.pointerType;
                }}
                // Double-click renames with a mouse or pen. Touch uses the visible
                // Rename button: taps in quick succession must not open the editor.
                onDoubleClick={() => {
                  if (lastPointerRef.current !== 'touch') startRename(folder);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'F2' && !readOnly) {
                    e.preventDefault();
                    startRename(folder);
                  }
                }}
                {...dropProps(folder.id)}
              >
                <span className="dh-nav-label">{folder.name}</span>
                {dropBadge(folder.id) ?? <span className="dh-nav-count">{counts[folder.id] ?? 0}</span>}
              </button>
              {!readOnly && !drag && (
                <span className="dh-nav-actions">
                  <button
                    type="button"
                    className="dh-nav-action"
                    aria-label={`Rename folder ${folder.name}`}
                    data-testid={`folder-rename-button-${folder.id}`}
                    onClick={() => startRename(folder)}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    className="dh-nav-action dh-nav-action--danger"
                    aria-label={`Delete folder ${folder.name}`}
                    data-testid={`folder-delete-${folder.id}`}
                    onClick={(e) => {
                      deleteTriggerRef.current = e.currentTarget;
                      setDeleteFolder(folder);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </span>
              )}
            </div>
          );
        })}

        {!readOnly &&
          (edit?.mode === 'create' ? (
            editPanel()
          ) : (
            <button
              ref={newFolderRef}
              type="button"
              className="dh-new-folder"
              data-testid="folder-new"
              aria-disabled={pending || undefined}
              onClick={startCreate}
            >
              <span aria-hidden="true">+</span>
              New folder
            </button>
          ))}

        {drag && (
          <p className="dh-drag-hint" data-testid="folder-drag-hint">
            Drop to move · Esc to cancel
          </p>
        )}
      </nav>

      {status}

      {hasTools && (
        <div className="dh-tools" role="group" aria-label="Library tools">
          <div className="dh-nav-heading" aria-hidden="true">Library tools</div>
          {onExportAll && (onImport || onImportFile) && (
            <>
              <button
                type="button"
                className="dh-tool"
                data-testid="lib-import"
                aria-disabled={importBusy || undefined}
                aria-busy={importBusy || undefined}
                onClick={() => {
                  if (!importBusy) fileRef.current?.click();
                }}
              >
                <ImportIcon />
                {importBusy ? 'Importing…' : 'Import diagrams'}
              </button>
              <button type="button" className="dh-tool" data-testid="lib-export-all" onClick={onExportAll}>
                <ExportIcon />
                Export all
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                data-testid="lib-import-input"
                className="hidden"
                tabIndex={-1}
                onChange={(e) => void handleFile(e)}
              />
            </>
          )}
          {reportBug && <div className="dh-tool-slot">{reportBug}</div>}
        </div>
      )}

      <ConfirmActionDialog
        open={deleteFolder !== null}
        title={deleteFolder ? `Delete “${deleteFolder.name}”?` : ''}
        confirmLabel="Delete folder"
        pendingLabel="Deleting…"
        errorText="Couldn’t delete this folder. Check your connection and try again."
        onCancel={() => setDeleteFolder(null)}
        onConfirm={async () => {
          if (!deleteFolder) return;
          const id = deleteFolder.id;
          await onDelete(id);
          setDeleteFolder(null);
          if (activeFolderId === id) onSelectFolder('unfiled');
        }}
        returnFocusTo={deleteTriggerRef.current}
        onDone={() => unfiledRef.current?.focus()}
        testId="folder-delete"
      >
        <RadixDialog.Description asChild>
          <div className="dh-dialog-body" data-testid="folder-delete-message">
            <p className="dh-dialog-text">
              {deleteCount === 0
                ? 'The folder is empty.'
                : `The folder contains ${deleteCount} ${deleteCount === 1 ? 'diagram' : 'diagrams'}.`}
            </p>
            {deleteCount > 0 && (
              <p className="dh-dialog-message">
                Your diagrams will be kept and moved to <strong className="dh-dialog-strong">Not in a folder</strong>.
              </p>
            )}
          </div>
        </RadixDialog.Description>
      </ConfirmActionDialog>
    </aside>
  );
}
