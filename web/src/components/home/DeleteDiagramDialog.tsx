import * as RadixDialog from '@radix-ui/react-dialog';
import type { Item } from '../../domain/types';
import { ConfirmActionDialog } from './ConfirmActionDialog';

export interface DeleteDiagramDialogProps {
  /** The diagram awaiting confirmation; null keeps the dialog closed. */
  item: Item | null;
  onCancel(): void;
  /** Deletes the diagram. Resolves on success; rejects to keep the dialog open. */
  onConfirm(item: Item): Promise<void>;
  /** The control that opened the dialog; focus returns to it on cancel. */
  returnFocusTo?: HTMLElement | null;
  /** Where focus goes after a successful delete (the trash button is gone). */
  onDeleted?(): void;
}

// Delete confirmation (Figma 36:7812). Behaviour lives in ConfirmActionDialog:
// Cancel focused first, Escape cancels, no dismissal or double submit while pending,
// failure keeps the dialog and the diagram for retry.
export function DeleteDiagramDialog({ item, onCancel, onConfirm, returnFocusTo, onDeleted }: DeleteDiagramDialogProps) {
  const title = item ? item.title || 'Untitled' : '';
  return (
    <ConfirmActionDialog
      open={item !== null}
      title="Delete this diagram?"
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      errorText="Could not delete this diagram. Please try again."
      onCancel={onCancel}
      onConfirm={() => (item ? onConfirm(item) : Promise.resolve())}
      returnFocusTo={returnFocusTo}
      onDone={onDeleted}
      testId="home-delete"
    >
      <p className="dh-dialog-name" data-testid="home-delete-name">{title}</p>
      <RadixDialog.Description className="dh-dialog-message">This action cannot be undone.</RadixDialog.Description>
    </ConfirmActionDialog>
  );
}
