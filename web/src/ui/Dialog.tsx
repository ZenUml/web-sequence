import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from './cn';

// Design-system modal shell over Radix Dialog. Modals sit on the paper surface
// (light) so they read as "lifted off the table." Used by LoginModal,
// AskToImportModal, ConfirmDialog (M02) and beyond.
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink-950/55 backdrop-blur-[2px] animate-overlay-in" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[min(440px,calc(100vw-2rem))] rounded-lg border border-paper-line',
          'bg-paper-50 text-onlight-strong shadow-pop animate-pop-in',
          'p-6 focus:outline-none',
          className,
        )}
      >
        <RadixDialog.Title className="font-serif text-[26px] leading-tight tracking-tight text-onlight-strong">
          {title}
        </RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="mt-1 text-[13px] text-onlight-muted">
            {description}
          </RadixDialog.Description>
        ) : (
          // Radix warns when Description is absent; provide an a11y-only fallback.
          <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
        )}
        <div className="mt-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
