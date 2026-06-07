import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from './AppHeader';
import type { AppUser } from '../../domain/types';

// Pointer capture stubs for Radix dropdown (AppMenu / document menu / ProfileMenu).
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!window.scrollTo) {
    window.scrollTo = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const baseProps = {
  title: 'My Diagram',
  unsavedCount: 0,
  user: null,
  onTitleChange: vi.fn(),
  onNew: vi.fn(),
  onSave: vi.fn(),
  onFork: vi.fn(),
  onLogin: vi.fn(),
  onLogout: vi.fn(),
  onPresent: vi.fn(),
};

const mockUser: AppUser = {
  uid: 'uid-1',
  email: 'user@test.com',
  displayName: 'Jane Doe',
  photoURL: null,
};

// Radix leaves pointer-events:none on the page while a menu's overlay is mounted.
// Press Escape between successive menu opens so the next trigger click isn't
// blocked by a stale portal.
const closeMenu = () => userEvent.keyboard('{Escape}');

describe('AppHeader', () => {
  it('shows header-login when user is null', () => {
    render(<AppHeader {...baseProps} user={null} />);
    expect(screen.getByTestId('header-login')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-trigger')).not.toBeInTheDocument();
  });

  // Spec: signed-out shows a *subtle* "Sign in" button (not ghost). `subtle` emits
  // the ink-700 fill on the dark surface; `ghost` is transparent.
  it('header-login uses the subtle button variant', () => {
    render(<AppHeader {...baseProps} user={null} />);
    const login = screen.getByTestId('header-login');
    expect(login.className).toContain('bg-ink-700/70');
    expect(login.className).not.toContain('bg-transparent');
  });

  it('shows profile-trigger when user is set', () => {
    render(<AppHeader {...baseProps} user={mockUser} />);
    expect(screen.getByTestId('profile-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('header-login')).not.toBeInTheDocument();
  });

  // The standalone New/Duplicate/Save top-level buttons are gone — they retired
  // into the app menu (logo ▾) and document menu (filename ▾).
  it('no longer renders the retired top-level New/Duplicate/Save buttons', () => {
    render(<AppHeader {...baseProps} />);
    expect(screen.queryByTestId('header-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-fork')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-save')).not.toBeInTheDocument();
  });

  // ---- App menu (logo brand ▾) ----

  it('app menu Save item calls onSave', async () => {
    const onSave = vi.fn();
    render(<AppHeader {...baseProps} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('app menu New fires onNew immediately when there are no unsaved changes', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} unsavedCount={0} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-new'));
    expect(onNew).toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-ok')).not.toBeInTheDocument();
  });

  // #8: guard "New" against data loss when there are unsaved edits.
  it('app menu New opens a discard-confirm (not onNew) when unsavedCount > 0', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-new'));
    expect(onNew).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Discard unsaved changes?');
    expect(screen.getByTestId('confirm-ok')).toBeInTheDocument();
  });

  it('app menu New confirm fires onNew; cancel does not', async () => {
    const onNew = vi.fn();
    const { rerender } = render(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);

    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-new'));
    await userEvent.click(await screen.findByTestId('confirm-cancel'));
    expect(onNew).not.toHaveBeenCalled();

    rerender(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-new'));
    await userEvent.click(await screen.findByTestId('confirm-ok'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('app menu triggers call their injected modal handlers', async () => {
    const onOpenSettings = vi.fn();
    const onOpenCreateNew = vi.fn();
    const onOpenHelp = vi.fn();
    render(
      <AppHeader
        {...baseProps}
        onOpenSettings={onOpenSettings}
        onOpenCreateNew={onOpenCreateNew}
        onOpenHelp={onOpenHelp}
      />,
    );
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-settings'));
    expect(onOpenSettings).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-create-new'));
    expect(onOpenCreateNew).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-help'));
    expect(onOpenHelp).toHaveBeenCalled();
  });

  it('app menu opens the cheat-sheet and shortcuts modals', async () => {
    const onOpenCheatSheet = vi.fn();
    const onOpenShortcuts = vi.fn();
    render(
      <AppHeader {...baseProps} onOpenCheatSheet={onOpenCheatSheet} onOpenShortcuts={onOpenShortcuts} />,
    );
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-cheatsheet'));
    expect(onOpenCheatSheet).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-shortcuts'));
    expect(onOpenShortcuts).toHaveBeenCalled();
  });

  // REQ-SUB-6: the Pricing trigger only exists when payment is enabled.
  it('shows app-menu Pricing only when paymentEnabled', async () => {
    const onOpenPricing = vi.fn();
    const { rerender } = render(
      <AppHeader {...baseProps} paymentEnabled={false} onOpenPricing={onOpenPricing} />,
    );
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.queryByTestId('app-menu-pricing')).not.toBeInTheDocument();
    await closeMenu();

    rerender(<AppHeader {...baseProps} paymentEnabled onOpenPricing={onOpenPricing} />);
    await userEvent.click(screen.getByTestId('app-menu-trigger'));
    await userEvent.click(await screen.findByTestId('app-menu-pricing'));
    expect(onOpenPricing).toHaveBeenCalled();
  });

  // ---- Document menu (filename ▾) ----

  it('document menu Duplicate calls onFork', async () => {
    const onFork = vi.fn();
    render(<AppHeader {...baseProps} onFork={onFork} />);
    await userEvent.click(screen.getByTestId('filemenu-trigger'));
    await userEvent.click(await screen.findByTestId('filemenu-duplicate'));
    expect(onFork).toHaveBeenCalled();
  });

  it('document menu Rename focuses the title field', async () => {
    render(<AppHeader {...baseProps} />);
    await userEvent.click(screen.getByTestId('filemenu-trigger'));
    await userEvent.click(await screen.findByTestId('filemenu-rename'));
    // Focus is deferred past the menu's close (Radix restores focus to its
    // trigger on close), so wait for the title to receive it.
    await waitFor(() => expect(screen.getByTestId('header-title')).toHaveFocus());
  });

  it('editing header-title calls onTitleChange', async () => {
    const onTitleChange = vi.fn();
    render(<AppHeader {...baseProps} onTitleChange={onTitleChange} />);
    const input = screen.getByTestId('header-title');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Title');
    expect(onTitleChange).toHaveBeenCalled();
  });

  // ---- Save-state indicator (replaces the Save button) ----

  it('shows "Saved" when clean and signed in', () => {
    render(<AppHeader {...baseProps} user={mockUser} unsavedCount={0} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'saved');
    expect(el).toHaveTextContent(/saved/i);
  });

  it('shows "Saving…" when saving is true (signed in)', () => {
    render(<AppHeader {...baseProps} user={mockUser} saving unsavedCount={3} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'saving');
    expect(el).toHaveTextContent(/saving/i);
  });

  it('shows amber "Unsaved" when there are unsaved changes', () => {
    render(<AppHeader {...baseProps} user={mockUser} unsavedCount={2} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'dirty');
    expect(el).toHaveTextContent(/unsaved/i);
    expect(el).toHaveAttribute('aria-label', '2 unsaved changes');
  });

  // Signed-out: auto-save is local-only — never claim a misleading "Saved".
  it('shows neutral "Local only" (not "Saved") when signed out and clean', () => {
    render(<AppHeader {...baseProps} user={null} unsavedCount={0} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'local');
    expect(el).toHaveTextContent(/local only/i);
    expect(el).not.toHaveTextContent(/saved/i);
  });

  // readOnly: no save happens — never show Saving/Unsaved.
  it('never shows Unsaved or Saving when readOnly (even with unsaved/saving)', () => {
    render(<AppHeader {...baseProps} user={mockUser} readOnly unsavedCount={5} saving />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'readonly');
    expect(el).not.toHaveTextContent(/saving/i);
    expect(el).not.toHaveTextContent(/unsaved/i);
  });

  // ---- Right group: Present + account ----

  it('Present button calls onPresent', async () => {
    const onPresent = vi.fn();
    render(<AppHeader {...baseProps} onPresent={onPresent} />);
    await userEvent.click(screen.getByTestId('header-present'));
    expect(onPresent).toHaveBeenCalled();
  });

  it('renders a divider separating the account zone from the action group', () => {
    render(<AppHeader {...baseProps} />);
    expect(screen.getByTestId('header-account-divider')).toBeInTheDocument();
  });

  it('renders injected actions (e.g. Share) in the right group', () => {
    render(<AppHeader {...baseProps} actions={<button data-testid="share-btn">Share</button>} />);
    expect(screen.getByTestId('share-btn')).toBeInTheDocument();
  });

  // ---- Login modal ----

  it('clicking header-login opens the login modal', async () => {
    render(<AppHeader {...baseProps} user={null} />);
    await userEvent.click(screen.getByTestId('header-login'));
    expect(await screen.findByTestId('login-google')).toBeInTheDocument();
  });

  it('clicking login-github inside open modal calls onLogin with github', async () => {
    const onLogin = vi.fn();
    render(<AppHeader {...baseProps} user={null} onLogin={onLogin} />);
    await userEvent.click(screen.getByTestId('header-login'));
    await userEvent.click(await screen.findByTestId('login-github'));
    expect(onLogin).toHaveBeenCalledWith('github');
  });

  it('forwards loginError into the LoginModal', async () => {
    render(<AppHeader {...baseProps} user={null} loginError="Sign-in failed" />);
    await userEvent.click(screen.getByTestId('header-login'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Sign-in failed');
  });
});
