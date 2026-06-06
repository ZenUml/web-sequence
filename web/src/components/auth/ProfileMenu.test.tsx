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
});
