import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal, type LoginModalProps } from './LoginModal';

function setup(over: Partial<LoginModalProps> = {}) {
  const props: LoginModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    onLogin: vi.fn(),
    ...over,
  };
  const utils = render(<LoginModal {...props} />);
  return { props, ...utils };
}

const providerButtons = () => screen.getAllByTestId(/^login-(google|github|facebook|twitter)$/);

describe('LoginModal — providers', () => {
  it('shows only Google and GitHub, in that order', () => {
    setup();
    expect(providerButtons().map((b) => b.getAttribute('data-testid'))).toEqual(['login-google', 'login-github']);
    expect(screen.getByTestId('login-google')).toHaveTextContent('Continue with Google');
    expect(screen.getByTestId('login-github')).toHaveTextContent('Continue with GitHub');
  });

  it('offers no Facebook, Twitter, email/password, Microsoft or Apple entry', () => {
    setup({ lastProvider: 'facebook' });
    const dialog = screen.getByRole('dialog');
    for (const word of [/facebook/i, /twitter/i, /password/i, /e-?mail/i, /microsoft/i, /apple/i]) {
      expect(dialog.textContent).not.toMatch(word);
    }
    expect(dialog.querySelector('input')).toBeNull();
  });

  it('keeps the fixed order and equal weight when GitHub was last used', () => {
    setup({ lastProvider: 'github' });
    const [google, github] = providerButtons();
    expect(google).toHaveAttribute('data-testid', 'login-google');
    expect(github).toHaveAttribute('data-testid', 'login-github');
    expect(google.className).toBe(github.className);
  });

  it.each(['google', 'github'] as const)('clicking %s calls onLogin with the raw provider id', async (id) => {
    const { props } = setup();
    await userEvent.click(screen.getByTestId(`login-${id}`));
    expect(props.onLogin).toHaveBeenCalledWith(id);
  });

  it('glyphs are decorative; GitHub uses currentColor, Google keeps brand colours', () => {
    setup();
    const g = screen.getByTestId('login-google-glyph').querySelector('svg')!;
    const gh = screen.getByTestId('login-github-glyph').querySelector('svg')!;
    expect(g).toHaveAttribute('aria-hidden', 'true');
    expect(gh).toHaveAttribute('aria-hidden', 'true');
    expect(gh.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    expect([...g.querySelectorAll('path')].map((p) => p.getAttribute('fill'))).toEqual([
      '#EA4335', '#4285F4', '#FBBC05', '#34A853',
    ]);
  });

  it('has the title and explanation', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Sign in to ZenUML');
    expect(screen.getByText('Save and sync your diagrams across devices.')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByTestId('login-google')).not.toBeInTheDocument();
  });
});

describe('LoginModal — last used', () => {
  it.each([
    ['google', 'Last used: Google'],
    ['GitHub', 'Last used: GitHub'],
  ])('lastProvider=%s shows "%s" below the buttons', (raw, text) => {
    setup({ lastProvider: raw });
    const id = raw.toLowerCase();
    expect(screen.getByTestId(`login-${id}-lastused`)).toHaveTextContent(text);
  });

  it.each(['facebook', 'twitter', 'password', '', null])('ignores unsupported last provider %s', (raw) => {
    setup({ lastProvider: raw });
    expect(screen.queryByText(/Last used/)).toBeNull();
  });
});

