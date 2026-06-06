import { Dialog, DialogContent, Button } from '../../ui';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm(): void;
  tone?: 'default' | 'danger';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  tone = 'default',
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        {message && (
          <p className="text-[13px] text-onlight-muted">{message}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="subtle"
            surface="light"
            data-testid="confirm-cancel"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            surface="light"
            data-testid="confirm-ok"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
