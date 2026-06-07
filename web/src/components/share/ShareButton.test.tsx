import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareButton } from './ShareButton';

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
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const base = {
  url: null,
  sharing: false,
  error: null,
  onShare: vi.fn(),
  onStop: vi.fn(),
  onCopy: vi.fn(),
};

describe('ShareButton', () => {
  it('renders a trigger and keeps the popover content closed by default', () => {
    render(<ShareButton {...base} />);
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
    // Content lives in a portal and is closed initially.
    expect(screen.queryByTestId('share-create')).not.toBeInTheDocument();
  });

  it('opens the SharePopover content when the trigger is clicked', async () => {
    render(<ShareButton {...base} />);
    await userEvent.click(screen.getByTestId('share-button'));
    expect(await screen.findByTestId('share-create')).toBeInTheDocument();
  });

  it('is disabled when disabled is true', () => {
    render(<ShareButton {...base} disabled />);
    expect(screen.getByTestId('share-button')).toBeDisabled();
  });

  // #4: a disabled Share must not be a SILENT dead control. The disabled button has
  // pointer-events:none, so the explanation lives on a hover-able wrapper span. A
  // disabled button with no reachable tooltip would regress the dead-control fix.
  it('exposes disabledReason on a hover-able wrapper when disabled', () => {
    render(<ShareButton {...base} disabled disabledReason="Read-only — duplicate to share" />);
    const btn = screen.getByTestId('share-button');
    const wrapper = btn.closest('[title]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute('title', 'Read-only — duplicate to share');
    // The reason carrier must NOT be the pointer-events:none button itself.
    expect(wrapper).not.toBe(btn);
  });

  it('is enabled by default', () => {
    render(<ShareButton {...base} />);
    expect(screen.getByTestId('share-button')).not.toBeDisabled();
  });

  // #4: signed-out click routes to auth instead of opening the popover.
  it('calls onRequireAuth and does NOT open the popover when requiresAuth', async () => {
    const onRequireAuth = vi.fn();
    render(<ShareButton {...base} requiresAuth onRequireAuth={onRequireAuth} />);
    await userEvent.click(screen.getByTestId('share-button'));
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    // Popover content must stay closed — the click was intercepted into auth.
    expect(screen.queryByTestId('share-create')).not.toBeInTheDocument();
  });

  it('opens the popover (no auth intercept) when requiresAuth is false', async () => {
    const onRequireAuth = vi.fn();
    render(<ShareButton {...base} onRequireAuth={onRequireAuth} />);
    await userEvent.click(screen.getByTestId('share-button'));
    expect(onRequireAuth).not.toHaveBeenCalled();
    expect(await screen.findByTestId('share-create')).toBeInTheDocument();
  });
});