describe('LoginModal — pending (controlled by useAuth)', () => {
  it.each([
    ['google', 'Google'],
    ['github', 'GitHub'],
  ] as const)('pending %s: "Signing in…", window instruction, both buttons disabled', (id, label) => {
    setup({ pendingProvider: id, lastProvider: 'google' });
    const pendingBtn = screen.getByTestId(`login-${id}`);
    expect(pendingBtn).toHaveTextContent('Signing in…');
    expect(pendingBtn).toHaveAttribute('aria-busy', 'true');
    for (const b of providerButtons()) expect(b).toBeDisabled();
    expect(screen.getByTestId('login-pending')).toHaveTextContent(`Complete sign-in in the ${label} window.`);
    // The pending instruction replaces the last-used note.
    expect(screen.queryByText(/Last used/)).toBeNull();
  });

  it('a click while pending does not call onLogin', async () => {
    const { props } = setup({ pendingProvider: 'google' });
    await userEvent.click(screen.getByTestId('login-github'), { pointerEventsCheck: 0 });
    expect(props.onLogin).not.toHaveBeenCalled();
  });

  it('close stays available while pending (close button + Escape)', async () => {
    const { props } = setup({ pendingProvider: 'google' });
    expect(screen.getByLabelText('Close')).toBeEnabled();
    await userEvent.keyboard('{Escape}');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('two clicks in the same tick submit once even before the parent re-renders', () => {
    const onLogin = vi.fn();
    setup({ pendingProvider: null, onLogin });
    act(() => {
      screen.getByTestId('login-google').click();
      screen.getByTestId('login-github').click();
    });
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledWith('google');
  });
});

describe('LoginModal — pending (uncontrolled, from the onLogin promise)', () => {
  function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  it('double click submits once; pending clears after the promise settles', async () => {
    const d = deferred();
    const onLogin = vi.fn(() => d.promise);
    setup({ onLogin });
    act(() => {
      screen.getByTestId('login-github').click();
      screen.getByTestId('login-github').click();
    });
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-github')).toHaveTextContent('Signing in…');
    await act(async () => { d.reject(new Error('popup closed')); await d.promise.catch(() => {}); });
    expect(screen.getByTestId('login-github')).toHaveTextContent('Continue with GitHub');
    expect(screen.getByTestId('login-github')).toBeEnabled();
  });

  it('closing abandons the attempt: reopening is not pending even if the old promise settles later', async () => {
    const d = deferred();
    const onLogin = vi.fn(() => d.promise);
    const { rerender, props } = setup({ onLogin });
    act(() => { screen.getByTestId('login-google').click(); });
    rerender(<LoginModal {...props} onLogin={onLogin} open={false} />);
    rerender(<LoginModal {...props} onLogin={onLogin} open />);
    expect(screen.getByTestId('login-google')).toHaveTextContent('Continue with Google');
    // A new attempt can start while the abandoned one is still unsettled.
    const d2 = deferred();
    onLogin.mockReturnValueOnce(d2.promise);
    act(() => { screen.getByTestId('login-github').click(); });
    expect(onLogin).toHaveBeenCalledTimes(2);
    await act(async () => { d.resolve(); await d.promise; });
    // The stale settle did not clear the new attempt's pending state.
    expect(screen.getByTestId('login-github')).toHaveTextContent('Signing in…');
    await act(async () => { d2.resolve(); await d2.promise; });
  });
});

describe('LoginModal — failure', () => {
  it('shows the inline actionable error with both providers still available', () => {
    setup({ error: "Couldn't sign in. Try again or use GitHub.", lastProvider: 'google' });
    const err = screen.getByTestId('login-error');
    expect(err).toHaveAttribute('role', 'alert');
    expect(err).toHaveTextContent("Couldn't sign in. Try again or use GitHub.");
    expect(err.className).toContain('af-note--error');
    for (const b of providerButtons()) expect(b).toBeEnabled();
    // The error replaces the last-used note.
    expect(screen.queryByText(/Last used/)).toBeNull();
  });

  it('pending wins over a stale error', () => {
    setup({ error: 'old failure', pendingProvider: 'google' });
    expect(screen.queryByTestId('login-error')).toBeNull();
    expect(screen.getByTestId('login-pending')).toBeInTheDocument();
  });

  it('no error notice when error is absent', () => {
    setup();
    expect(screen.queryByTestId('login-error')).toBeNull();
  });
});

describe('LoginModal — dialog behaviour', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Sign in</button>
        <LoginModal open={open} onOpenChange={setOpen} onLogin={() => {}} />
      </>
    );
  }

  it('moves focus into the dialog, closes on Escape and restores focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('restores focus to the opener of each opening (two different triggers)', async () => {
    function TwoTriggers() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Header sign in</button>
          <button onClick={() => setOpen(true)}>Save prompt sign in</button>
          <LoginModal open={open} onOpenChange={setOpen} onLogin={() => {}} />
        </>
      );
    }
    render(<TwoTriggers />);
    for (const name of ['Header sign in', 'Save prompt sign in']) {
      const trigger = screen.getByRole('button', { name });
      await userEvent.click(trigger);
      await screen.findByRole('dialog');
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  });

  it('Tab stays inside the dialog (focus trap)', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog');
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('uses the scoped account-flow shell with a labelled close', () => {
    setup();
    expect(screen.getByRole('dialog').className).toContain('af-dialog');
    expect(screen.getByLabelText('Close').className).toContain('af-close');
  });
});
