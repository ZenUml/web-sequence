import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingModal, type PricingModalProps } from './PricingModal';
import type { PlanType } from '../../domain/types';

function setup(over: Partial<PricingModalProps> = {}) {
  const props: PricingModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentPlanType: 'free' as PlanType,
    billingPeriod: 'monthly',
    onPeriodChange: vi.fn(),
    onUpgrade: vi.fn(),
    onContactEnterprise: vi.fn(),
    ...over,
  };
  render(<PricingModal {...props} />);
  return props;
}

describe('PricingModal', () => {
  it('renders all four tiers (Starter/Basic/Plus/Enterprise)', () => {
    setup();
    const modal = screen.getByTestId('pricing-modal');
    expect(modal.textContent).toContain('Starter');
    expect(modal.textContent).toContain('Basic');
    expect(modal.textContent).toContain('Plus');
    expect(modal.textContent).toContain('Enterprise');
  });

  it('clicking the yearly toggle calls onPeriodChange("yearly")', () => {
    const p = setup({ billingPeriod: 'monthly' });
    fireEvent.click(screen.getByTestId('pricing-period-yearly'));
    expect(p.onPeriodChange).toHaveBeenCalledWith('yearly');
  });

  it('clicking the monthly toggle calls onPeriodChange("monthly")', () => {
    const p = setup({ billingPeriod: 'yearly' });
    fireEvent.click(screen.getByTestId('pricing-period-monthly'));
    expect(p.onPeriodChange).toHaveBeenCalledWith('monthly');
  });

  it('Basic upgrade composes the planType with the current period (monthly)', () => {
    const p = setup({ billingPeriod: 'monthly' });
    fireEvent.click(screen.getByTestId('pricing-upgrade-basic'));
    expect(p.onUpgrade).toHaveBeenCalledWith('basic-monthly');
  });

  it('Plus upgrade composes the planType with the current period (yearly)', () => {
    const p = setup({ billingPeriod: 'yearly' });
    fireEvent.click(screen.getByTestId('pricing-upgrade-plus'));
    expect(p.onUpgrade).toHaveBeenCalledWith('plus-yearly');
  });

  it('Enterprise calls onContactEnterprise and never onUpgrade', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('pricing-enterprise'));
    expect(p.onContactEnterprise).toHaveBeenCalledTimes(1);
    expect(p.onUpgrade).not.toHaveBeenCalled();
  });

  it('marks the current tier and renders no upgrade button for it', () => {
    setup({ currentPlanType: 'basic-monthly' });
    // Basic is current → its upgrade button must be gone...
    expect(screen.queryByTestId('pricing-upgrade-basic')).toBeNull();
    expect(screen.getByTestId('pricing-current-basic')).toBeTruthy();
    // ...while other paid tiers still offer upgrade.
    expect(screen.queryByTestId('pricing-upgrade-plus')).not.toBeNull();
  });

  it('the current tier is matched by family regardless of period (plus-yearly → Plus current)', () => {
    setup({ currentPlanType: 'plus-yearly', billingPeriod: 'monthly' });
    expect(screen.queryByTestId('pricing-upgrade-plus')).toBeNull();
    expect(screen.getByTestId('pricing-current-plus')).toBeTruthy();
  });

  it('has exactly ONE primary Button (the Plus tier)', () => {
    setup();
    const plusBtn = screen.getByTestId('pricing-upgrade-plus');
    // The design-system primary variant is the only one carrying bg-accent.
    expect(plusBtn.className).toContain('bg-accent');
    const basicBtn = screen.getByTestId('pricing-upgrade-basic');
    expect(basicBtn.className).not.toContain('bg-accent');
    const allButtons = screen.getByTestId('pricing-modal').querySelectorAll('button');
    const primaries = Array.from(allButtons).filter((b) =>
      b.className.includes('bg-accent'),
    );
    expect(primaries.length).toBe(1);
  });

  it('shows savings copy only on the yearly period', () => {
    const { rerender } = renderControlled('monthly');
    expect(screen.getByTestId('pricing-modal').textContent).not.toContain('Save 80.88');
    rerender('yearly');
    expect(screen.getByTestId('pricing-modal').textContent).toContain('Save 80.88');
  });
});

// Helper for the rerender-based savings assertion.
function renderControlled(period: 'monthly' | 'yearly') {
  const base: PricingModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentPlanType: 'free',
    billingPeriod: period,
    onPeriodChange: vi.fn(),
    onUpgrade: vi.fn(),
    onContactEnterprise: vi.fn(),
  };
  const { rerender: rr } = render(<PricingModal {...base} />);
  return {
    rerender: (p: 'monthly' | 'yearly') =>
      rr(<PricingModal {...base} billingPeriod={p} />),
  };
}
