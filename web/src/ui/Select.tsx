import { forwardRef } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { cn } from './cn';

// Inline glyphs (the project ships no icon library — primitives draw their own
// SVGs, see SearchInput).
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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

// Design-system select — compound wrappers over Radix Select, mirroring the
// Menu API shape (Root + Trigger + Content + Item). Content floats on the paper
// surface with shadow-pop; the trigger matches TextInput's light field styling.
// data-testid / aria-label forward through ...rest on each part.
export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;

// SelectTrigger is surface-aware so the same primitive reads correctly on the light
// paper surface (modals — the default) AND the dark ink chrome (the editor mode
// strip). The floating SelectContent stays on paper for both surfaces (a small
// floating menu reads fine on paper over either backdrop, matching the Menu/Popover
// primitives). `surface` is consumed here, not forwarded to the DOM.
export const SelectTrigger = forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> & { surface?: 'light' | 'dark' }
>(function SelectTrigger({ className, children, surface = 'light', ...rest }, ref) {
  const isDark = surface === 'dark';
  return (
    <RadixSelect.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-8 items-center justify-between gap-2 rounded px-2 text-[13px] font-sans',
        'transition-colors duration-150 ease-draft',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isDark
          ? 'bg-ink-800 text-ondark-strong border border-ink-line/50 ring-draft data-[placeholder]:text-ondark-muted'
          : 'bg-paper-50 text-onlight-strong border border-paper-line ring-draft-light data-[placeholder]:text-onlight-faint',
        className,
      )}
      {...rest}
    >
      {children}
      <RadixSelect.Icon>
        <ChevronDownIcon className={cn('h-4 w-4', isDark ? 'text-ondark-muted' : 'text-onlight-muted')} />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
});

export function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 6,
  ...rest
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        sideOffset={sideOffset}
        className={cn(
          'bg-paper-50 text-onlight-strong border border-paper-line rounded-lg shadow-pop',
          'p-1 min-w-[var(--radix-select-trigger-width)] animate-pop-in z-50',
          className,
        )}
        {...rest}
      >
        <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export const SelectItem = forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(function SelectItem({ className, children, ...rest }, ref) {
  return (
    <RadixSelect.Item
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded py-1.5 pl-7 pr-2.5 text-[13px] outline-none',
        'data-[highlighted]:bg-accent-tint data-[highlighted]:text-onlight-strong',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...rest}
    >
      <span className="absolute left-2 inline-flex items-center">
        <RadixSelect.ItemIndicator>
          <CheckIcon className="h-3.5 w-3.5 text-accent" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
});
