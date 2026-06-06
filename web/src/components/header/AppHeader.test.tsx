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

  it('header-new calls onNew', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-new'));
    expect(onNew).toHaveBeenCalled();
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
});
