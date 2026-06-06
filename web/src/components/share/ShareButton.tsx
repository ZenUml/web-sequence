import { Popover, PopoverTrigger, Button } from '../../ui';
import { SharePopover, type SharePopoverProps } from './SharePopover';

export interface ShareButtonProps extends SharePopoverProps {
  // Disabled for read-only items or unsaved-new items that can't be shared yet.
  disabled?: boolean;
}

// Owns the single Popover Root: the trigger is the visible "Share" button and
// the content is the SharePopover paper body.
export function ShareButton({ disabled, ...popoverProps }: ShareButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button data-testid="share-button" variant="subtle" disabled={disabled}>
          Share
        </Button>
      </PopoverTrigger>
      <SharePopover {...popoverProps} />
    </Popover>
  );
}
