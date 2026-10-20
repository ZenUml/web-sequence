import { forwardRef } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Inline glyphs (the project ships no icon library — primitives draw their own
// SVGs, see SearchInput). Stroke is 1.5, the shared icon stroke.
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

// Compound wrappers over Radix Select. The trigger default surface stays light.
// SelectContent is portaled, so it does not inherit the trigger surface. Pass
// the same `surface` to SelectContent. The default remains dark, matching the
// previous menu panel.
export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;

export const SelectTrigger = forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> & { surface?: UISurface }
>(function SelectTrigger({ className, children, surface = 'light', ...rest }, ref) {
  return (
    <RadixSelect.Trigger
      ref={ref}
      {...rest}
      data-ui-surface={surface}
      className={cn(
        'ui-field',
        'ui-field--control',
        'ui-select-trigger',
        surfaceClass(surface),
        className,
      )}
    >
      {children}
      <RadixSelect.Icon>
        <ChevronDownIcon className="ui-select-icon" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
});

export const SelectContent = forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content> & { surface?: UISurface }
>(function SelectContent(
  { className, children, position = 'popper', sideOffset = 6, surface = 'dark', ...rest },
  ref,
) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        ref={ref}
        {...rest}
        position={position}
        sideOffset={sideOffset}
        data-ui-surface={surface}
        className={cn('ui-select-content', surfaceClass(surface), 'animate-pop-in', className)}
      >
        <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
});

export const SelectItem = forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Item ref={ref} {...rest} className={cn('ui-select-item', className)}>
      <span className="ui-select-indicator">
        <RadixSelect.ItemIndicator>
          <CheckIcon className="ui-select-check" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
});
