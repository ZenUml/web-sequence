import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareVisitorStatus, type ShareVisitorStatusProps } from './ShareVisitorStatus';

function props(overrides: Partial<ShareVisitorStatusProps> = {}): ShareVisitorStatusProps {
  return {
    status: 'loading',
    onRetry: vi.fn(),
    appearance: 'light',
    onToggleAppearance: vi.fn(),
    onGoHome: vi.fn(),
    user: null,
    onLogout: vi.fn(),
    login: { open: false, onOpenChange: vi.fn(), onLogin: vi.fn() },
    ...overrides,
  };
}

describe('ShareVisitorStatus — loading', () => {
  it('announces loading politely and shows the pending title, not an invented one', () => {
    render(<ShareVisitorStatus {...props()} />);
    const root = screen.getByTestId('share-visitor-status');
    expect(root).toHaveAttribute('data-status', 'loading');
    expect(screen.getByTestId('share-status-title')).toHaveTextContent('Loading diagram…');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading diagram…');
    expect(status).toHaveTextContent('Fetching the shared diagram and its source.');
    expect(screen.getByTestId('share-visitor-body')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading source…')).toBeInTheDocument();
    expect(screen.getByTestId('share-source-skeleton')).toHaveAttribute('aria-hidden', 'true');
  });

  it('offers no document actions, editable title, page tabs, zoom or percentages', () => {
    render(<ShareVisitorStatus {...props()} />);
    expect(screen.queryByTestId('header-fork')).toBeNull();
    expect(screen.queryByTestId('header-present')).toBeNull();
    expect(screen.queryByTestId('header-title')).toBeNull(); // the editable title input
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByTestId('dsl-editor')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('keeps navigation, appearance and sign-in usable', async () => {
    const p = props();
    render(<ShareVisitorStatus {...p} />);
    await userEvent.click(screen.getByTestId('header-go-home'));
    expect(p.onGoHome).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('header-appearance'));
    expect(p.onToggleAppearance).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('header-login'));
    expect(p.login.onOpenChange).toHaveBeenCalledWith(true);
  });

  it('labels the appearance toggle by the persisted selection', () => {
    render(<ShareVisitorStatus {...props({ appearance: 'dark' })} />);
    expect(screen.getByTestId('header-appearance')).toHaveAttribute('aria-label', 'Switch to light appearance');
  });
});

describe('ShareVisitorStatus — retryable failure', () => {
  it('announces the failure as an alert with guidance and a neutral title', () => {
    render(<ShareVisitorStatus {...props({ status: 'retryable-error' })} />);
    expect(screen.getByTestId('share-visitor-status')).toHaveAttribute('data-status', 'retryable-error');
    expect(screen.getByTestId('share-status-title')).toHaveTextContent('Shared link');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load this diagram');
    expect(alert).toHaveTextContent('Check your connection and try again.');
    expect(screen.getByText('Source couldn’t be loaded.')).toBeInTheDocument();
    expect(screen.queryByTestId('share-source-skeleton')).toBeNull();
    expect(screen.getByTestId('share-visitor-body')).toHaveAttribute('aria-busy', 'false');
  });

  it('Try again is keyboard operable and calls onRetry', async () => {
    const p = props({ status: 'retryable-error' });
    render(<ShareVisitorStatus {...p} />);
    const retry = screen.getByRole('button', { name: 'Try again' });
    retry.focus();
    await userEvent.keyboard('{Enter}');
    expect(p.onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps focus sensible: retry → status region; failed again → Try again button', async () => {
    const p = props({ status: 'retryable-error' });
    const view = render(<ShareVisitorStatus {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    // The button unmounts while loading, so focus moves to the status panel, not <body>.
    view.rerender(<ShareVisitorStatus {...p} status="loading" />);
    expect(document.activeElement).toBe(screen.getByTestId('share-status-panel'));
    view.rerender(<ShareVisitorStatus {...p} status="retryable-error" />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }));
  });

  it('does not steal focus on the initial failure', () => {
    render(<ShareVisitorStatus {...props({ status: 'retryable-error' })} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('never renders technical error text, ids or tokens', () => {
    render(<ShareVisitorStatus {...props({ status: 'retryable-error' })} />);
    const text = screen.getByTestId('share-visitor-status').textContent ?? '';
    expect(text).not.toMatch(/token|500|503|error:|firestore|id=/i);
  });
});
