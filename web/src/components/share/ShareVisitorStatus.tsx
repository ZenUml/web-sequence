import { useEffect, useRef, type ReactNode } from 'react';
import { BrandLogo, Tooltip, cn } from '../../ui';
import { MoonIcon, SidebarIcon, SunIcon } from '../../ui/icons';
import { LoginModal } from '../auth/LoginModal';
import { ProfileMenu, type ProfileMenuProps } from '../auth/ProfileMenu';
import type { AppUser, Appearance } from '../../domain/types';
import type { ProviderName } from '../../services/types';
import './ShareVisitorStatus.css';

// Shared-link visitor states shown BEFORE the shared item exists in the editor store
// (Figma 36:8669 / 36:8736 loading, 36:8803 / 36:8870 network failure). The surface
// reuses the Editor chrome classes so it reads as the same workspace, but carries
// no document data: no editable title, no Fork/Share/Present, no page tabs or zoom.
// An explicitly unavailable link keeps using ShareErrorNotice; this view is only for
// "still loading" and "temporary failure, try again".

export type ShareVisitorStatusKind = 'loading' | 'retryable-error';

export interface ShareVisitorStatusProps {
  status: ShareVisitorStatusKind;
  onRetry(): void;
  appearance: Appearance;
  onToggleAppearance(): void;
  onGoHome(): void;
  user: AppUser | null;
  onLogout(): void;
  // Subscription affordances forwarded to ProfileMenu (same values AppHeader gets).
  profile?: Omit<ProfileMenuProps, 'user' | 'onLogout'>;
  // AppHeader normally hosts the LoginModal; this view hosts it while it is shown.
  login: {
    open: boolean;
    onOpenChange(open: boolean): void;
    onLogin(provider: ProviderName): void;
    lastProvider?: string | null;
    error?: string | null;
    pendingProvider?: ProviderName | null;
  };
  // Desktop-only code-pane toggle, mirroring the Editor header.
  editorCollapsed?: boolean;
  onToggleEditor?(): void;
  // Footer of the source column (the Editor puts Report a bug here).
  sourceFooter?: ReactNode;
}

