import { useState } from 'react';
import { Button, TextInput, cn } from '../../ui';
import { LoginModal } from '../auth/LoginModal';
import { ProfileMenu } from '../auth/ProfileMenu';
import type { AppUser } from '../../domain/types';
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
}: AppHeaderProps) {
  const [loginOpen, setLoginOpen] = useState(false);

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
          className="flex-1 min-w-0 font-sans"
          onChange={(e) => onTitleChange(e.target.value)}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
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
        </div>

        {/* Auth section */}
        <div className="ml-1 shrink-0">
          {user ? (
            <ProfileMenu user={user} onLogout={onLogout} />
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
      />
    </>
  );
}
