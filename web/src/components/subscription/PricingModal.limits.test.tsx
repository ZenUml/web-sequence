import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingModal } from './PricingModal';

// The pricing copy must follow the enforced limits (#916): change the constant
// and the copy changes with it.
vi.mock('../../config/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../config/constants')>()),
  FILE_LIMITS: { free: 7, basic: 42 },
}));

describe('PricingModal file-limit copy', () => {
  it('renders the Starter and Basic limits from FILE_LIMITS', () => {
    render(
      <PricingModal
        open
        onOpenChange={vi.fn()}
        currentPlanType="free"
        billingPeriod="monthly"
        onPeriodChange={vi.fn()}
        onUpgrade={vi.fn()}
        onContactEnterprise={vi.fn()}
      />,
    );
    const text = screen.getByTestId('pricing-modal').textContent ?? '';
    expect(text).toContain('Up to 7 saved diagram files');
    expect(text).toContain('Up to 42 saved diagram files');
    expect(text).not.toContain('Up to 3 saved diagram files');
    expect(text).toContain('Unlimited diagram files');
  });
});
