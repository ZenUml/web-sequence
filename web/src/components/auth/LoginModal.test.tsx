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

  it('renders a provider glyph on each button (decorative, aria-hidden)', () => {
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} />);
    for (const id of ['google', 'github', 'facebook', 'twitter']) {
      const btn = screen.getByTestId(`login-${id}`);
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      // Decorative: must not contribute to the accessible name.
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('elevates the lastProvider button as primary, others stay subtle', () => {
    // lastProvider arrives display-cased ("GitHub"); ids are lowercase.
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={() => {}} lastProvider="GitHub" />,
    );
    const elevated = screen.getByTestId('login-github');
    const other = screen.getByTestId('login-google');
    // Primary variant => cobalt accent fill. Discriminating: a regression that
    // either drops elevation OR makes everything primary fails this pair.
    expect(elevated.className).toContain('bg-accent');
    expect(other.className).not.toContain('bg-accent');
  });

  it('lists the lastProvider button first', () => {
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={() => {}} lastProvider="facebook" />,
    );
    const buttons = screen.getAllByTestId(/^login-(google|github|facebook|twitter)$/);
    expect(buttons[0]).toHaveAttribute('data-testid', 'login-facebook');
    // No duplicate testids from reordering.
    expect(screen.getAllByTestId('login-facebook')).toHaveLength(1);
  });

  it('no button is elevated when lastProvider is absent', () => {
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} />);
    for (const id of ['google', 'github', 'facebook', 'twitter']) {
      expect(screen.getByTestId(`login-${id}`).className).not.toContain('bg-accent');
    }
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
