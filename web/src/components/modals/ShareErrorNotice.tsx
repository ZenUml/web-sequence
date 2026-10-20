import { Dialog, DialogContent, Button } from '../../ui';

export interface ShareErrorNoticeProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  message?: string;
  onGoHome(): void;
}

// Shown when a shared link fails to load (REQ-SHR-4). Lets the user abandon the
// dead link and return to Diagrams.
export function ShareErrorNotice({
  open,
  onOpenChange,
  message,
  onGoHome,
}: ShareErrorNoticeProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="This shared link can't be opened"
        description={message ?? "The link may have been removed or is no longer available."}
      >
        {/* DialogContent doesn't forward data-testid, so anchor it on an inner wrapper. */}
        <div data-testid="share-error" className="flex justify-end">
          <Button
            data-testid="share-error-home"
            variant="primary"
            surface="dark"
            onClick={onGoHome}
          >
            Go to Diagrams
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
