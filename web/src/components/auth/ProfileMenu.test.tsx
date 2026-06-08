import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileMenu } from './ProfileMenu';
import type { AppUser } from '../../domain/types';

// Radix DropdownMenu uses pointer events that jsdom doesn't implement.
// Stub the missing APIs so the trigger click opens the menu.
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

const mockUser: AppUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
};

describe('ProfileMenu', () => {
  it('renders the profile trigger button', () => {
    render(<ProfileMenu user={mockUser} onLogout={() => {}} />);
    expect(screen.getByTestId('profile-trigger')).toBeInTheDocument();
  });

  it('shows initial when no photoURL', () => {
    render(<ProfileMenu user={mockUser} onLogout={() => {}} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('shows avatar img when photoURL is set', () => {
    const userWithPhoto: AppUser = { ...mockUser, photoURL: 'https://example.com/avatar.jpg' };
    render(<ProfileMenu user={userWithPhoto} onLogout={() => {}} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('opens menu and profile-logout calls onLogout', async () => {
    const onLogout = vi.fn();
    render(<ProfileMenu user={mockUser} onLogout={onLogout} />);

    // Radix DropdownMenu requires the full pointer event sequence to open.
    const trigger = screen.getByTestId('profile-trigger');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(trigger);
    fireEvent.pointerUp(trigger, { button: 0 });
    fireEvent.click(trigger);

    // Wait for portal content to appear in the document
    const logoutItem = await screen.findByTestId('profile-logout');
    expect(logoutItem).toBeInTheDocument();

    // Trigger logout
    fireEvent.click(logoutItem);
    expect(onLogout).toHaveBeenCalled();
  });

  it('shows user email in the menu label after opening', async () => {
    render(<ProfileMenu user={mockUser} onLogout={() => {}} />);
    const trigger = screen.getByTestId('profile-trigger');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(trigger);
    fireEvent.pointerUp(trigger, { button: 0 });
    fireEvent.click(trigger);
    expect(await screen.findByText('test@example.com')).toBeInTheDocument();
  });

  function open(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(trigger);
    fireEvent.pointerUp(trigger, { button: 0 });
    fireEvent.click(trigger);
  }

  it('shows a Pro badge next to the avatar for subscribed users', () => {
    render(
      <ProfileMenu user={mockUser} onLogout={() => {}} subscribed planType="plus-monthly" paymentEnabled />,
    );
    expect(screen.getByTestId('pro-badge')).toBeInTheDocument();
  });

  it('shows no Pro badge for non-subscribed users', () => {
    render(<ProfileMenu user={mockUser} onLogout={() => {}} subscribed={false} paymentEnabled />);
    expect(screen.queryByTestId('pro-badge')).not.toBeInTheDocument();
  });

  it('shows "Upgrade plan" for a non-subscribed user and fires onUpgrade', async () => {
    const onUpgrade = vi.fn();
    render(
      <ProfileMenu user={mockUser} onLogout={() => {}} subscribed={false} paymentEnabled onUpgrade={onUpgrade} />,
    );
    open(screen.getByTestId('profile-trigger'));
    const item = await screen.findByTestId('profile-upgrade');
    fireEvent.click(item);
    expect(onUpgrade).toHaveBeenCalled();
    expect(screen.queryByTestId('profile-plan')).not.toBeInTheDocument();
  });

  it('shows "My Plan" for a subscribed user and fires onManagePlan', async () => {
    const onManagePlan = vi.fn();
    render(
      <ProfileMenu user={mockUser} onLogout={() => {}} subscribed planType="plus-monthly" paymentEnabled onManagePlan={onManagePlan} />,
    );
    open(screen.getByTestId('profile-trigger'));
    const item = await screen.findByTestId('profile-plan');
    expect(item).toHaveTextContent('plus-monthly');
    fireEvent.click(item);
    expect(onManagePlan).toHaveBeenCalled();
    expect(screen.queryByTestId('profile-upgrade')).not.toBeInTheDocument();
  });

  // DISCRIMINATING (REQ-SUB-6): when payment is disabled (extension hosts), NO
  // billing items appear regardless of subscription state.
  it('hides ALL billing items when paymentEnabled is false', async () => {
    render(
      <ProfileMenu user={mockUser} onLogout={() => {}} subscribed={false} paymentEnabled={false} onUpgrade={vi.fn()} />,
    );
    open(screen.getByTestId('profile-trigger'));
    await screen.findByTestId('profile-logout');
    expect(screen.queryByTestId('profile-upgrade')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-plan')).not.toBeInTheDocument();
  });

  it('falls back to "Anonymous Creator" when displayName is absent', async () => {
    const anon: AppUser = { ...mockUser, displayName: null };
    render(<ProfileMenu user={anon} onLogout={() => {}} />);
    open(screen.getByTestId('profile-trigger'));
    expect(await screen.findByText('Anonymous Creator')).toBeInTheDocument();
  });
});
