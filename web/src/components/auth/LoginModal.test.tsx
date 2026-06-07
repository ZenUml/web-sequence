import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from './LoginModal';

describe('LoginModal', () => {
  it('renders 4 provider buttons when open', () => {
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={() => {}} />,
    );
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
    expect(screen.getByTestId('login-github')).toBeInTheDocument();
    expect(screen.getByTestId('login-facebook')).toBeInTheDocument();
    expect(screen.getByTestId('login-twitter')).toBeInTheDocument();
  });

  it('clicking login-google calls onLogin with "google"', async () => {
    const onLogin = vi.fn();
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={onLogin} />,
    );
    await userEvent.click(screen.getByTestId('login-google'));
    expect(onLogin).toHaveBeenCalledWith('google');
  });

  it('shows lastProvider hint when provided', () => {
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={() => {}} lastProvider="GitHub" />,
    );
    expect(screen.getByText(/Last used: GitHub/i)).toBeInTheDocument();
  });

  it('does not render provider buttons when closed', () => {
    render(
      <LoginModal open={false} onOpenChange={() => {}} onLogin={() => {}} />,
    );
    expect(screen.queryByTestId('login-google')).not.toBeInTheDocument();
  });

  it('surfaces an OAuth error notice when error is provided', () => {
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={() => {}} error="Account exists with a different sign-in method." />,
    );
    expect(screen.getByTestId('login-error')).toHaveTextContent('Account exists');
  });

  it('renders no error notice when error is absent', () => {
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} />);
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });
});
