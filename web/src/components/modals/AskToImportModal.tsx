import { Dialog, DialogContent, Button } from '../../ui';
import '../auth/account-flows.css';

export interface AskToImportModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  // Number of real local records (useImportOnLogin().count).
  count: number;
  // Import / retry. Closing is driven by the controlled `open`: the hook closes
  // the prompt only after the save AND the asked-flag write succeed.
  onImport(): void;
  // "Don't ask again", close button, Escape, overlay: persists the never-ask flag.
  onDismiss(): void;
  // Import (or dismissal) in flight: no second submission, no dismissal.
  busy?: boolean;
  // Inline failure from the last attempt; the import button becomes a retry.
  error?: string | null;
  // Which action failed (useImportOnLogin().failedAction). 'dismiss' keeps the
  // primary button on its normal action; retry the choice with Don't ask again.
  failedAction?: 'import' | 'dismiss' | null;
  // The local check failed (useImportOnLogin().checkError): the count is unknown.
  // The modal shows the failure instead of a count and its primary action
  // re-runs the check via onRetryCheck (never an import).
  checkError?: string | null;
  onRetryCheck?(): void;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function AskToImportModal({
  open,
  onOpenChange,
  count,
  onImport,
  onDismiss,
  busy = false,
  error = null,
  failedAction = null,
  checkError = null,
  onRetryCheck,
}: AskToImportModalProps) {
  const noun = plural(count, 'diagram', 'diagrams');
  const checkFailed = !!checkError;
  const importLabel = checkFailed
    ? busy ? 'Checking…' : 'Try again'
    : busy ? 'Importing…' : error && failedAction !== 'dismiss' ? 'Try again' : `Import ${count} ${noun}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) onOpenChange(true);
        else if (!busy) onDismiss();
      }}
    >
      <DialogContent
        bare
        className="af-dialog af-dialog--wide"
        titleClassName="af-title"
        closeClassName="af-close"
        closeDisabled={busy}
        restoreFocus
        focusContentOnOpen
        overlayClassName="af-overlay"
        describedBy={[checkFailed ? 'import-check-error' : 'import-local-lead', error ? 'import-error' : '']
          .filter(Boolean)
          .join(' ')}
        title="Import local diagrams?"
      >
        {checkFailed ? (
          <p
            id="import-check-error"
            className="af-lead af-note--error"
            data-testid="import-check-error"
            role="alert"
          >
            {checkError}
          </p>
        ) : (
          <>
            <p id="import-local-lead" className="af-lead" data-testid="import-lead">
              {count} {noun} {plural(count, 'is', 'are')} saved in this browser.
            </p>
            <p className="af-support">
              Add {plural(count, 'it', 'them')} to your account to access {plural(count, 'it', 'them')} on
              other devices.
            </p>
          </>
        )}
        {/* Shown in the check-failure state too: a failed "Don't ask again" must
            be visible even while the count is unknown. */}
        {error && (
          <p id="import-error" className="af-note af-note--error" data-testid="import-error" role="alert">
            {error}
          </p>
        )}
        <div className="af-actions">
          <Button
            variant="ghost"
            surface="light"
            className="af-btn af-btn--secondary"
            data-testid="import-dismiss"
            disabled={busy}
            // Do NOT also call onOpenChange(false): closing follows the controlled
            // `open` once the hook has persisted the choice.
            onClick={onDismiss}
          >
            Don't ask again
          </Button>
          <Button
            variant="primary"
            surface="light"
            className="af-btn af-btn--primary"
            data-testid="import-confirm"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={checkFailed ? onRetryCheck : onImport}
          >
            {importLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
