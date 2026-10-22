import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandLogo, PlusIcon, TextInput, Tooltip } from '../../ui';
import { MoonIcon, SidebarIcon, SunIcon } from '../../ui/icons';
import { LoginModal } from '../auth/LoginModal';
import { ProfileMenu } from '../auth/ProfileMenu';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import type { AppUser, Appearance, PlanType } from '../../domain/types';
import type { ProviderName } from '../../services/types';

export interface AppHeaderProps {
  title: string;
  unsavedCount: number;
  user: AppUser | null;
  lastProvider?: string | null;
  readOnly?: boolean;
  onTitleChange(t: string): void;
  onNew(): void;
  onFork(): void;
  onLogin(provider: ProviderName): void;
  onLogout(): void;
  // Auto-save state. Save is a pure indicator (manual save is ⌘S, handled by
  // AppRoot). `saving` is true while a save is in flight;
  // `dirty` is the unsaved state (covers content AND metadata edits like rename/page
  // ops, which `unsavedCount` does not); clean + signed-in is "Saved". `unsavedCount`
  // is kept only for the precise count in the indicator's aria-label.
  dirty?: boolean;
  saving?: boolean;
  saveError?: boolean;
  syncPending?: boolean;
  cloudWithheld?: boolean;
  cloudConfirmed?: boolean;
  onRetrySave?(): void;
  // Signed-out only: whether this diagram has been written to this device yet.
  // A brand-new diagram reads "Local only" until its first local save.
  savedLocally?: boolean;
  // Present mode (the old Fullscreen) now lives top-right next to Share.
  onPresent(): void;
  // Opens the plans dialog (informational, not checkout): from the account menu
  // when signed in, from the sign-in dialog when signed out. Payment-gated.
  onOpenPricing?(): void;
  // M04 subscription/profile state (forwarded to ProfileMenu). All optional.
  subscribed?: boolean;
  planType?: PlanType;
  paymentEnabled?: boolean;
  onUpgrade?(): void;
  onManagePlan?(): void;
  // OAuth error surfaced inside the LoginModal (roadmap §9 carry-forward).
  loginError?: string | null;
  pendingProvider?: ProviderName | null;
  // Optional CONTROLLED login-modal state so other surfaces (e.g. the anonymous
  // custom-CSS gate in AppRoot) can open sign-in. When omitted, AppHeader manages
  // it with internal state (existing-test compatibility).
  loginOpen?: boolean;
  onLoginOpenChange?(open: boolean): void;
  // Optional extra action(s) rendered in the header's action group (e.g. ShareButton).
  // Kept optional so existing AppHeader tests render without it.
  actions?: ReactNode;
  // Hub (Approach A): when provided, renders a "Diagrams /" breadcrumb left of the
  // title so the user can return to the home/library view. Omitted in classic mode.
  onGoHome?(): void;
  // Code-pane toggle (desktop editor). Renders only when wired, so the control
  // always collapses/expands the real code pane.
  editorCollapsed?: boolean;
  onToggleEditor?(): void;
  // Global light/dark appearance. The toggle renders only when wired.
  appearance?: Appearance;
  onToggleAppearance?(): void;
}

function ForkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="6" cy="5" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <circle cx="6" cy="19" r="2.2" />
      <path d="M6 7.2v9.6M18 7.2c0 5-12 3.8-12 9.6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

