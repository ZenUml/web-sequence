import { Dialog, DialogContent, Button } from '../../ui';
import '../auth/account-flows.css';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm(): void;
  tone?: 'default' | 'danger';
  // 'ink' (default) is the dark serif shell used by the library and page menus.
  // 'light' is the account-flows look shared with "Saved on this device" and the
  // import prompt, for dialogs the user meets in the editor's save flow (#952).
  look?: 'ink' | 'light';
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
  look = 'ink',
}: ConfirmDialogProps) {
  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  if (look === 'light') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          bare
          className="af-dialog"
          titleClassName="af-title"
          closeClassName="af-close"
          overlayClassName="af-overlay"
          describedBy={message ? 'confirm-dialog-message' : undefined}
          title={title}
        >
          {message && (
            <p id="confirm-dialog-message" className="af-lead">
              {message}
            </p>
          )}
          <div className="af-actions">
            <Button
              variant="ghost"
              surface="light"
              className="af-btn af-btn--secondary"
              data-testid="confirm-cancel"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              surface="light"
              className={tone === 'danger' ? 'af-btn af-btn--danger' : 'af-btn af-btn--primary'}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        {message && (
          <p className="text-[13px] text-ondark-muted">{message}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="subtle"
            surface="dark"
            data-testid="confirm-cancel"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            surface="dark"
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
