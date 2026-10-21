import { forwardRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Thin design-system wrappers over Radix DropdownMenu.
// The menu is portaled. `surface` defaults to dark (the previous ink menu) and
// is set on the portaled node. An ancestor surface does not cross the portal.
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export const MenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Content> & { surface?: UISurface }
>(function MenuContent(
  { children, className, sideOffset = 6, align = 'end', surface = 'dark', ...rest },
  ref,
) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        {...rest}
        sideOffset={sideOffset}
        align={align}
        data-ui-surface={surface}
        className={cn('ui-menu', surfaceClass(surface), 'animate-pop-in', className)}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
});

export const MenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
    // Destructive items need the danger highlight to WIN. `cn` is bare clsx (no
    // tailwind-merge), so appending `data-[highlighted]:bg-danger/20` on top of the base
    // highlight leaves both in the class string — the winner is decided by compiled-CSS
    // source order, not input order. The tone variant SWAPS the highlight class instead
    // of appending, so exactly one danger highlight utility is emitted. Highlight text
    // comes from --ui-danger-highlight-text on the menu surface, not the pale on-dark color.
    tone?: 'default' | 'danger';
  }
>(function MenuItem({ children, className, tone = 'default', ...rest }, ref) {
  const highlight =
    tone === 'danger' ? 'text-danger data-[highlighted]:bg-danger/20' : undefined;
  return (
    <DropdownMenu.Item
      ref={ref}
      {...rest}
      data-tone={tone === 'danger' ? 'danger' : undefined}
      className={cn('ui-menu-item', highlight, className)}
    >
      {children}
    </DropdownMenu.Item>
  );
});

export const MenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>
>(function MenuLabel({ children, className, ...rest }, ref) {
  return (
    <DropdownMenu.Label ref={ref} {...rest} className={cn('ui-menu-label', className)}>
      {children}
    </DropdownMenu.Label>
  );
});

export const MenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(function MenuSeparator({ className, ...rest }, ref) {
  return (
    <DropdownMenu.Separator
      ref={ref}
      {...rest}
      className={cn('ui-menu-separator', className)}
    />
  );
});
