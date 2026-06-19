import { Dialog, DialogContent, Button } from 'web-sequence-web';

// Modal shell over Radix Dialog on the dark ink surface. Rendered open (`defaultOpen`)
// so the card shows the lifted dialog; compose DialogContent with a title, optional
// description, and your own footer actions. (Ported from the app's ConfirmDialog.)
export function ConfirmDestructive() {
  return (
    <Dialog defaultOpen>
      <DialogContent
        title="Delete diagram?"
        description="“Order processing flow” will be permanently removed. This cannot be undone."
      >
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="subtle">Cancel</Button>
          <Button variant="danger">Delete diagram</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
