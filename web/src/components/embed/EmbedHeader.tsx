import { cn } from '../../ui';

// Minimal presentational embed header (REQ-EMB-1). Embed mode strips all app
// chrome — no save/auth/library/share controls — leaving only the diagram title
// and a single affordance to open the same diagram in the full editor at the
// canonical app origin. Rendered on the dark `ink`/blueprint surface to match the
// app header. Purely presentational: the caller computes `openUrl`.
export interface EmbedHeaderProps {
  /** Diagram title; falls back to a sensible default when omitted/empty. */
  title?: string;
  /** Canonical-origin URL that reproduces this diagram in the full editor. */
  openUrl: string;
}

const DEFAULT_TITLE = 'ZenUML Diagram';

export function EmbedHeader({ title, openUrl }: EmbedHeaderProps) {
  const shownTitle = title?.trim() ? title : DEFAULT_TITLE;

  return (
    <header
      data-testid="embed-header"
      className="bg-blueprint border-b border-ink-line/40 h-10 px-3 flex items-center gap-2"
    >
      <span
        data-testid="embed-title"
        // Chrome-bar title uses the UI grotesque (font-sans / Hanken Grotesk), NOT
        // the serif display face (#11): Instrument Serif is for large editorial
        // moments (modal titles, empty states), and reads thin/wrong at 14px in a
        // dense control bar.
        className="font-sans text-[14px] font-medium text-ondark-strong flex-1 min-w-0 truncate select-none"
        title={shownTitle}
      >
        {shownTitle}
      </span>

      <a
        data-testid="embed-open-link"
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        // Primary-CTA look (rounded, focus-ringed, inset accent fill) but the
        // RESTING fill is `accent-press` (#1E50D8, ~6.6:1 on white), not `accent`
        // (#2F6BFF, exactly 4.5:1) — the embed CTA is the diagram's only escape
        // hatch, so it gets a comfortable contrast margin rather than sitting on
        // the WCAG-AA floor (#12). NOTE: `cn` is plain clsx (no tailwind-merge), so
        // the accent-press fill must be authored here directly, not layered over
        // the Button `primary` variant's `bg-accent`.
        className={cn(
          'inline-flex items-center justify-center gap-1.5 font-medium select-none',
          'rounded transition-colors duration-150 ease-draft whitespace-nowrap',
          'h-7 px-2.5 text-[12px] shadow-inset ring-draft shrink-0',
          'bg-accent-press text-white hover:bg-accent active:bg-accent',
        )}
      >
        Edit in ZenUML
      </a>
    </header>
  );
}
