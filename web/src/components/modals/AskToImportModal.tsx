import { Dialog, DialogContent, Button } from '../../ui';

export interface AskToImportModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  count: number;
  onImport(): void;
  onDismiss(): void;
}

export function AskToImportModal({
  open,
  onOpenChange,
  count,
  onImport,
  onDismiss,
}: AskToImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); else onOpenChange(true); }}>
      <DialogContent
        title="Import your local diagrams?"
        description={`We found ${count} diagram(s) saved on this device. Import them to your account?`}
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="subtle"
            surface="light"
            data-testid="import-dismiss"
            onClick={() => { onDismiss(); onOpenChange(false); }}
          >
            Don't ask again
          </Button>
          <Button
            variant="primary"
            surface="light"
            data-testid="import-confirm"
            onClick={() => { onImport(); onOpenChange(false); }}
          >
            Import {count}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
