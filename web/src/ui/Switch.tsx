import { forwardRef } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from './cn';

// Design-system switch — thin wrapper over Radix Switch. On the paper (light)
// surface: a pill track that fills with the cobalt accent when checked, with a
// paper thumb that slides. data-testid / aria-label forward through ...rest.
export const Switch = forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(function Switch({ className, ...rest }, ref) {
  return (
    <RadixSwitch.Root
      ref={ref}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-paper-line',
        'bg-paper-200 transition-colors duration-150 ease-draft ring-draft-light',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      <RadixSwitch.Thumb
        className={cn(
          'block h-5 w-5 translate-x-0.5 rounded-full bg-paper-50 shadow-pop',
          'transition-transform duration-150 ease-draft',
          'data-[state=checked]:translate-x-[20px]',
        )}
      />
    </RadixSwitch.Root>
  );
});
