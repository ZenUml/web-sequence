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

  it('chips the multicolor Google glyph on a white background when elevated', () => {
    // Google keeps fixed brand fills; on the cobalt primary button it must sit on
    // a white chip so it doesn't clash/vanish. Discriminating: dropping the chip
    // treatment fails here.
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} lastProvider="google" />);
    const glyph = screen.getByTestId('login-google-glyph');
    expect(glyph).toHaveAttribute('data-chip', 'true');
    expect(glyph.className).toContain('bg-white');
  });

  it('does not chip the Google glyph at rest (no lastProvider)', () => {
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} />);
    const glyph = screen.getByTestId('login-google-glyph');
    expect(glyph).not.toHaveAttribute('data-chip');
    expect(glyph.className).not.toContain('bg-white');
  });

  it('does not chip a currentColor glyph when it is the elevated provider', () => {
    // GitHub is currentColor and inherits the cobalt button's white text — no chip
    // needed. Only the multicolor Google exception gets a chip.
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} lastProvider="github" />);
    const glyph = screen.getByTestId('login-github-glyph');
    expect(glyph).not.toHaveAttribute('data-chip');
    expect(glyph.className).not.toContain('bg-white');
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

  it('styles the error notice with the danger token, not caution amber', () => {
    // An auth failure is danger, not caution. Discriminating: reverting to
    // signal-amber fails both assertions.
    render(
      <LoginModal open onOpenChange={() => {}} onLogin={() => {}} error="Sign-in failed." />,
    );
    const notice = screen.getByTestId('login-error');
    expect(notice.className).toContain('danger');
    expect(notice.className).not.toContain('signal-amber');
  });

  it('renders no error notice when error is absent', () => {
    render(<LoginModal open onOpenChange={() => {}} onLogin={() => {}} />);
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });
});
