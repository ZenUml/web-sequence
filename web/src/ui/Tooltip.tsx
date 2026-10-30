import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Design-system Tooltip over Radix Tooltip. The content is portaled and carries
// its own surface (default dark). Radix makes the trigger keyboard-focusable, so
// the microcopy is reachable without a pointer (the native `title=""` attribute
// is not).
//
// `Tooltip` bundles its own single-trigger Provider so callers can drop one in
// without wiring a top-level provider. For a header full of tooltips this means
// each shares Radix's grouped open/close timing via the default provider delay.

export const TooltipProvider = RadixTooltip.Provider;

export interface TooltipProps {
  /** The explanatory microcopy. */
  label: React.ReactNode;
  /** The control the tooltip describes. Must be a single focusable element. */
  children: React.ReactNode;
  side?: RadixTooltip.TooltipContentProps['side'];
  align?: RadixTooltip.TooltipContentProps['align'];
  sideOffset?: number;
  /** Delay before showing on hover/focus (ms). */
  delayDuration?: number;
  /** Portaled chip surface. Default dark, matching the previous ink chip. */
  surface?: UISurface;
}

export function Tooltip({
  label,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  delayDuration = 300,
  surface = 'dark',
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            data-ui-surface={surface}
            className={cn('ui-tooltip', surfaceClass(surface), 'animate-pop-in')}
          >
            {label}
            <RadixTooltip.Arrow className="ui-tooltip-arrow" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
