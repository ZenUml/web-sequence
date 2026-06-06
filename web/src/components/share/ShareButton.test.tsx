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

  it('is enabled by default', () => {
    render(<ShareButton {...base} />);
    expect(screen.getByTestId('share-button')).not.toBeDisabled();
  });
});
