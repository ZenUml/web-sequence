import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from '../../ui';
import { ProBadge } from '../subscription/ProBadge';
import type { AppUser, PlanType } from '../../domain/types';

export interface ProfileMenuProps {
  user: AppUser;
  onLogout(): void;
  // REQ-SUB-7 / REQ-AC-3: subscription + billing affordances. All optional so
  // existing callers/tests render without them; billing items are additionally
  // gated by `paymentEnabled` (off on extension hosts — REQ-SUB-6).
  subscribed?: boolean;
  planType?: PlanType;
  paymentEnabled?: boolean;
  onUpgrade?(): void;
  onManagePlan?(): void;
  // Opens the informational plans dialog (not checkout). Payment-gated like the
  // billing items.
  onOpenPricing?(): void;
  // Extra class for the menu surface (the editor passes its themed menu class).
  menuClassName?: string;
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

export function ProfileMenu({
  user,
  onLogout,
  subscribed = false,
  planType = 'free',
  paymentEnabled = false,
  onUpgrade,
  onManagePlan,
  onOpenPricing,
  menuClassName,
}: ProfileMenuProps) {
  // REQ-AC-3: displayName fallback to "Anonymous Creator" when absent.
  const displayName = user.displayName ?? 'Anonymous Creator';
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          data-testid="profile-trigger"
          aria-label={`Account menu for ${user.displayName ?? user.email ?? 'user'}`}
          className="flex items-center gap-1.5 rounded-full ring-draft focus-visible:outline-none transition-opacity duration-150 hover:opacity-80"
          type="button"
        >
          <Avatar user={user} />
          {/* Pro badge alongside the avatar for subscribed users (REQ-SUB-7). */}
          {subscribed && <ProBadge planType={planType} />}
        </button>
      </MenuTrigger>
      <MenuContent className={menuClassName}>
        <MenuLabel>
          <span className="block text-ondark-strong">{displayName}</span>
          {user.email && (
            <span className="block text-[11px] font-normal text-ondark-muted normal-case tracking-normal">
              {user.email}
            </span>
          )}
        </MenuLabel>
        <MenuSeparator />
        {paymentEnabled && (
          <MenuItem data-testid="profile-pricing" onSelect={() => onOpenPricing?.()}>
            Pricing
          </MenuItem>
        )}
        {paymentEnabled && subscribed && (
          <MenuItem data-testid="profile-plan" onSelect={() => onManagePlan?.()}>
            My Plan ({planType})
          </MenuItem>
        )}
        {paymentEnabled && !subscribed && (
          <MenuItem data-testid="profile-upgrade" onSelect={() => onUpgrade?.()}>
            Upgrade plan
          </MenuItem>
        )}
        {paymentEnabled && <MenuSeparator />}
        <MenuItem data-testid="profile-logout" onSelect={onLogout}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
