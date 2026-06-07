import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LimitReachedNotice, type LimitReachedNoticeProps } from './LimitReachedNotice';

function setup(over: Partial<LimitReachedNoticeProps> = {}) {
  const props: LimitReachedNoticeProps = {
    open: true,
    onOpenChange: vi.fn(),
    limit: 3,
    onUpgrade: vi.fn(),
    ...over,
  };
  render(<LimitReachedNotice {...props} />);
  return props;
}

describe('LimitReachedNotice', () => {
  it('shows the limit count in the notice copy', () => {
    setup({ limit: 3 });
    // The "N-diagram limit" copy lives in the dialog description; assert against
    // the rendered modal (the notice + its surrounding dialog content).
    const dialog = screen.getByTestId('limit-notice').closest('[role="dialog"]');
    expect(dialog?.textContent).toContain('3-diagram limit');
  });

  it('upgrade button calls onUpgrade and NOT onOpenChange', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('limit-upgrade'));
    expect(p.onUpgrade).toHaveBeenCalledTimes(1);
    // Upgrade must not double as a dismiss — the parent swaps to pricing.
    expect(p.onOpenChange).not.toHaveBeenCalled();
  });

  it('dismiss closes via onOpenChange(false) and does NOT call onUpgrade', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('limit-dismiss'));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
    expect(p.onUpgrade).not.toHaveBeenCalled();
  });

  it('the upgrade action is the primary Button', () => {
    setup();
    expect(screen.getByTestId('limit-upgrade').className).toContain('bg-accent');
  });
});
