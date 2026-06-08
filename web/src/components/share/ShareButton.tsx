import { useState } from 'react';
import { Popover, PopoverTrigger, Button } from '../../ui';
import { SharePopover, type SharePopoverProps } from './SharePopover';

// Design §01 share glyph (three connected nodes). Decorative — the button carries
// an explicit aria-label so the icon-only mobile state stays accessible.
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      className="h-[15px] w-[15px]" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export interface ShareButtonProps extends SharePopoverProps {
  // Disabled ONLY for read-only items (a shared/embed copy can't be re-shared).
  // Signed-out and never-saved cases are handled as actions, not dead disable (#4).
  disabled?: boolean;
  // #4: when the user is signed out, sharing requires auth — clicking Share opens
  // the login modal instead of a popover. When this returns true the click was
  // intercepted (auth required) and the popover must NOT open.
  requiresAuth?: boolean;
  onRequireAuth?(): void;
  // Tooltip explaining a disabled state (only the read-only case remains disabled).
  disabledReason?: string;
}

// Owns the single Popover Root: the trigger is the visible "Share" button and
// the content is the SharePopover paper body. The popover open state is controlled
// here so a signed-out click can be intercepted into the login flow (#4) rather
// than opening an empty popover behind a sign-in wall.
export function ShareButton({
  disabled,
  requiresAuth,
  onRequireAuth,
  disabledReason,
  ...popoverProps
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    // Opening while signed-out: route to login instead of showing the popover (#4).
    if (next && requiresAuth) {
      onRequireAuth?.();
      return; // leave the popover closed
    }
    setOpen(next);
  }

  // A disabled <button> has `pointer-events:none` (Button base), so a native `title`
  // on it never fires hover — the explanation would be invisible exactly when the
  // control is disabled (the read-only case). Carry the tooltip on a wrapping <span>
  // (which still receives pointer events) so the read-only Share is never a silent
  // dead control (#4). When enabled the title sits on the button itself.
  if (disabled) {
    return (
      <span title={disabledReason} className="inline-flex">
        <Button data-testid="share-button" variant="subtle" aria-label="Share" disabled>
          <ShareIcon />
          <span className="hidden md:inline">Share</span>
        </Button>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          data-testid="share-button"
          variant="subtle"
          aria-label="Share"
          title="Create a read-only link to share this diagram"
        >
          <ShareIcon />
          <span className="hidden md:inline">Share</span>
        </Button>
      </PopoverTrigger>
      <SharePopover {...popoverProps} />
    </Popover>
  );
}
