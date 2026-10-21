import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, Button } from '../../ui';
import type { ProviderName } from '../../services/types';
import { PROVIDER_LABEL, SIGN_IN_PROVIDERS, toSignInProvider, type SignInProvider } from './signInProviders';
import './account-flows.css';

// Decorative provider glyphs (aria-hidden — the button label carries the
// accessible name). Google keeps its brand colours; GitHub uses currentColor so
// it follows the button text in light and dark.
const GLYPHS: Record<SignInProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.7 14.97.6 12 .6 7.7.6 3.99 3.07 2.18 6.71l3.66 2.84C6.71 6.86 9.14 5 12 5z" />
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.88c2.18-2.01 3.7-4.97 3.7-8.7z" />
      <path fill="#FBBC05" d="M5.84 14.45a7.2 7.2 0 0 1 0-4.55L2.18 7.06a11.9 11.9 0 0 0 0 9.88l3.66-2.49z" />
      <path fill="#34A853" d="M12 23.4c3.24 0 5.95-1.07 7.93-2.9l-3.72-2.88c-1.03.69-2.35 1.1-4.21 1.1-2.86 0-5.29-1.86-6.16-4.55l-3.66 2.49C3.99 20.93 7.7 23.4 12 23.4z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"
      />
    </svg>
  ),
};

export interface LoginModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  // Raw provider id, unchanged. May return the login promise; when the parent
  // does not pass `pendingProvider`, the modal tracks pending from that promise.
  onLogin(provider: ProviderName): void | Promise<unknown>;
  // Last recorded provider. Shown as a note only when it is Google or GitHub.
  lastProvider?: string | null;
  // Inline, actionable failure message (useAuth().loginError).
  error?: string | null;
  // Provider whose sign-in window is open (useAuth().pendingProvider). When this
  // prop is passed (even null) the parent owns pending state.
  pendingProvider?: ProviderName | null;
  /** Optional public plan information; callers control payment availability. */
  onOpenPricing?(): void;
}

export function LoginModal({
  open,
  onOpenChange,
  onLogin,
  lastProvider,
  error,
  pendingProvider: pendingProp,
  onOpenPricing,
}: LoginModalProps) {
  const controlled = pendingProp !== undefined;
  // Uncontrolled fallback: pending derived from the promise onLogin returns.
  const [localPending, setLocalPending] = useState<ProviderName | null>(null);
  // Synchronous single-submission gate (a second click in the same tick).
  const lock = useRef(false);
  const attempt = useRef(0);

  // Closing abandons the local attempt: a late settle must not mark a reopened
  // modal as pending, and the gate is released for the next attempt.
  useEffect(() => {
    if (!open) {
      attempt.current += 1;
      lock.current = false;
      setLocalPending(null);
    }
  }, [open]);

  // Controlled: the gate follows the parent's pending state.
  useEffect(() => {
    if (controlled && !pendingProp) lock.current = false;
  }, [controlled, pendingProp]);

  const pending = controlled ? pendingProp ?? null : localPending;

  function start(provider: SignInProvider) {
    if (pending || lock.current) return;
    lock.current = true;
    const id = ++attempt.current;
    const result = onLogin(provider);
    if (controlled) return;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setLocalPending(provider);
      const settle = () => {
        if (attempt.current !== id) return;
        lock.current = false;
        setLocalPending(null);
      };
      (result as Promise<unknown>).then(settle, settle);
    } else {
      lock.current = false;
    }
  }

  const last = toSignInProvider(lastProvider);
  const pendingLabel = pending ? PROVIDER_LABEL[pending as SignInProvider] ?? pending : null;

  let note: React.ReactNode = null;
  if (pendingLabel) {
    note = (
      <p className="af-note" data-testid="login-pending" role="status">
        Complete sign-in in the {pendingLabel} window.
      </p>
    );
  } else if (error) {
    note = (
      <p className="af-note af-note--error" data-testid="login-error" role="alert">
        {error}
      </p>
    );
  } else if (last) {
    note = (
      <p className="af-note" data-testid={`login-${last}-lastused`}>
        Last used: {PROVIDER_LABEL[last]}
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        bare
        className="af-dialog af-dialog--centered"
        titleClassName="af-title"
        descriptionClassName="af-description"
        closeClassName="af-close"
        restoreFocus
        focusContentOnOpen
        overlayClassName="af-overlay"
        title="Sign in to ZenUML"
        description="Save and sync your diagrams across devices."
      >
        <div className="af-providers">
          {SIGN_IN_PROVIDERS.map((id) => {
            const isPending = pending === id;
            return (
              <Button
                key={id}
                variant="ghost"
                surface="light"
                className="af-provider"
                data-testid={`login-${id}`}
                disabled={!!pending}
                aria-busy={isPending || undefined}
                onClick={() => start(id)}
              >
                <span className="af-provider-glyph" data-testid={`login-${id}-glyph`}>
                  {GLYPHS[id]}
                </span>
                <span>{isPending ? 'Signing in…' : `Continue with ${PROVIDER_LABEL[id]}`}</span>
              </Button>
            );
          })}
        </div>
        {note}
        {onOpenPricing && (
          <p className="af-pricing">
            <button type="button" data-testid="login-pricing" onClick={onOpenPricing}>
              Pricing
            </button>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
