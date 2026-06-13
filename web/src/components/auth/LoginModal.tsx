import { Dialog, DialogContent, Button } from '../../ui';
import type { ProviderName } from '../../services/types';

// Decorative provider glyphs (aria-hidden — the button's text label carries the
// accessible name). Single-color `currentColor` marks so they inherit the
// button's text color: dark on the at-rest subtle button, white on the elevated
// cobalt primary button. Google is the deliberate brand-multicolor exception
// (see GLYPH_NEEDS_CHIP below — its fixed fills require a white chip on cobalt).
const GLYPHS: Record<ProviderName, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#EA4335" d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.7 14.97.6 12 .6 7.7.6 3.99 3.07 2.18 6.71l3.66 2.84C6.71 6.86 9.14 5 12 5z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.88c2.18-2.01 3.7-4.97 3.7-8.7z" />
      <path fill="#FBBC05" d="M5.84 14.45a7.2 7.2 0 0 1 0-4.55L2.18 7.06a11.9 11.9 0 0 0 0 9.88l3.66-2.49z" />
      <path fill="#34A853" d="M12 23.4c3.24 0 5.95-1.07 7.93-2.9l-3.72-2.88c-1.03.69-2.35 1.1-4.21 1.1-2.86 0-5.29-1.86-6.16-4.55l-3.66 2.49C3.99 20.93 7.7 23.4 12 23.4z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"
      />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8v8.44C19.61 23.08 24 18.09 24 12.07z"
      />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.48 3.24H4.29l13.32 17.41z"
      />
    </svg>
  ),
};

// Google keeps its fixed brand-multicolor fills (the deliberate exception), so on
// the elevated cobalt primary button it would clash/vanish against `bg-accent`.
// Sit it on a small white chip there. Every other glyph is `currentColor` and
// inherits the button's `text-white` on cobalt, so it needs no chip.
const GLYPH_NEEDS_CHIP: Partial<Record<ProviderName, true>> = { google: true };

const PROVIDERS: { id: ProviderName; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'twitter', label: 'Continue with Twitter' },
];

export interface LoginModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  onLogin(provider: ProviderName): void;
  lastProvider?: string | null;
  // OAuth error surfaced as a design-system notice (roadmap §9 carry-forward —
  // replaces the M02 console/window.alert stopgap, incl. account-exists).
  error?: string | null;
}

export function LoginModal({ open, onOpenChange, onLogin, lastProvider, error }: LoginModalProps) {
  // lastProvider is persisted as the raw provider id (lowercase) but may arrive
  // display-cased from other call sites — normalize both sides before matching.
  const last = lastProvider?.toLowerCase() ?? null;
  // Surface the last-used provider first and elevate it as the primary
  // affordance; everything else stays a quiet subtle button. Filter the matched
  // provider out of the tail so reordering never duplicates a data-testid.
  const matched = last ? PROVIDERS.find((p) => p.id === last) : undefined;
  const rest = matched ? PROVIDERS.filter((p) => p.id !== matched.id) : PROVIDERS;

  // One provider button. The last-used provider is `elevated` (cobalt primary +
  // a "Last used" chip); everyone else is a quiet subtle button.
  function providerButton({ id, label }: { id: ProviderName; label: string }, elevated: boolean) {
    const chip = elevated && GLYPH_NEEDS_CHIP[id];
    return (
      <Button
        key={id}
        variant={elevated ? 'primary' : 'subtle'}
        surface="dark"
        className="w-full"
        data-testid={`login-${id}`}
        onClick={() => onLogin(id)}
      >
        <span className="flex w-full items-center gap-1.5">
          <span
            data-testid={`login-${id}-glyph`}
            data-chip={chip ? 'true' : undefined}
            className={
              chip
                ? 'flex shrink-0 items-center justify-center rounded-[3px] bg-white p-0.5 text-ondark-strong'
                : 'shrink-0'
            }
          >
            {GLYPHS[id]}
          </span>
          {label}
          {elevated && (
            <span
              data-testid={`login-${id}-lastused`}
              className="ml-auto rounded-[5px] bg-white/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em]"
            >
              Last used
            </span>
          )}
        </span>
      </Button>
    );
  }

  // Eyelabel (.ret) section headers — ondark-muted keeps them AA-legible on paper
  // (ondark-faint fails AA for small text per the contrast audit).
  const eyelabel = 'font-mono text-[10px] uppercase tracking-[0.12em] text-ondark-muted';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Sign in to ZenUML"
        description="Save and sync your diagrams across devices."
      >
        {error && (
          <p
            data-testid="login-error"
            role="alert"
            className="mb-3 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger"
          >
            {error}
          </p>
        )}
        {/* §05: when there's a returning provider, float it under "Pick up where you
            left off" with a Last-used chip + cobalt elevation, and drop the rest under
            "Or use another account". One glance, one click to re-auth. */}
        {matched ? (
          <>
            <p className={`mb-2 ${eyelabel}`}>Pick up where you left off</p>
            <div className="flex flex-col gap-2">{providerButton(matched, true)}</div>
            <p className={`mb-2 mt-4 ${eyelabel}`}>Or use another account</p>
            <div className="flex flex-col gap-2">
              {rest.map((p) => providerButton(p, false))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {rest.map((p) => providerButton(p, false))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
