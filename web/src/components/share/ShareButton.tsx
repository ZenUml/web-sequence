import { useState } from 'react';
import { Popover, PopoverTrigger, Button } from '../../ui';
import { SharePopover, type SharePopoverProps } from './SharePopover';

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

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          data-testid="share-button"
          variant="subtle"
          disabled={disabled}
          title={disabled ? disabledReason : 'Create a read-only link to share this diagram'}
        >
          Share
        </Button>
      </PopoverTrigger>
      <SharePopover {...popoverProps} />
    </Popover>
  );
}
