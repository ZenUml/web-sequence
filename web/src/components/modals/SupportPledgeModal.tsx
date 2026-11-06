import { Dialog, DialogContent, Button, buttonClassName } from '../../ui';

export interface SupportPledgeModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  version: string;
  onDismiss(): void;
}

// Version-upgrade pledge (REQ-MOD-3). Presentational only — the semver-compare
// trigger (open when lastSeenVersion is behind the current version) and the
// mark-seen/update-lastSeenVersion bookkeeping are wired in Task 16. Closing is
// driven by the controlled `open` prop; both the button and the Dialog dismiss
// route to onDismiss.
export function SupportPledgeModal({
  open,
  onOpenChange,
  version,
  onDismiss,
}: SupportPledgeModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onDismiss();
        else onOpenChange(true);
      }}
    >
      <DialogContent
        title={`ZenUML is now v${version}`}
        description="Thanks for using ZenUML — it stays free and open thanks to people like you."
      >
        <div className="space-y-4" data-testid="pledge-modal">
          <p className="text-[13px] leading-relaxed text-ondark-muted">
            We just shipped a new version. If ZenUML saves you time, consider
            supporting the project so we can keep building it.
          </p>
          <div className="flex justify-end gap-2">
            {/* Semantically an anchor — styled as a button via the shared class
                helper so we do NOT nest a <button> inside the <a> (invalid HTML /
                a11y defect: ambiguous focus + activation). */}
            <a
              href="https://github.com/sponsors/ZenUml"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="pledge-sponsor"
              className={buttonClassName({ variant: 'subtle', surface: 'light' })}
            >
              Sponsor
            </a>
            <Button
              variant="primary"
              surface="dark"
              data-testid="pledge-dismiss"
              onClick={onDismiss}
            >
              Keep going
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
