import { useRef, useState, type ReactNode } from 'react';
import {
  Button,
  TextInput,
  cn,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  Tooltip,
} from '../../ui';
import { AppMenu } from './AppMenu';
import { LoginModal } from '../auth/LoginModal';
import { ProfileMenu } from '../auth/ProfileMenu';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import type { AppUser, PlanType } from '../../domain/types';
import type { ProviderName } from '../../services/types';

export interface AppHeaderProps {
  title: string;
  unsavedCount: number;
  user: AppUser | null;
  lastProvider?: string | null;
  readOnly?: boolean;
  onTitleChange(t: string): void;
  onNew(): void;
  onSave(): void;
  onFork(): void;
  onLogin(provider: ProviderName): void;
  onLogout(): void;
  // Auto-save state. Save is now a pure indicator (the Save button is gone, ⌘S +
  // the app-menu Save item remain). `saving` is true while a save is in flight;
  // `dirty` is the unsaved state (covers content AND metadata edits like rename/page
  // ops, which `unsavedCount` does not); clean + signed-in is "Saved". `unsavedCount`
  // is kept only for the precise count in the indicator's aria-label.
  dirty?: boolean;
  saving?: boolean;
  // Present mode (the old Fullscreen) now lives top-right next to Share.
  onPresent(): void;
  // M04 modal triggers (optional so existing AppHeader tests render without them).
  onOpenSettings?(): void;
  onOpenCreateNew?(): void;
  onOpenHelp?(): void;
  onOpenPricing?(): void;
  onOpenCheatSheet?(): void;
  onOpenShortcuts?(): void;
  // M04 subscription/profile state (forwarded to ProfileMenu). All optional.
  subscribed?: boolean;
  planType?: PlanType;
  paymentEnabled?: boolean;
  onUpgrade?(): void;
  onManagePlan?(): void;
  // OAuth error surfaced inside the LoginModal (roadmap §9 carry-forward).
  loginError?: string | null;
  // Optional CONTROLLED login-modal state so other surfaces (e.g. the anonymous
  // custom-CSS gate in AppRoot) can open sign-in. When omitted, AppHeader manages
  // it with internal state (existing-test compatibility).
  loginOpen?: boolean;
  onLoginOpenChange?(open: boolean): void;
  // Optional extra action(s) rendered in the header's action group (e.g. ShareButton).
  // Kept optional so existing AppHeader tests render without it.
  actions?: ReactNode;
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={cn('h-3.5 w-3.5', className)}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className="h-[15px] w-[15px]"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
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
  onSave,
  onFork,
  onLogin,
  onLogout,
  saving = false,
  onPresent,
  onOpenSettings,
  onOpenCreateNew,
  onOpenHelp,
  onOpenPricing,
  onOpenCheatSheet,
  onOpenShortcuts,
  subscribed = false,
  planType = 'free',
  paymentEnabled = false,
  onUpgrade,
  onManagePlan,
  loginError,
  loginOpen: loginOpenProp,
  onLoginOpenChange,
  actions,
}: AppHeaderProps) {
  const [loginOpenInternal, setLoginOpenInternal] = useState(false);
  // Controlled when the parent supplies loginOpen/onLoginOpenChange; else internal.
  const loginOpen = loginOpenProp ?? loginOpenInternal;
  const setLoginOpen = (o: boolean) => {
    if (onLoginOpenChange) onLoginOpenChange(o);
    else setLoginOpenInternal(o);
  };

  // #8: guard "New" against data loss. With unsaved edits, New first asks the user
  // to confirm discarding them; only on confirm does onNew() fire. With a clean
  // diagram (unsavedCount === 0) New is immediate (no friction for the common case).
  // This guarded handler is shared with the app menu's New item.
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const handleNewClick = () => {
    if (unsavedCount > 0) setConfirmNewOpen(true);
    else onNew();
  };

  // Rename (document menu) focuses the inline title field — the name itself is the
  // editor, the menu item is just an accelerator to it.
  const titleRef = useRef<HTMLInputElement>(null);
  // Rename should land focus on the title field. Radix restores focus to the menu
  // trigger on close (onCloseAutoFocus), which would beat any focus() we call from
  // onSelect. So we flag the intent and redirect focus in onCloseAutoFocus itself,
  // preventing the default trigger-restore. (Canonical Radix pattern.)
  const renameIntent = useRef(false);
  const handleDocMenuCloseAutoFocus = (e: Event) => {
    if (!renameIntent.current) return;
    renameIntent.current = false;
    e.preventDefault();
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.select();
  };

  return (
    <>
      <header className="bg-blueprint border-b border-ink-line/40 h-14 px-3 md:px-4 flex items-center gap-2 md:gap-3.5">
        {/* App menu — the logo brand button (▾). Holds New / New from template /
            Settings / Keyboard shortcuts / DSL cheat sheet / Help / Pricing / Save. */}
        <AppMenu
          onNew={handleNewClick}
          onOpenCreateNew={onOpenCreateNew}
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
          onOpenCheatSheet={onOpenCheatSheet}
          onOpenHelp={onOpenHelp}
          onOpenPricing={onOpenPricing}
          onSave={onSave}
          paymentEnabled={paymentEnabled}
        />

        {/* File menu — inline-editable filename + a chevron opening the document
            menu (Rename / Duplicate). The name + chevron sit together in a quiet
            pill (.filemenu) so "this is the file and its actions" reads as a unit. */}
        <div
          className={cn(
            'flex items-center gap-1.5 min-w-0 rounded-lg pl-2.5 pr-1 py-1',
            'bg-ink-700/45 border border-ink-line/50',
          )}
        >
          <TextInput
            ref={titleRef}
            surface="dark"
            value={title}
            data-testid="header-title"
            aria-label="Diagram title"
            readOnly={readOnly}
            // .fname: quiet until hover/focus — transparent fill + borderless until
            // the field is engaged, so the title reads as text, not a form control.
            className={cn(
              'min-w-0 max-w-[220px] h-7 bg-transparent border-transparent font-sans font-medium',
              'text-[14px] text-ondark-strong',
              'hover:bg-ink-800/60 focus:bg-ink-800 focus:border-ink-line/50',
            )}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                data-testid="filemenu-trigger"
                aria-label="Document menu"
                className={cn(
                  'grid place-items-center h-6 w-6 shrink-0 rounded',
                  'text-ondark-muted hover:text-ondark-strong hover:bg-white/5',
                  'transition-colors duration-150 ease-draft ring-draft',
                )}
              >
                <Chevron />
              </button>
            </MenuTrigger>
            <MenuContent align="start" onCloseAutoFocus={handleDocMenuCloseAutoFocus}>
              <MenuItem
                data-testid="filemenu-rename"
                onSelect={() => {
                  renameIntent.current = true;
                }}
              >
                Rename
              </MenuItem>
              <MenuItem data-testid="filemenu-duplicate" onSelect={onFork}>
                Duplicate
              </MenuItem>
              {/* Export / Move to trash — document-domain but need plumbing not
                  present in Phase 1. Phase 3. */}
            </MenuContent>
          </Menu>
        </div>

        {/* Auto-save state (.savestate) — sits left of the right-hand action group.
            Never claims "Saved" when there is no real save target:
            - readOnly: no save happens, so show a neutral "Read-only" (no dirty/saving).
            - signed-out: auto-save is local-only, so show neutral "Local only".
            - saving: "Saving…"; dirty: amber "Unsaved"; otherwise emerald "Saved". */}
        <SaveState
          readOnly={readOnly}
          signedIn={!!user}
          saving={saving}
          dirty={dirty ?? unsavedCount > 0}
          unsavedCount={unsavedCount}
        />

        <div className="flex-1" />

        {/* Top-right: the only shared verbs. Share (via actions) · Present · divider ·
            account. Three jobs, clear order. */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {actions}
          <Tooltip label="Present this diagram full-screen">
            {/* Below md the label collapses to icon-only to avoid clipping. The
                accessible name persists via aria-label so the control is never
                an unlabelled icon. This is CSS-only (Tailwind responsive); no JS
                media query touches the header. */}
            <Button
              variant="subtle"
              size="md"
              data-testid="header-present"
              aria-label="Present"
              onClick={onPresent}
            >
              <PlayIcon />
              <span className="hidden md:inline">Present</span>
            </Button>
          </Tooltip>

          <div
            aria-hidden="true"
            data-testid="header-account-divider"
            className="mx-0.5 h-6 w-px bg-ink-line/50 shrink-0"
          />

          {user ? (
            <ProfileMenu
              user={user}
              onLogout={onLogout}
              subscribed={subscribed}
              planType={planType}
              paymentEnabled={paymentEnabled}
              onUpgrade={onUpgrade}
              onManagePlan={onManagePlan}
            />
          ) : (
            <Tooltip label="Sign in to save and sync across devices">
              <Button
                variant="subtle"
                size="md"
                data-testid="header-login"
                onClick={() => setLoginOpen(true)}
              >
                Sign in
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onLogin={onLogin}
        lastProvider={lastProvider}
        error={loginError}
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

// Quiet, mono, auto-save indicator. One element, one testid; the variant is
// reported via `data-state` so tests assert the exact state, not brittle text.
function SaveState({
  readOnly,
  signedIn,
  saving,
  dirty,
  unsavedCount,
}: {
  readOnly: boolean;
  signedIn: boolean;
  saving: boolean;
  dirty: boolean;
  unsavedCount: number;
}) {
  // Precedence (no false claims when there's no real save target):
  // - readOnly: no save happens → neutral "Read-only".
  // - signed-out: auto-save is local-only → neutral "Local only" (no Saving…/Unsaved
  //   flash, since there's no cloud sync to report).
  // - signed-in: Saving… → Unsaved (dirty) → Saved.
  const state: 'readonly' | 'local' | 'saving' | 'dirty' | 'saved' = readOnly
    ? 'readonly'
    : !signedIn
      ? 'local'
      : saving
        ? 'saving'
        : dirty
          ? 'dirty'
          : 'saved';

  const base =
    'inline-flex items-center gap-1.5 shrink-0 select-none font-mono ' +
    'text-[12.5px] tracking-[0.02em]';

  if (state === 'saving') {
    return (
      <span data-testid="header-savestate" data-state="saving" className={cn(base, 'text-ondark-faint')}>
        <span className="h-1.5 w-1.5 rounded-full bg-ondark-muted animate-pulse" aria-hidden="true" />
        Saving…
      </span>
    );
  }
  if (state === 'dirty') {
    return (
      <span data-testid="header-savestate" data-state="dirty" className={cn(base, 'text-signal-amber')}
        aria-label={
          unsavedCount > 0
            ? `${unsavedCount} unsaved change${unsavedCount === 1 ? '' : 's'}`
            : 'Unsaved changes'
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" aria-hidden="true" />
        Unsaved
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span data-testid="header-savestate" data-state="saved" className={cn(base, 'text-ondark-faint')}>
        <span className="text-ok">
          <CheckIcon />
        </span>
        Saved
      </span>
    );
  }
  if (state === 'local') {
    return (
      <span data-testid="header-savestate" data-state="local" className={cn(base, 'text-ondark-faint')}>
        Local only
      </span>
    );
  }
  // readonly
  return (
    <span data-testid="header-savestate" data-state="readonly" className={cn(base, 'text-ondark-faint')}>
      Read-only
    </span>
  );
}
