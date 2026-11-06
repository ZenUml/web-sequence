import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportBugButton } from './ReportBugButton';

const props = {
  appVersion: '2026.6.7',
  view: 'editor',
  signedIn: false,
  dsl: 'A -> B: x',
};

describe('ReportBugButton', () => {
  it('renders a labelled FAB and no modal initially', () => {
    render(<ReportBugButton {...props} />);
    expect(screen.getByTestId('report-bug-fab')).toHaveAttribute('aria-label', 'Report a bug');
    expect(screen.queryByTestId('report-bug-modal')).toBeNull();
  });

  it('opens the modal and fires onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<ReportBugButton {...props} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('report-bug-fab'));
    expect(screen.getByTestId('report-bug-modal')).toBeTruthy();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
