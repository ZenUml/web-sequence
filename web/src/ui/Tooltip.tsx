import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from './cn';

// Design-system Tooltip over Radix Tooltip. Unlike menus/popovers (which float on
// the light paper surface), tooltips are tiny explanatory chips rendered on the
// DARK ink surface so they read as transient chrome annotations rather than
// content. Radix makes the trigger keyboard-focusable, so the microcopy these
// carry is reachable without a pointer (the native `title=""` attribute is not).
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
}

export function Tooltip({
  label,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 6,
  delayDuration = 300,
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
            className={cn(
              // Dark surface chip, small mono-adjacent text, soft depth.
              'bg-ink-800 text-ondark-strong border border-ink-line/60 rounded',
              'px-2 py-1 text-[11px] leading-snug max-w-[220px]',
              'shadow-pop-dark animate-pop-in z-50 select-none',
            )}
          >
            {label}
            <RadixTooltip.Arrow className="fill-ink-800" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
