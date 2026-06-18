import { Dialog, DialogContent, Button } from '../../ui';

export interface OnboardingModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  onDismiss(): void;
}

// First-run welcome (REQ-MOD-3). Presentational only — the trigger/flag logic
// (open on boot when !onboarded, mark onboarded on dismiss) is wired in Task 16.
// Closing is driven by the controlled `open` prop; the "Get started" button and
// the Dialog's dismiss both route to onDismiss (the integrator flips `open`).
export function OnboardingModal({ open, onOpenChange, onDismiss }: OnboardingModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onDismiss();
        else onOpenChange(true);
      }}
    >
      <DialogContent
        title="Welcome to ZenUML"
        description="Turn plain text into clean UML sequence diagrams — no dragging, no fiddling."
      >
        <div className="space-y-4" data-testid="onboarding-modal">
          <p className="text-[13px] leading-relaxed text-ondark-muted">
            Write a few lines of the ZenUML DSL on the left and watch the diagram
            render live on the right. Describe who talks to whom:
          </p>
          <pre className="rounded border border-ink-line bg-ink-900 p-3 font-mono text-[12px] leading-relaxed text-ondark-strong">
            {'Alice -> Bob: Hello\nBob -> Alice: Hi back'}
          </pre>
          <p className="text-[13px] leading-relaxed text-ondark-muted">
            Add return messages, nesting, alt/loop fragments and more as you go.
          </p>
          <div className="flex justify-end">
            <Button
              variant="primary"
              surface="dark"
              data-testid="onboarding-get-started"
              onClick={onDismiss}
            >
              Get started
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