// 36px frame, 26px ring (Figma "Loading indicator"). A quarter arc rotates over a
// faint track; reduced motion keeps the arc still — the heading carries the state.
function Spinner() {
  return (
    <svg viewBox="0 0 36 36" className="share-visitor__icon share-visitor__spinner" aria-hidden="true">
      <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.18" />
      <path d="M18 5a13 13 0 0 1 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 36px frame, 26px circle with a vertical stroke (Figma "Network failure icon").
function FailureIcon() {
  return (
    <svg viewBox="0 0 36 36" className="share-visitor__icon" aria-hidden="true">
      <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18 11v8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="24.3" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function ShareVisitorStatus({
  status,
  onRetry,
  appearance,
  onToggleAppearance,
  onGoHome,
  user,
  onLogout,
  profile,
  login,
  editorCollapsed = false,
  onToggleEditor,
  sourceFooter,
}: ShareVisitorStatusProps) {
  const loading = status === 'loading';
  const dark = appearance === 'dark';

  const panelRef = useRef<HTMLElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  // Set when the visitor pressed Try again, so focus follows their action only;
  // the first failure does not steal focus from wherever it is.
  const retried = useRef(false);

  useEffect(() => {
    if (!retried.current) return;
    if (loading) panelRef.current?.focus();
    else retryRef.current?.focus();
  }, [loading]);

  const handleRetry = () => {
    retried.current = true;
    // Move focus before the button unmounts so it never drops to <body>.
    panelRef.current?.focus();
    onRetry();
  };

  const appearanceLabel = dark ? 'Switch to light appearance' : 'Switch to dark appearance';

  return (
    <div
      data-testid="share-visitor-status"
      data-status={status}
      className="editor-hifi-shell share-visitor flex flex-col h-full w-full"
    >
      <header className="editor-hifi-header">
        <div className="editor-header-nav">
          <span className="share-visitor__brand">
            <BrandLogo className="h-[26px] w-[26px] shrink-0" />
          </span>
          {onToggleEditor && (
            <Tooltip surface={appearance} label={editorCollapsed ? 'Show code editor' : 'Hide code editor'}>
              <button
                type="button"
                data-testid="header-toggle-editor"
                aria-label="Toggle code editor"
                aria-pressed={!editorCollapsed}
                onClick={onToggleEditor}
                className="editor-icon-button editor-sidebar-toggle"
              >
                <SidebarIcon className="h-5 w-5" />
              </button>
            </Tooltip>
          )}
        </div>

        <div className="editor-document-chrome">
          <div className="editor-breadcrumb" data-testid="hub-breadcrumb">
            <button
              type="button"
              data-testid="header-go-home"
              aria-label="Back to your diagrams"
              onClick={onGoHome}
              className="editor-breadcrumb-link"
            >
              Diagrams
            </button>
            <span className="editor-breadcrumb-separator" aria-hidden="true">/</span>
          </div>
          <span data-testid="share-status-title" className="share-visitor__title">
            {loading ? 'Loading diagram…' : 'Shared link'}
          </span>
        </div>

        <div className="editor-header-spacer" />

        <div className="editor-global-actions">
          <Tooltip surface={appearance} label={appearanceLabel}>
            <button
              type="button"
              data-testid="header-appearance"
              aria-label={appearanceLabel}
              onClick={onToggleAppearance}
              className="editor-icon-button editor-appearance-toggle"
            >
              {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
          </Tooltip>
          <div className="editor-global-account">
            {user ? (
              <ProfileMenu user={user} onLogout={onLogout} {...profile} surface={appearance} />
            ) : (
              <button
                type="button"
                data-testid="header-login"
                onClick={() => login.onOpenChange(true)}
                className="editor-button editor-button--secondary editor-sign-in"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        data-testid="share-visitor-body"
        aria-busy={loading}
        className={cn('share-visitor__body', editorCollapsed && 'share-visitor__body--collapsed')}
      >
        <section className="share-visitor__source" aria-label="Diagram source">
          <p className="share-visitor__eyebrow">Source · read only</p>
          <p className="share-visitor__source-message">
            {loading ? 'Loading source…' : 'Source couldn’t be loaded.'}
          </p>
          {loading && (
            <div data-testid="share-source-skeleton" className="share-visitor__skeleton" aria-hidden="true">
              <span style={{ width: 250 }} />
              <span style={{ width: 190 }} />
              <span style={{ width: 224 }} />
            </div>
          )}
          {sourceFooter && <div className="share-visitor__source-footer">{sourceFooter}</div>}
        </section>

        <div className="share-visitor__stage editor-preview-stage">
          <section
            ref={panelRef}
            tabIndex={-1}
            data-testid="share-status-panel"
            aria-label="Shared diagram"
            className="share-visitor__panel editor-preview-panel"
          >
            {loading ? (
              <div key="loading" role="status" className="share-visitor__message">
                <Spinner />
                <h2 className="share-visitor__heading">Loading diagram…</h2>
                <p className="share-visitor__guidance">Fetching the shared diagram and its source.</p>
              </div>
            ) : (
              <div key="failed" role="alert" className="share-visitor__message">
                <FailureIcon />
                <h2 className="share-visitor__heading">Couldn’t load this diagram</h2>
                <p className="share-visitor__guidance">Check your connection and try again.</p>
              </div>
            )}
            {!loading && (
              <button
                ref={retryRef}
                type="button"
                data-testid="share-status-retry"
                onClick={handleRetry}
                className="editor-button editor-button--primary share-visitor__retry"
              >
                Try again
              </button>
            )}
          </section>
        </div>
      </main>

      <LoginModal
        open={login.open}
        onOpenChange={login.onOpenChange}
        onLogin={login.onLogin}
        lastProvider={login.lastProvider}
        error={login.error}
        pendingProvider={login.pendingProvider}
      />
    </div>
  );
}
