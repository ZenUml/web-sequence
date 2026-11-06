import { Dialog, DialogContent, Button } from '../../ui';
import '../auth/account-flows.css';

export interface SavedOnDeviceModalProps {
  open: boolean;
  // false on "Not now", the close button, Escape or an outside click. The parent
  // has already recorded the one-time acknowledgement before opening, so closing
  // needs no further write and the prompt does not return.
  onOpenChange(o: boolean): void;
  // "Sign in": the modal closes first, then the parent opens the sign-in modal.
  onSignIn(): void;
}

// Shown after the first successful save while signed out. States only what is
// true: the diagram is in this browser. It makes no cloud-saved claim.
export function SavedOnDeviceModal({ open, onOpenChange, onSignIn }: SavedOnDeviceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        bare
        className="af-dialog af-dialog--wide"
        titleClassName="af-title"
        closeClassName="af-close"
        restoreFocus
        focusContentOnOpen
        overlayClassName="af-overlay"
        describedBy="saved-on-device-lead"
        title="Saved on this device"
      >
        <p id="saved-on-device-lead" className="af-lead">
          Your diagram is saved in this browser.
        </p>
        <p className="af-support">Sign in to save and sync across devices.</p>
        <div className="af-actions">
          {/* Test ids mirror ConfirmDialog, which this modal replaces at the same
              AppRoot mount (existing E2E dismisses the notice via confirm-cancel). */}
          <Button
            variant="ghost"
            surface="light"
            className="af-btn af-btn--secondary"
            data-testid="confirm-cancel"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            variant="primary"
            surface="light"
            className="af-btn af-btn--primary"
            data-testid="confirm-ok"
            onClick={() => {
              onOpenChange(false);
              onSignIn();
            }}
          >
            Sign in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
