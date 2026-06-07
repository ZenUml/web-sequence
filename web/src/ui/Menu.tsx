import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from './cn';

// Thin design-system wrappers over Radix DropdownMenu.
// Menus sit on the paper surface (light), floated over the ink chrome.
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  children,
  className,
  sideOffset = 6,
  align = 'end',
  ...rest
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'bg-paper-50 text-onlight-strong border border-paper-line rounded-lg shadow-pop',
          'p-1 min-w-[180px] animate-pop-in z-50',
          className,
        )}
        {...rest}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  children,
  className,
  tone = 'default',
  ...rest
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  // Destructive items need the danger highlight to WIN. `cn` is bare clsx (no
  // tailwind-merge), so appending `data-[highlighted]:bg-danger/20` on top of the base
  // `data-[highlighted]:bg-accent-tint` leaves both in the class string — the winner is
  // decided by compiled-CSS source order, not input order, so the danger tint is not
  // guaranteed. The tone variant SWAPS the base highlight class instead of appending, so
  // exactly one `data-[highlighted]:bg-*` is emitted and the affordance is deterministic
  // (adversarial review).
  tone?: 'default' | 'danger';
}) {
  // Both tones keep `data-[highlighted]:text-onlight-strong` on highlight — the danger
  // signal is carried by the background swap (bg-danger/20 vs bg-accent-tint), not by red
  // text on a pink highlight (which would be low-contrast). Finding #3 was strictly about
  // the background conflict; the highlight text color is unchanged from the original.
  const highlight =
    tone === 'danger'
      ? 'text-danger data-[highlighted]:bg-danger/20 data-[highlighted]:text-onlight-strong'
      : 'data-[highlighted]:bg-accent-tint data-[highlighted]:text-onlight-strong';
  return (
    <DropdownMenu.Item
      className={cn(
        'text-[13px] px-2.5 py-1.5 rounded outline-none cursor-pointer',
        highlight,
        className,
      )}
      {...rest}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({
  children,
  className,
  ...rest
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        'px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.1em] text-onlight-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator
      className={cn('my-1 h-px bg-paper-line', className)}
      {...rest}
    />
  );
}
