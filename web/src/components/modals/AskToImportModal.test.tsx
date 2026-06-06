import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AskToImportModal } from './AskToImportModal';

// Regression guard for the review fix: the Import button must NOT also trigger
// the dismiss/"don't ask again" path (which would set the flag before saveItems
// resolves and lose local items on a failed import). Closing is driven by the
// controlled `open` prop, not by the buttons calling onOpenChange(false).
describe('AskToImportModal', () => {
  const setup = (over = {}) => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      count: 3,
      onImport: vi.fn(),
      onDismiss: vi.fn(),
      ...over,
    };
    render(<AskToImportModal {...props} />);
    return props;
  };

  it('Import calls onImport and does NOT call onDismiss', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('import-confirm'));
    expect(p.onImport).toHaveBeenCalledTimes(1);
    expect(p.onDismiss).not.toHaveBeenCalled();
  });

  it('Don\'t ask again calls onDismiss and does NOT call onImport', () => {
    const p = setup();
    fireEvent.click(screen.getByTestId('import-dismiss'));
    expect(p.onDismiss).toHaveBeenCalledTimes(1);
    expect(p.onImport).not.toHaveBeenCalled();
  });

  it('shows the count in the import button', () => {
    setup({ count: 5 });
    expect(screen.getByTestId('import-confirm').textContent).toContain('5');
  });
});
