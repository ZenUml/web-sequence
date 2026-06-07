import type { Item } from '../../domain/types';
import { TEMPLATES, blankTemplate } from '../../domain/templates';
import { Dialog, DialogContent, cn } from '../../ui';

export interface CreateNewModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  onSelect(item: Partial<Item>): void;
}

// Presentational "Create New" picker (REQ-MOD-4). Offers a blank diagram plus
// one card per curated template. Selecting an option fires onSelect with the
// chosen starter content and closes the modal. DESIGN SYSTEM: paper surface via
// DialogContent; no raw colors/fonts.
export function CreateNewModal({ open, onOpenChange, onSelect }: CreateNewModalProps) {
  function choose(item: Partial<Item>) {
    onSelect(item);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create a new diagram"
        description="Start from scratch or pick a styled template."
        className="w-[min(560px,calc(100vw-2rem))]"
      >
        <div data-testid="create-new-modal" className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="create-blank"
            onClick={() => choose(blankTemplate())}
            className={cn(
              'flex flex-col items-start rounded-md border border-paper-line bg-paper-50',
              'p-4 text-left transition hover:border-accent hover:shadow-pop',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <span className="font-serif text-[17px] text-onlight-strong">Blank diagram</span>
            <span className="mt-1 text-[12px] text-onlight-muted">Start with an empty canvas.</span>
          </button>

          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`create-template-${t.id}`}
              onClick={() => choose(t.item)}
              className={cn(
                'flex flex-col items-start rounded-md border border-paper-line bg-paper-50',
                'p-4 text-left transition hover:border-accent hover:shadow-pop',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            >
              <span className="font-serif text-[17px] text-onlight-strong">{t.title}</span>
              <span className="mt-1 line-clamp-3 whitespace-pre-wrap font-mono text-[11px] text-onlight-muted">
                {t.item.js}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
