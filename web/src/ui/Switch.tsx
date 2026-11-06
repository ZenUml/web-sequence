import { forwardRef } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Radix switch. The checked track uses the shared primary action color.
// Default surface is light, which matches the previous paper track. Pass
// surface="dark" on dark chrome. data-testid and aria-label forward via rest.
export const Switch = forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> & { surface?: UISurface }
>(function Switch({ className, surface = 'light', ...rest }, ref) {
  return (
    <RadixSwitch.Root
      ref={ref}
      {...rest}
      data-ui-surface={surface}
      className={cn('ui-switch', surfaceClass(surface), className)}
    >
      <RadixSwitch.Thumb className="ui-switch-thumb" />
    </RadixSwitch.Root>
  );
});
