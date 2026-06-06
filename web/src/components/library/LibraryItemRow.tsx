import { useState } from 'react';
import type { Item, Folder } from '../../domain/types';
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  IconButton,
  cn,
} from '../../ui';
import { ConfirmDialog } from '../modals/ConfirmDialog';

export interface LibraryItemRowProps {
  item: Item;
  folders: Folder[];
  onOpen(item: Item): void;
  onFork(item: Item): void;
  onDelete(id: string): void;
  onMove(item: Item, folderId: string | null): void;
  onExportHtml(item: Item): void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function LibraryItemRow({
  item,
  folders,
  onOpen,
  onFork,
  onDelete,
  onMove,
  onExportHtml,
}: LibraryItemRowProps) {
  // confirming is hoisted to the row component (the ConfirmDialog is rendered
  // outside the clickable row element) so a portal confirm-click cannot bubble
  // up to the row's onClick → onOpen. Mirrors the M02 ItemListStub pattern.
  const [confirming, setConfirming] = useState(false);

  const currentFolder =
    item.folderId != null ? folders.find((f) => f.id === item.folderId) : undefined;

  return (
    <>
      <div
        data-testid={`lib-row-${item.id}`}
        role="button"
        tabIndex={0}
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2.5',
          'cursor-pointer hover:bg-white/5 focus:outline-none ring-draft',
          'border-b border-ink-line',
        )}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(item);
          }
        }}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-sans text-[13px] text-ondark-strong truncate">
            {item.title || 'Untitled'}
          </span>
          <span className="font-mono text-[11px] text-ondark-faint truncate">
            {item.updatedOn != null && formatDate(item.updatedOn)}
            {item.updatedOn != null && currentFolder && ' · '}
            {currentFolder && currentFolder.name}
          </span>
        </div>

        <Menu>
          <MenuTrigger asChild>
            <IconButton
              aria-label="Item actions"
              data-testid={`lib-row-menu-${item.id}`}
              size="sm"
              surface="dark"
              onClick={(e) => e.stopPropagation()}
              // Radix's Trigger keydown handler preventDefaults but does NOT
              // stopPropagation, so Enter/Space on the kebab would bubble to the
              // row's onKeyDown → onOpen, unmounting the panel before the menu can
              // render — making the actions menu unreachable by keyboard. Stop the
              // keydown here (mirrors onClick); stopPropagation ≠ preventDefault, so
              // Radix still opens the menu on the same element.
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Vertical kebab icon — inline SVG, no extra dep. */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="7" cy="3" r="1.25" />
                <circle cx="7" cy="7" r="1.25" />
                <circle cx="7" cy="11" r="1.25" />
              </svg>
            </IconButton>
          </MenuTrigger>
          {/* MenuContent is portaled but remains a React child of this row, so its
              events bubble through the React tree to the row's onClick/onKeyDown →
              onOpen. Stop BOTH twins: click for mouse activation, keydown because Radix
              MenuItem does not stopPropagation on Enter/Space, so keyboard-activating an
              action (e.g. Fork) would also fire the row's onOpen(item) — clobbering the
              fork by re-opening the original (adversarial review). */}
          <MenuContent
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MenuItem
              data-testid={`lib-action-open-${item.id}`}
              onSelect={() => onOpen(item)}
            >
              Open
            </MenuItem>
            <MenuItem
              data-testid={`lib-action-fork-${item.id}`}
              onSelect={() => onFork(item)}
            >
              Fork
            </MenuItem>
            <MenuItem
              data-testid={`lib-action-exporthtml-${item.id}`}
              onSelect={() => onExportHtml(item)}
            >
              Export HTML
            </MenuItem>

            <MenuSeparator />
            <MenuLabel>Move to folder</MenuLabel>
            {folders.map((folder) => (
              <MenuItem
                key={folder.id}
                data-testid={`lib-move-${item.id}-${folder.id}`}
                onSelect={() => onMove(item, folder.id)}
              >
                {folder.name}
              </MenuItem>
            ))}
            <MenuItem
              data-testid={`lib-move-${item.id}-unfiled`}
              onSelect={() => onMove(item, null)}
            >
              Unfiled
            </MenuItem>

            <MenuSeparator />
            <MenuItem
              data-testid={`lib-action-delete-${item.id}`}
              className="data-[highlighted]:bg-danger/20 data-[highlighted]:text-onlight-strong text-danger"
              onSelect={() => setConfirming(true)}
            >
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {/* Rendered outside the clickable row so a portal confirm-click cannot
          bubble to the row's onClick → onOpen. */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => {
          if (!o) setConfirming(false);
        }}
        title="Delete this diagram?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => onDelete(item.id)}
      />
    </>
  );
}
