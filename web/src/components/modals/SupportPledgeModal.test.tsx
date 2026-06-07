import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportPledgeModal } from './SupportPledgeModal';

describe('SupportPledgeModal', () => {
  const setup = (over = {}) => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      version: '2.5.1',
      onDismiss: vi.fn(),
      ...over,
    };
    render(<SupportPledgeModal {...props} />);
    return props;
  };

  it('renders the pledge content when open', () => {
    setup();
    expect(screen.getByTestId('pledge-modal')).toBeInTheDocument();
    expect(screen.getByTestId('pledge-dismiss')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    setup({ open: false });
    expect(screen.queryByTestId('pledge-modal')).not.toBeInTheDocument();
  });

  // Discriminating: the INJECTED version must actually render. A hardcoded string
  // would pass a generic assertion but fail this one. Use a distinctive version.
  it('renders the injected version', () => {
    setup({ version: '9.8.7' });
    expect(screen.getByText(/9\.8\.7/)).toBeInTheDocument();
  });

  // Discriminating: dismiss calls onDismiss exactly once (no double-fire via the
  // Dialog onOpenChange handler).
  it('dismiss calls onDismiss exactly once', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('pledge-dismiss'));
    expect(p.onDismiss).toHaveBeenCalledTimes(1);
  });
});
