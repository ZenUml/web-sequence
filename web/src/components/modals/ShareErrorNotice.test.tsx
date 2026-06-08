import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareErrorNotice } from './ShareErrorNotice';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const base = {
  open: true,
  onOpenChange: vi.fn(),
  onStartFresh: vi.fn(),
};

describe('ShareErrorNotice', () => {
  it('does not render content when closed', () => {
    render(<ShareErrorNotice {...base} open={false} />);
    expect(screen.queryByTestId('share-error')).not.toBeInTheDocument();
  });

  it('renders the dialog and the message when open', async () => {
    render(<ShareErrorNotice {...base} message="This shared link is no longer available." />);
    expect(await screen.findByTestId('share-error')).toBeInTheDocument();
    expect(screen.getByText('This shared link is no longer available.')).toBeInTheDocument();
  });

  it('clicking start-fresh calls onStartFresh', async () => {
    const onStartFresh = vi.fn();
    render(<ShareErrorNotice {...base} onStartFresh={onStartFresh} />);
    await userEvent.click(await screen.findByTestId('share-error-fresh'));
    expect(onStartFresh).toHaveBeenCalledTimes(1);
  });
});
