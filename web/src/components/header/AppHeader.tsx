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
            onClick={onNew}
          >
            New
          </Button>

          <Button
            variant="subtle"
            size="sm"
            data-testid="header-fork"
            onClick={onFork}
          >
            Fork
          </Button>

          {/* Save with optional unsaved dot */}
          <div className="relative">
            <Button
              variant="primary"
              size="sm"
              data-testid="header-save"
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
              variant="primary"
              size="sm"
              data-testid="header-login"
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
    </>
  );
}
