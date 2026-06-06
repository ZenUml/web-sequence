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
            // Closing is driven by the controlled `open` (the hook flips `pending`
            // in dismiss()/doImport()). Do NOT also call onOpenChange(false): that
            // routes through the Dialog handler to onDismiss and would set the
            // "don't ask again" flag BEFORE saveItems resolves — losing local
            // items if the import fails (review fix).
            onClick={onDismiss}
          >
            Don't ask again
          </Button>
          <Button
            variant="primary"
            surface="light"
            data-testid="import-confirm"
            onClick={onImport}
          >
            Import {count}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
