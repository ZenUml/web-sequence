import { useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Folder, Item, Appearance } from '../../domain/types';
import { Tooltip } from '../../ui';
import { DiagramThumbnail } from './DiagramThumbnail';
import { CheckIcon, ForkIcon, MoveToFolderIcon, TrashIcon } from '../../ui/icons';

interface DiagramCardProps {
  item: Item;
  appearance?: Appearance;
  onOpen(item: Item): void;
  onFork?(item: Item): void;
  onRequestDelete?(item: Item, trigger: HTMLElement): void;
  /** Folders offered by drag and by the Move to folder menu. Empty = no move UI. */
  folders?: Folder[];
  /** Where the diagram is now: a folder id, or 'unfiled'. */
  currentTarget?: string;
  /** Move to a folder id, or null for Not in a folder. Completes at once. */
  onMove?(item: Item, folderId: string | null): void;
  onDragStart?(item: Item): void;
  onDragEnd?(): void;
}

export function formatEditedDate(updatedOn: number | undefined): string | null {
  if (!updatedOn) return null;
  return new Date(updatedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A saved diagram: the real rendered preview with the title/date "pocket" sleeved
// over its lower edge. The open button and the action buttons are siblings, so the
// actions never open the diagram and no interactive element is nested.
//
// When folders exist the card can be dragged onto a sidebar folder (drop moves it at
// once). Keyboard and touch users get the same result from the Move to folder menu:
// choosing a destination moves immediately, with no second confirmation.
export function DiagramCard({
  item,
  appearance = 'light',
  onOpen,
  onFork,
  onRequestDelete,
  folders = [],
  currentTarget = 'unfiled',
  onMove,
  onDragStart,
  onDragEnd,
}: DiagramCardProps) {
  const title = item.title || 'Untitled';
  const edited = formatEditedDate(item.updatedOn);
  const canMove = Boolean(onMove) && folders.length > 0;
  // A drag must never open the diagram, even if a browser fires click after drop.
  const draggedRef = useRef(false);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    draggedRef.current = true;
    e.dataTransfer.effectAllowed = 'move';
    // A private type only: dropping on a text field must not paste anything.
    e.dataTransfer.setData('application/x-zenuml-diagram', item.id);
    const ghost = document.createElement('div');
    ghost.className = 'dh-drag-ghost';
    const t = document.createElement('strong');
    t.textContent = title;
    const s = document.createElement('span');
    s.textContent = 'Drag onto a folder';
    ghost.append(t, s);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 24, 20);
    setTimeout(() => ghost.remove(), 0);
    onDragStart?.(item);
  }

  return (
    <div
      className="dh-card"
      data-testid={`home-card-${item.id}`}
      draggable={canMove || undefined}
      onDragStart={canMove ? handleDragStart : undefined}
      onDragEnd={
        canMove
          ? () => {
              onDragEnd?.();
              setTimeout(() => {
                draggedRef.current = false;
              }, 0);
            }
          : undefined
      }
    >
      <button
        type="button"
        className="dh-card-open"
        draggable={false}
        onClick={() => {
          if (draggedRef.current) return;
          onOpen(item);
        }}
        aria-label={`Open ${title}`}
      >
        <span className="dh-card-preview">
          <DiagramThumbnail item={item} />
        </span>
        <span className="dh-pocket">
          <span className="dh-card-title" title={title}>{title}</span>
          {edited && <span className="dh-card-date">{edited}</span>}
        </span>
      </button>
      {(onFork || onRequestDelete || canMove) && (
        <div className={canMove ? 'dh-card-actions dh-card-actions--three' : 'dh-card-actions'}>
          {canMove && onMove && (
            <DropdownMenu.Root modal={false}>
              <Tooltip surface={appearance} label="Move to folder">
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="dh-icon-button"
                    aria-label={`Move ${title} to folder`}
                    data-testid={`home-action-move-${item.id}`}
                  >
                    <MoveToFolderIcon />
                  </button>
                </DropdownMenu.Trigger>
              </Tooltip>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="dh-menu"
                  align="end"
                  sideOffset={6}
                  collisionPadding={8}
                  data-testid={`home-move-menu-${item.id}`}
                >
                  <DropdownMenu.Label className="dh-menu-label">Move to folder</DropdownMenu.Label>
                  {[{ id: 'unfiled', name: 'Not in a folder' }, ...folders].map((f) => {
                    const current = f.id === currentTarget;
                    return (
                      <DropdownMenu.Item
                        key={f.id}
                        className="dh-menu-item"
                        disabled={current}
                        data-testid={`home-move-to-${f.id}`}
                        onSelect={() => onMove(item, f.id === 'unfiled' ? null : f.id)}
                      >
                        <span className="dh-menu-item-label">{f.name}</span>
                        {current && (
                          <span className="dh-menu-current">
                            <CheckIcon />
                            <span className="sr-only">(current)</span>
                          </span>
                        )}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
          {onFork && (
            <Tooltip surface={appearance} label="Fork">
              <button
                type="button"
                className="dh-icon-button"
                aria-label={`Fork ${title}`}
                data-testid={`home-action-fork-${item.id}`}
                onClick={() => onFork(item)}
              >
                <ForkIcon />
              </button>
            </Tooltip>
          )}
          {onRequestDelete && (
            <Tooltip surface={appearance} label="Delete">
              <button
                type="button"
                className="dh-icon-button"
                aria-label={`Delete ${title}`}
                data-testid={`home-action-delete-${item.id}`}
                onClick={(e) => onRequestDelete(item, e.currentTarget)}
              >
                <TrashIcon />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
