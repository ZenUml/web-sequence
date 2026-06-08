import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from './cn';
import { IconButton } from './IconButton';

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
      {/* Centering wrapper: the pop-in keyframe animates `transform: scale()` with
          fill 'both', which clobbers any centering translate on the Content. So we
          center here via grid and let Content keep only its scale animation. */}
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <RadixDialog.Content
          className={cn(
            'relative w-[min(440px,calc(100vw-2rem))] rounded-lg border border-paper-line',
            'bg-paper-50 text-onlight-strong shadow-pop animate-pop-in',
            'p-6 focus:outline-none',
            className,
          )}
        >
          <DialogClose asChild>
            <IconButton
              surface="light"
              size="sm"
              aria-label="Close"
              className="absolute right-3 top-3"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          </DialogClose>
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
      </div>
    </RadixDialog.Portal>
  );
}
