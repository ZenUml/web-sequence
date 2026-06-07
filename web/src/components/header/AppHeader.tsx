import { useState, type ReactNode } from 'react';
import {
  Button,
  TextInput,
  cn,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from '../../ui';
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

export function AppHeader({
  title,
  unsavedCount,
  user,
  lastProvider,
  readOnly = false,
  onTitleChange,
  onNew,
  onSave,
  onFork,
  onLogin,
  onLogout,
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
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const handleNewClick = () => {
    if (unsavedCount > 0) setConfirmNewOpen(true);
    else onNew();
  };

  return (
    <>
      <header className="bg-blueprint border-b border-ink-line/40 h-12 px-3 flex items-center gap-2">
        {/* Brand */}
        <span className="font-serif text-[15px] text-ondark-strong shrink-0 select-none">
          ZenUML
        </span>

        {/* Editable title */}
        <TextInput
          surface="dark"
          value={title}
          data-testid="header-title"
          aria-label="Diagram title"
          readOnly={readOnly}
          className="flex-1 min-w-0 font-sans"
          onChange={(e) => onTitleChange(e.target.value)}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {actions}
          <Button
            variant="ghost"
            size="sm"
            data-testid="header-new"
            title="Start a new blank diagram"
            onClick={handleNewClick}
          >
            New
          </Button>

          <Button
            variant="subtle"
            size="sm"
            data-testid="header-fork"
            title="Make an editable copy of this diagram"
            onClick={onFork}
          >
            Duplicate
          </Button>

          {/* Save with optional unsaved dot. When readOnly the button is disabled,
              and a disabled button has pointer-events:none so its own `title` never
              fires — carry the explanation on the wrapping span (which keeps pointer
              events) so a read-only Save isn't a silent dead control. */}
          <div
            className="relative inline-flex"
            title={readOnly ? 'This is a read-only diagram — duplicate it to make edits you can save' : undefined}
          >
            <Button
              variant="primary"
              size="sm"
              data-testid="header-save"
              title={readOnly ? undefined : 'Save this diagram'}
              onClick={onSave}
              disabled={readOnly}
            >
              Save
            </Button>
            {unsavedCount > 0 && (
              <span
                data-testid="header-unsaved-dot"
                className={cn(
                  'absolute -top-1 -right-1 h-2 w-2 rounded-full bg-signal-amber',
                  'pointer-events-none',
                )}
                aria-label={`${unsavedCount} unsaved change${unsavedCount === 1 ? '' : 's'}`}
              />
            )}
          </div>

          {/* Overflow menu: less-frequent modal triggers (keeps the header calm). */}
          <Menu>
            <MenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                data-testid="header-menu"
                aria-label="More actions"
              >
                &#8943;
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem data-testid="header-create-new" onSelect={() => onOpenCreateNew?.()}>
                New from template…
              </MenuItem>
              <MenuItem data-testid="header-settings" onSelect={() => onOpenSettings?.()}>
                Settings
              </MenuItem>
              {paymentEnabled && (
                <MenuItem data-testid="header-pricing" onSelect={() => onOpenPricing?.()}>
                  Pricing
                </MenuItem>
              )}
              <MenuItem data-testid="header-cheatsheet" onSelect={() => onOpenCheatSheet?.()}>
                DSL cheat sheet
              </MenuItem>
              <MenuItem data-testid="header-shortcuts" onSelect={() => onOpenShortcuts?.()}>
                Keyboard shortcuts
              </MenuItem>
              <MenuItem data-testid="header-help" onSelect={() => onOpenHelp?.()}>
                Help
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>

        {/* Auth section */}
        <div className="ml-1 shrink-0">
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
            <Button
              // #3: Save is the single cobalt primary in the header. Sign in stays
              // clearly clickable but quiet (subtle) so only one accent signal competes
              // for attention.
              variant="subtle"
              size="sm"
              data-testid="header-login"
              title="Sign in to save and sync across devices"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </Button>
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
