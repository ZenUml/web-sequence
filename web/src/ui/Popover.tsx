import { forwardRef } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Radix popover. Default surface stays light. The content is portaled, so the
// surface class is set on the portaled node rather than inherited.
export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

export const PopoverContent = forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content> & { surface?: UISurface }
>(function PopoverContent(
  { children, className, sideOffset = 8, align = 'end', surface = 'light', ...rest },
  ref,
) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        {...rest}
        sideOffset={sideOffset}
        align={align}
        data-ui-surface={surface}
        className={cn('ui-popover', surfaceClass(surface), 'animate-pop-in', className)}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
});
