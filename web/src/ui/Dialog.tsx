import { useRef } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from './cn';
import { IconButton } from './IconButton';

// Design-system modal shell over Radix Dialog. Modals sit on the dark ink surface
// (the app's chrome) so they read as "lifted off the table" against the darker
// overlay. Used by LoginModal, AskToImportModal, ConfirmDialog (M02) and beyond.
// (The diagram canvas remains the only warm-paper surface.)
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
  bare = false,
  titleClassName,
  descriptionClassName,
  bodyClassName,
  closeClassName,
  closeDisabled = false,
  describedBy,
  restoreFocus = false,
  focusContentOnOpen = false,
  overlayClassName,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: string;
  // Optional presentation hooks (backward compatible; all default to the ink
  // look). `bare` drops the ink surface/size/padding and the serif title/muted
  // description colors so a caller can style the shell with scoped CSS while
  // keeping Radix focus trap, Escape, focus restore and the labelled close.
  bare?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
  bodyClassName?: string;
  closeClassName?: string;
  closeDisabled?: boolean;
  // Overrides aria-describedby (e.g. to point at body copy rendered as children
  // when no `description` string is passed).
  describedBy?: string;
  // Radix only returns focus to a Dialog.Trigger. Dialogs opened from app state
  // (no Trigger) otherwise drop focus to <body> on close. Opt in to return focus
  // to the element that was focused when the dialog opened.
  restoreFocus?: boolean;
  // Focus the dialog container on open instead of its first control (the close
  // button), so no focus ring shows until the user tabs. Tab order is unchanged.
  focusContentOnOpen?: boolean;
  // Replaces the default ink overlay colour/blur.
  overlayClassName?: string;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className={cn(
          'fixed inset-0 z-40 animate-overlay-in',
          overlayClassName ?? 'bg-ink-950/55 backdrop-blur-[2px]',
        )}
      />
      {/* Centering wrapper: the pop-in keyframe animates `transform: scale()` with
          fill 'both', which clobbers any centering translate on the Content. So we
          center here via grid and let Content keep only its scale animation. */}
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <RadixDialog.Content
          {...(describedBy ? { 'aria-describedby': describedBy } : {})}
          ref={contentRef}
          onOpenAutoFocus={(e: Event) => {
            if (restoreFocus) {
              // Fires as the content mounts, before focus moves inside: the
              // active element is still the opener for THIS opening.
              const active = document.activeElement;
              openerRef.current =
                active instanceof HTMLElement && active !== document.body ? active : null;
            }
            if (focusContentOnOpen) {
              e.preventDefault();
              contentRef.current?.focus();
            }
          }}
          {...(restoreFocus
            ? {
                onCloseAutoFocus: (e: Event) => {
                  const opener = openerRef.current;
                  if (opener && opener.isConnected) {
                    e.preventDefault();
                    opener.focus();
                  }
                },
              }
            : {})}
          className={cn(
            bare
              ? 'relative animate-pop-in focus:outline-none'
              : [
                  'relative w-[min(440px,calc(100vw-2rem))] rounded-lg border border-ink-line',
                  'bg-ink-800 text-ondark-strong shadow-pop animate-pop-in',
                  'p-6 focus:outline-none',
                ],
            className,
          )}
        >
          <DialogClose asChild>
            <IconButton
              surface="dark"
              size="sm"
              aria-label="Close"
              disabled={closeDisabled}
              className={cn('absolute right-3 top-3', closeClassName)}
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
          <RadixDialog.Title
            className={cn(
              !bare && 'font-serif text-[26px] leading-tight tracking-tight text-ondark-strong',
              titleClassName,
            )}
          >
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description
              className={cn(!bare && 'mt-1 text-[13px] text-ondark-muted', descriptionClassName)}
            >
              {description}
            </RadixDialog.Description>
          ) : (
            // Radix warns when Description is absent; provide an a11y-only fallback.
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          <div className={cn(!bare && 'mt-5', bodyClassName)}>{children}</div>
        </RadixDialog.Content>
      </div>
    </RadixDialog.Portal>
  );
}
