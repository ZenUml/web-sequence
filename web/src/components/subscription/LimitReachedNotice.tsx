import { Dialog, DialogContent, Button } from '../../ui';

// REQ-SUB-5 (softened): a non-blocking notice shown when a free user exceeds the
// saved-diagram limit. The diagram is still kept locally — this notice does NOT
// block editing; it nudges toward upgrading. Presentational only.
export interface LimitReachedNoticeProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  limit: number;
  onUpgrade(): void;
}

export function LimitReachedNotice({
  open,
  onOpenChange,
  limit,
  onUpgrade,
}: LimitReachedNoticeProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Saved on this device"
        description={`You've reached your ${limit}-diagram limit. Saved on this device.`}
      >
        <div data-testid="limit-notice" className="flex flex-col gap-3">
          <p className="text-[13px] text-ondark-muted">
            Upgrade to keep saving and syncing more diagrams to the cloud.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              surface="dark"
              data-testid="limit-dismiss"
              onClick={() => onOpenChange(false)}
            >
              Not now
            </Button>
            <Button
              variant="primary"
              surface="dark"
              data-testid="limit-upgrade"
              onClick={onUpgrade}
            >
              Upgrade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
