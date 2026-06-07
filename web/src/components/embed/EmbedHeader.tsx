import { buttonClassName } from '../../ui';

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
        className="font-serif text-[14px] text-ondark-strong flex-1 min-w-0 truncate select-none"
        title={shownTitle}
      >
        {shownTitle}
      </span>

      <a
        data-testid="embed-open-link"
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClassName({
          variant: 'primary',
          size: 'sm',
          surface: 'dark',
          className: 'shrink-0',
        })}
      >
        Edit in ZenUML
      </a>
    </header>
  );
}
