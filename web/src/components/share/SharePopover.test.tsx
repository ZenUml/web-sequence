import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger } from '../../ui';
import { SharePopover } from './SharePopover';

// Radix Popover relies on pointer-capture APIs jsdom doesn't implement.
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

// SharePopover renders only the PopoverContent body; tests host it inside an
// open Popover Root so the portal content mounts.
function renderOpen(props: Parameters<typeof SharePopover>[0]) {
  return render(
    <Popover defaultOpen>
      <PopoverTrigger>open</PopoverTrigger>
      <SharePopover {...props} />
    </Popover>,
  );
}

const base = {
  url: null,
  sharing: false,
  error: null,
  onShare: vi.fn(),
  onStop: vi.fn(),
  onCopy: vi.fn(),
};

describe('SharePopover', () => {
  it('with no url shows the create-share button and no url field', async () => {
    renderOpen({ ...base });
    expect(await screen.findByTestId('share-create')).toBeInTheDocument();
    expect(screen.queryByTestId('share-url')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-stop')).not.toBeInTheDocument();
  });

  it('clicking create calls onShare', async () => {
    const onShare = vi.fn();
    renderOpen({ ...base, onShare });
    await userEvent.click(await screen.findByTestId('share-create'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('disables the create button while sharing', async () => {
    renderOpen({ ...base, sharing: true });
    expect(await screen.findByTestId('share-create')).toBeDisabled();
  });

  it('shows the error text when error is set', async () => {
    renderOpen({ ...base, error: 'Could not create link' });
    expect(await screen.findByTestId('share-error-text')).toHaveTextContent(
      'Could not create link',
    );
  });

  it('with a url shows the read-only url field plus copy and stop, hiding create', async () => {
    renderOpen({ ...base, url: 'https://app.zenuml.com/s/abc' });
    const urlField = await screen.findByTestId('share-url');
    expect(urlField).toHaveValue('https://app.zenuml.com/s/abc');
    expect(urlField).toHaveAttribute('readonly');
    expect(screen.getByTestId('share-copy')).toBeInTheDocument();
    expect(screen.getByTestId('share-stop')).toBeInTheDocument();
    expect(screen.queryByTestId('share-create')).not.toBeInTheDocument();
  });

  it('clicking copy calls onCopy', async () => {
    const onCopy = vi.fn();
    renderOpen({ ...base, url: 'https://app.zenuml.com/s/abc', onCopy });
    await userEvent.click(await screen.findByTestId('share-copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('clicking stop calls onStop', async () => {
    const onStop = vi.fn();
    renderOpen({ ...base, url: 'https://app.zenuml.com/s/abc', onStop });
    await userEvent.click(await screen.findByTestId('share-stop'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