export function AppHeader({
  title,
  unsavedCount,
  dirty,
  user,
  lastProvider,
  readOnly = false,
  onTitleChange,
  onNew,
  onFork,
  onLogin,
  onLogout,
  saving = false,
  saveError = false,
  syncPending = false,
  cloudWithheld = false,
  cloudConfirmed = false,
  onRetrySave,
  savedLocally = true,
  onPresent,
  onOpenPricing,
  subscribed = false,
  planType = 'free',
  paymentEnabled = false,
  onUpgrade,
  onManagePlan,
  loginError,
  pendingProvider,
  loginOpen: loginOpenProp,
  onLoginOpenChange,
  actions,
  onGoHome,
  editorCollapsed = false,
  onToggleEditor,
  appearance = 'light',
  onToggleAppearance,
}: AppHeaderProps) {
  const [loginOpenInternal, setLoginOpenInternal] = useState(false);
  // Controlled when the parent supplies loginOpen/onLoginOpenChange; else internal.
  const loginOpen = loginOpenProp ?? loginOpenInternal;
  const setLoginOpen = (o: boolean) => {
    if (onLoginOpenChange) onLoginOpenChange(o);
    else setLoginOpenInternal(o);
  };

  // #8: guard "New" against data loss. With unsaved edits (content OR metadata such
  // as a rename — the same `dirty` the save indicator reports), New first asks the
  // user to confirm discarding them; only on confirm does onNew() fire. A clean
  // diagram is already saved, so New is immediate.
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const handleNewClick = () => {
    if (dirty ?? unsavedCount > 0) setConfirmNewOpen(true);
    else onNew();
  };
  // Pricing is informational and exists only where payments are enabled.
  const openPricing = paymentEnabled ? onOpenPricing : undefined;

  const titleRef = useRef<HTMLInputElement>(null);

  // #826: title edit with a DRAFT buffer so Escape can revert without committing.
  // The field edits a local `draft`; the committed title (`title` prop, owned by the
  // editor store) only changes on Enter/blur. Escape discards the draft back to the
  // last committed value. While the user is NOT editing, the field mirrors the prop —
  // so external title changes (rename via the doc menu, switching diagrams) still flow
  // through. We track editing via focus, and a ref holds the value to revert TO on
  // Escape (captured at focus time) so a mid-edit prop change can't desync the revert.
  const [draft, setDraft] = useState(title);
  const editingTitle = useRef(false);
  const committedTitleRef = useRef(title);
  committedTitleRef.current = title;
  // When not actively editing, keep the field in sync with the committed prop. During
  // an edit we leave `draft` alone so keystrokes aren't clobbered by a re-render.
  useEffect(() => {
    if (!editingTitle.current) setDraft(title);
  }, [title]);

  const commitTitle = (value: string) => {
    // Only fire onTitleChange when the value actually differs from what's committed,
    // so a no-op blur/Enter doesn't mark the diagram dirty.
    if (value !== committedTitleRef.current) {
      // Optimistically advance the committed ref so a follow-up blur re-syncs to the
      // just-committed value (the `title` prop updates async via the store, one turn
      // later). Without this, blur's re-sync would read the STALE prop and briefly
      // revert the field before the prop catches up.
      committedTitleRef.current = value;
      onTitleChange(value);
    }
  };
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitle(draft);
      // Keep editing flag set through the synchronous commit; blur (below) clears it.
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Revert: discard the draft, restore the last committed value, do NOT commit.
      setDraft(committedTitleRef.current);
      editingTitle.current = false;
      e.currentTarget.blur();
    }
  };

  const darkAppearance = appearance === 'dark';

  return (
    <>
      <header className="editor-hifi-header">
        <div className="editor-header-nav">
          {/* The logo is a plain brand mark; it opens no menu. */}
          <span data-testid="header-logo" className="editor-brand-mark">
            <BrandLogo className="h-[26px] w-[26px]" />
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

        <div data-testid="editor-document-chrome" className="editor-document-chrome">
          {/* Breadcrumb: Diagrams / editable title. "Diagrams" returns to the hub. */}
          {onGoHome && (
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
          )}
          <div className="editor-document-file">
            <TextInput
              ref={titleRef}
              surface={appearance}
              value={draft}
              data-testid="header-title"
              aria-label="Diagram title"
              readOnly={readOnly}
              // Size the field to its text (CSS field-sizing where supported; the
              // size attribute is the fallback, e.g. Safari).
              size={Math.max(4, Math.min(28, draft.length + 1))}
              className="editor-title-input"
              onFocus={() => {
                editingTitle.current = true;
              }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={() => {
                // Commit on blur (commit-on-exit), then leave edit mode. Escape's blur
                // already reverted the draft, so this commit is a no-op there (the draft
                // equals the committed value → commitTitle skips onTitleChange).
                if (editingTitle.current) {
                  editingTitle.current = false;
                  commitTitle(draft);
                }
                // Re-sync to the authoritative committed value once editing ends.
                setDraft(committedTitleRef.current);
              }}
            />
          </div>

          <div className="editor-document-save">
            <SaveState
              readOnly={readOnly}
              signedIn={!!user}
              savedLocally={savedLocally}
              saving={saving}
              saveError={saveError}
              syncPending={syncPending || cloudWithheld}
              cloudConfirmed={cloudConfirmed}
              dirty={dirty ?? unsavedCount > 0}
              unsavedCount={unsavedCount}
            />
          </div>
        </div>

        <div className="editor-header-spacer" />

        <div className="editor-document-actions editor-header-actions">
          {/* The one primary toolbar action: a blank new diagram (guarded above). */}
          {!readOnly && <Tooltip surface={appearance} label="Create a blank diagram">
            <button
              type="button"
              data-testid="header-new"
              aria-label="New"
              onClick={handleNewClick}
              className="editor-button editor-button--primary editor-document-new"
            >
              <PlusIcon />
              <span className="editor-button-label">New</span>
            </button>
          </Tooltip>
          }
          <Tooltip surface={appearance} label="Fork: create an independent copy">
            <button
              type="button"
              data-testid="header-fork"
              aria-label="Fork"
              onClick={onFork}
              className="editor-button editor-button--secondary editor-document-fork"
            >
              <ForkIcon />
              <span className="editor-button-label">Fork</span>
            </button>
          </Tooltip>
          <div className="editor-document-share">{actions}</div>
          <Tooltip surface={appearance} label="Present this diagram full-screen">
            {/* Below md the label collapses to icon-only; aria-label keeps the name. */}
            <button
              type="button"
              data-testid="header-present"
              aria-label="Present"
              onClick={onPresent}
              className="editor-button editor-button--secondary editor-document-present"
            >
              <PlayIcon />
              <span className="editor-button-label">Present</span>
            </button>
          </Tooltip>
        </div>

        <div className="editor-global-actions">
          {onToggleAppearance && (
            <Tooltip surface={appearance} label={darkAppearance ? 'Switch to light appearance' : 'Switch to dark appearance'}>
              <button
                type="button"
                data-testid="header-appearance"
                aria-label={darkAppearance ? 'Switch to light appearance' : 'Switch to dark appearance'}
                onClick={onToggleAppearance}
                className="editor-icon-button editor-appearance-toggle"
              >
                {darkAppearance ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
              </button>
            </Tooltip>
          )}

          <div className="editor-global-account">
            {user ? (
              <ProfileMenu
                surface={appearance}
                user={user}
                onLogout={onLogout}
                subscribed={subscribed}
                planType={planType}
                paymentEnabled={paymentEnabled}
                onUpgrade={onUpgrade}
                onManagePlan={onManagePlan}
                onOpenPricing={onOpenPricing}
                menuClassName="editor-hifi-menu"
              />
            ) : (
              // Signed out: Pricing is a small link inside the sign-in dialog.
              <Tooltip surface={appearance} label="Sign in to save and sync across devices">
                <button
                  type="button"
                  data-testid="header-login"
                  onClick={() => setLoginOpen(true)}
                  className="editor-button editor-button--secondary editor-sign-in"
                >
                  Sign in
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </header>
      {!readOnly && (saveError || syncPending || cloudWithheld) && (
        <div className="editor-save-feedback" role={saveError ? 'alert' : 'status'}>
          <span>{saveError ? 'Couldn’t save. Your edits are still here.' : cloudWithheld ? 'Saved locally. Cloud save is paused at your plan limit.' : 'Saved locally. Cloud sync is pending.'}</span>
          <button type="button" onClick={onRetrySave} disabled={saving} className="ring-draft underline">
            {saveError ? 'Retry save' : 'Retry sync'}
          </button>
        </div>
      )}

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLogin={onLogin}
        lastProvider={lastProvider}
        error={loginError}
        pendingProvider={pendingProvider}
        onOpenPricing={
          openPricing &&
          (() => {
            setLoginOpen(false);
            openPricing();
          })
        }
      />

      {/* #8: discard-unsaved-changes guard for "New". */}
      <ConfirmDialog
        open={confirmNewOpen}
        onOpenChange={setConfirmNewOpen}
        title="Discard unsaved changes?"
        message="Your current diagram has unsaved edits."
        confirmLabel="Discard & start new"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={onNew}
      />
    </>
  );
}

// Quiet auto-save indicator. One element, one testid; the variant is reported via
// `data-state` so tests assert the exact state, not brittle text.
function SaveState({
  readOnly,
  signedIn,
  savedLocally,
  saving,
  dirty,
  saveError,
  syncPending,
  cloudConfirmed,
  unsavedCount,
}: {
  readOnly: boolean;
  signedIn: boolean;
  savedLocally: boolean;
  saving: boolean;
  dirty: boolean;
  saveError: boolean;
  syncPending: boolean;
  cloudConfirmed: boolean;
  unsavedCount: number;
}) {
  // Precedence (no false claims):
  // - readOnly: no save happens → "Read-only".
  // - Saving… → Unsaved (dirty) → saved. Signed-out saves go to this device only,
  //   so the clean signed-out state reads "Saved locally", never a cloud "Saved".
  //   A signed-out diagram not yet written to this device reads "Local only".
  const state: 'readonly' | 'local' | 'local-new' | 'saving' | 'dirty' | 'saved' | 'error' | 'queued' | 'unknown' = readOnly
    ? 'readonly'
    : saving
      ? 'saving'
      : saveError
        ? 'error'
      : dirty
        ? 'dirty'
        : syncPending
          ? 'queued'
        : signedIn && cloudConfirmed
          ? 'saved'
          : savedLocally
            ? 'local'
            : signedIn ? 'unknown' : 'local-new';

  const label = {
    readonly: 'Read-only',
    unknown: 'Cloud status unknown',
    error: 'Save failed',
    queued: 'Saved locally · Sync pending',
    saving: 'Saving…',
    dirty: 'Unsaved',
    saved: 'Saved',
    local: 'Saved locally',
    'local-new': 'Local only',
  }[state];

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="header-savestate"
      data-state={state}
      className="editor-save-state"
      aria-label={
        state === 'dirty'
          ? unsavedCount > 0
            ? `${unsavedCount} unsaved change${unsavedCount === 1 ? '' : 's'}`
            : 'Unsaved changes'
          : undefined
      }
    >
      <span className="editor-save-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
