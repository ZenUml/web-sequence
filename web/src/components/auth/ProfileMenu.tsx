import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from '../../ui';
import type { AppUser } from '../../domain/types';

export interface ProfileMenuProps {
  user: AppUser;
  onLogout(): void;
}

function Avatar({ user }: { user: AppUser }) {
  const initial = (user.displayName ?? user.email ?? '?')[0].toUpperCase();
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName ?? user.email ?? 'User avatar'}
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white text-[12px] font-medium select-none">
      {initial}
    </span>
  );
}

export function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          data-testid="profile-trigger"
          aria-label={`Account menu for ${user.displayName ?? user.email ?? 'user'}`}
          className="flex items-center justify-center rounded-full ring-draft focus-visible:outline-none transition-opacity duration-150 hover:opacity-80"
          type="button"
        >
          <Avatar user={user} />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{user.email ?? user.displayName ?? 'Account'}</MenuLabel>
        <MenuSeparator />
        <MenuItem
          data-testid="profile-logout"
          onSelect={onLogout}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
