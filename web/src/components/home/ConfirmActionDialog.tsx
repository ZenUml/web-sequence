import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';

export interface ConfirmActionDialogProps {
  open: boolean;
  title: ReactNode;
  /** Body content between the title and the buttons. */
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  errorText: string;
  onCancel(): void;
  /** Runs the action. Resolves on success; rejects to keep the dialog open for retry. */
  onConfirm(): Promise<void>;
  /** The control that opened the dialog; focus returns to it on cancel. */
  returnFocusTo?: HTMLElement | null;
  /** Where focus goes after success (the trigger is usually gone). */
  onDone?(): void;
  /** Prefix for data-testid: `<prefix>-dialog`, `-cancel`, `-confirm`, `-error`. */
  testId: string;
}

// Shared destructive confirmation for the Diagrams page (diagram delete, folder
// delete). Initial focus is Cancel and Escape cancels; focus returns to the trigger.
// The action runs only from the explicit confirm button. While it is pending the
// dialog cannot be dismissed or submitted twice; a failure keeps the dialog open
// with a short inline message so the user can retry.
export function ConfirmActionDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  errorText,
  onCancel,
  onConfirm,
  returnFocusTo,
  onDone,
  testId,
}: ConfirmActionDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (open) {
      doneRef.current = false;
      pendingRef.current = false;
      setError(false);
      setPending(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(false);
    try {
      await onConfirm();
      doneRef.current = true;
    } catch {
      setError(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pendingRef.current) onCancel();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dh-dialog-overlay" />
        <div className="dh-dialog-center">
          <RadixDialog.Content
            className="dh-dialog"
            data-testid={`${testId}-dialog`}
            aria-busy={pending}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              cancelRef.current?.focus();
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              if (doneRef.current) onDone?.();
              else returnFocusTo?.focus();
            }}
            onEscapeKeyDown={(e) => {
              if (pendingRef.current) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              if (pendingRef.current) e.preventDefault();
            }}
          >
            <RadixDialog.Title className="dh-dialog-title">{title}</RadixDialog.Title>
            {children}
            {error && (
              <p className="dh-dialog-error" role="alert" data-testid={`${testId}-error`}>
                {errorText}
              </p>
            )}
            <div className="dh-dialog-actions">
              <button
                ref={cancelRef}
                type="button"
                className="dh-button dh-button--secondary"
                data-testid={`${testId}-cancel`}
                disabled={pending}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dh-button dh-button--danger"
                data-testid={`${testId}-confirm`}
                aria-disabled={pending}
                onClick={() => void handleConfirm()}
              >
                {pending ? pendingLabel : confirmLabel}
              </button>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
