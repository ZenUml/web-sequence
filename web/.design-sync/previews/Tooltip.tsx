import { Button } from 'web-sequence-web';
import * as RadixTooltip from '@radix-ui/react-tooltip';

// Tooltip is an OVERLAY: to grade it we must capture it OPEN. The DS `Tooltip`
// wrapper (label + children) hardcodes its own Radix Root with no open-control
// prop, so to render the floated chip statically we compose the raw Radix
// primitives — Root `defaultOpen`, a DS `Button` trigger, and Content styled
// VERBATIM with the same classNames the shipped `Tooltip.tsx` Content uses, so
// what's captured is pixel-identical to the real component's chip.
//
// IMPORTANT: we MUST wrap in our OWN `RadixTooltip.Provider` here. The card
// mount wraps the story in the bundle's `DraftingTable.TooltipProvider`, but
// that provider comes from the bundle's copy of @radix-ui/react-tooltip, while
// this preview's `import * as RadixTooltip` is a SEPARATE esbuild-bundled copy
// with a distinct React context — a raw Root would throw "must be used within
// TooltipProvider" against the bundle provider. Pairing Provider+Root from the
// same imported copy keeps the context identity matched.
//
// cfg.overrides.Tooltip = { cardMode:"single", viewport:"360x200" } → one card.

const CONTENT_CLASS =
  'bg-ink-800 text-ondark-strong border border-ink-line/60 rounded ' +
  'px-2 py-1 text-[11px] leading-snug max-w-[220px] ' +
  'shadow-pop-dark animate-pop-in z-50 select-none';

// The open explanatory chip below a header control — exactly how RendererHeader
// wraps the Present button. Rendered open so the floated dark chip + arrow show.
export function Open() {
  return (
    <RadixTooltip.Provider>
      <div style={{ background: '#10141B', padding: 24, borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
        <RadixTooltip.Root defaultOpen>
          <RadixTooltip.Trigger asChild>
            <Button variant="subtle">Present</Button>
          </RadixTooltip.Trigger>
          <RadixTooltip.Portal>
            <RadixTooltip.Content side="bottom" align="center" sideOffset={6} className={CONTENT_CLASS}>
              Present this diagram full-screen
              <RadixTooltip.Arrow className="fill-ink-800" />
            </RadixTooltip.Content>
          </RadixTooltip.Portal>
        </RadixTooltip.Root>
      </div>
    </RadixTooltip.Provider>
  );
}
