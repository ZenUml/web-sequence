import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingModal } from './OnboardingModal';

// Radix Dialog renders into a portal — query within `document` (screen does this).
describe('OnboardingModal', () => {
  const setup = (over = {}) => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      onDismiss: vi.fn(),
      ...over,
    };
    render(<OnboardingModal {...props} />);
    return props;
  };

  it('renders the welcome content when open', () => {
    setup();
    expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-get-started')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    setup({ open: false });
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument();
  });

  // Discriminating: "Get started" calls onDismiss EXACTLY once. A buggy impl that
  // also calls onOpenChange(false) would route through the Dialog handler and
  // fire onDismiss a second time — this catches that double-fire.
  it('Get started calls onDismiss exactly once', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('onboarding-get-started'));
    expect(p.onDismiss).toHaveBeenCalledTimes(1);
  });
});
