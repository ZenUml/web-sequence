import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from './AppHeader';
import type { AppUser } from '../../domain/types';

// Pointer capture stubs for Radix dropdown (ProfileMenu inside AppHeader).
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
};

const mockUser: AppUser = {
  uid: 'uid-1',
  email: 'user@test.com',
  displayName: 'Jane Doe',
  photoURL: null,
};

describe('AppHeader', () => {
  it('shows header-login when user is null', () => {
    render(<AppHeader {...baseProps} user={null} />);
    expect(screen.getByTestId('header-login')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-trigger')).not.toBeInTheDocument();
  });

  it('shows profile-trigger when user is set', () => {
    render(<AppHeader {...baseProps} user={mockUser} />);
    expect(screen.getByTestId('profile-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('header-login')).not.toBeInTheDocument();
  });

  it('header-save calls onSave', async () => {
    const onSave = vi.fn();
    render(<AppHeader {...baseProps} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('header-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('header-new fires onNew immediately when there are no unsaved changes', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} unsavedCount={0} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-new'));
    expect(onNew).toHaveBeenCalled();
    // No confirm dialog should appear for a clean diagram.
    expect(screen.queryByTestId('confirm-ok')).not.toBeInTheDocument();
  });

  // #8: guard "New" against data loss when there are unsaved edits.
  it('header-new opens a discard-confirm (not onNew) when unsavedCount > 0', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-new'));
    // onNew must NOT fire yet — the confirm dialog gates it.
    expect(onNew).not.toHaveBeenCalled();
    // The discard-confirm dialog appears (heading + its confirm action). Title text
    // is rendered twice by Radix (visible Title + sr-only Description), so assert via
    // the dialog role + the unique confirm-ok testid rather than findByText.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Discard unsaved changes?');
    expect(screen.getByTestId('confirm-ok')).toBeInTheDocument();
  });

  it('header-new confirm fires onNew; cancel does not', async () => {
    const onNew = vi.fn();
    const { rerender } = render(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);

    // Open then cancel — onNew stays un-called.
    await userEvent.click(screen.getByTestId('header-new'));
    await userEvent.click(await screen.findByTestId('confirm-cancel'));
    expect(onNew).not.toHaveBeenCalled();

    // Re-open and confirm — now onNew fires exactly once.
    rerender(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-new'));
    await userEvent.click(await screen.findByTestId('confirm-ok'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('header-fork calls onFork', async () => {
    const onFork = vi.fn();
    render(<AppHeader {...baseProps} onFork={onFork} />);
    await userEvent.click(screen.getByTestId('header-fork'));
    expect(onFork).toHaveBeenCalled();
  });

  it('unsaved dot appears only when unsavedCount > 0', () => {
    const { rerender } = render(<AppHeader {...baseProps} unsavedCount={0} />);
    expect(screen.queryByTestId('header-unsaved-dot')).not.toBeInTheDocument();

    rerender(<AppHeader {...baseProps} unsavedCount={3} />);
    expect(screen.getByTestId('header-unsaved-dot')).toBeInTheDocument();
  });

  it('editing header-title calls onTitleChange', async () => {
    const onTitleChange = vi.fn();
    render(<AppHeader {...baseProps} onTitleChange={onTitleChange} />);
    const input = screen.getByTestId('header-title');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Title');
    expect(onTitleChange).toHaveBeenCalled();
  });

  it('clicking header-login opens the login modal', async () => {
    render(<AppHeader {...baseProps} user={null} />);
    await userEvent.click(screen.getByTestId('header-login'));
    // The modal should appear with provider buttons
    expect(await screen.findByTestId('login-google')).toBeInTheDocument();
  });

  it('save button is disabled when readOnly is true', () => {
    render(<AppHeader {...baseProps} readOnly />);
    expect(screen.getByTestId('header-save')).toBeDisabled();
  });

  it('clicking login-github inside open modal calls onLogin with github', async () => {
    const onLogin = vi.fn();
    render(<AppHeader {...baseProps} user={null} onLogin={onLogin} />);
    await userEvent.click(screen.getByTestId('header-login'));
    await userEvent.click(await screen.findByTestId('login-github'));
    expect(onLogin).toHaveBeenCalledWith('github');
  });

  it('overflow menu triggers call their injected handlers', async () => {
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
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-settings'));
    expect(onOpenSettings).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-create-new'));
    expect(onOpenCreateNew).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-help'));
    expect(onOpenHelp).toHaveBeenCalled();
  });

  it('overflow menu opens the cheat-sheet and shortcuts modals', async () => {
    const onOpenCheatSheet = vi.fn();
    const onOpenShortcuts = vi.fn();
    render(
      <AppHeader {...baseProps} onOpenCheatSheet={onOpenCheatSheet} onOpenShortcuts={onOpenShortcuts} />,
    );
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-cheatsheet'));
    expect(onOpenCheatSheet).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-shortcuts'));
    expect(onOpenShortcuts).toHaveBeenCalled();
  });

  // REQ-SUB-6: the Pricing trigger only exists when payment is enabled.
  it('shows header-pricing only when paymentEnabled', async () => {
    const onOpenPricing = vi.fn();
    const { rerender } = render(
      <AppHeader {...baseProps} paymentEnabled={false} onOpenPricing={onOpenPricing} />,
    );
    await userEvent.click(screen.getByTestId('header-menu'));
    expect(screen.queryByTestId('header-pricing')).not.toBeInTheDocument();
    // Close the menu (its overlay leaves pointer-events:none on the page) before
    // re-rendering, so the next trigger click isn't blocked by a stale portal.
    await userEvent.keyboard('{Escape}');

    rerender(<AppHeader {...baseProps} paymentEnabled onOpenPricing={onOpenPricing} />);
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-pricing'));
    expect(onOpenPricing).toHaveBeenCalled();
  });

  it('forwards loginError into the LoginModal', async () => {
    render(<AppHeader {...baseProps} user={null} loginError="Sign-in failed" />);
    await userEvent.click(screen.getByTestId('header-login'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Sign-in failed');
  });
});
