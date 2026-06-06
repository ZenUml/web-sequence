import * as RadixPopover from '@radix-ui/react-popover';
import { cn } from './cn';

// Design-system Popover over Radix Popover. Like menus/modals, popovers float
// over the ink chrome on the light paper surface (sort/filter affordances etc.).
export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

export function PopoverContent({
  children,
  className,
  sideOffset = 8,
  align = 'end',
  ...rest
}: React.ComponentPropsWithoutRef<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'bg-paper-50 text-onlight-strong border border-paper-line rounded-lg shadow-pop',
          'p-3 animate-pop-in z-50',
          className,
        )}
        {...rest}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
