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

  it('shows "Copied ✓" on the copy button when copied is true (keeping the testid)', async () => {
    // Discriminating: revert SharePopover's `{copied ? 'Copied ✓' : 'Copy'}` back to
    // a static 'Copy' → the button text stays 'Copy' → this assertion fails.
    renderOpen({ ...base, url: 'https://app.zenuml.com/s/abc', copied: true });
    const copyBtn = await screen.findByTestId('share-copy');
    expect(copyBtn).toHaveTextContent('Copied ✓');
  });

  it('shows "Copy" (not copied) when copied is false/omitted', async () => {
    renderOpen({ ...base, url: 'https://app.zenuml.com/s/abc' });
    const copyBtn = await screen.findByTestId('share-copy');
    expect(copyBtn).toHaveTextContent('Copy');
    expect(copyBtn).not.toHaveTextContent('Copied');
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

  it('shows the error text in the URL branch too (failed Stop sharing; advisor fix #7)', async () => {
    // Previously the error slot lived only in the no-url branch, so a failed
    // "Stop sharing" left the link shown with no feedback.
    renderOpen({ ...base, url: 'https://app.zenuml.com/s/abc', error: 'Could not stop sharing' });
    expect(await screen.findByTestId('share-error-text')).toHaveTextContent(
      'Could not stop sharing',
    );
    // The link is still displayed (stop failed → diagram may still be public).
    expect(screen.getByTestId('share-url')).toHaveValue('https://app.zenuml.com/s/abc');
  });
});

// ─── Designed panel states (Figma F18/F19/F26 light · F29/F30/F31 dark) ───────
describe('SharePopover — panel states', () => {
  const SENTENCE = 'Anyone with the link can view this diagram.';
  const URL = 'https://app.zenuml.com/?id=abc&share-token=t';

  it('create: compact menu-like panel with heading, one action and the complete sentence', async () => {
    renderOpen({ ...base });
    const panel = await screen.findByTestId('share-panel');
    expect(panel).toHaveAttribute('data-state', 'create');
    expect(panel).toHaveTextContent('Share link');
    expect(screen.getByTestId('share-create')).toHaveTextContent('Create share link');
    expect(panel).toHaveTextContent(SENTENCE);
    expect(screen.queryByTestId('share-url')).toBeNull();
  });

  it('creating: action is busy + disabled and progress is announced', async () => {
    renderOpen({ ...base, sharing: true });
    const create = await screen.findByTestId('share-create');
    expect(create).toBeDisabled();
    expect(create).toHaveAttribute('aria-busy', 'true');
    expect(create).toHaveTextContent('Creating…');
    expect(screen.getByRole('status')).toHaveTextContent('Creating your read-only link…');
    expect(screen.getByTestId('share-panel')).toHaveAttribute('data-state', 'creating');
  });

  it('create failure: Try again action + readable guidance alert, no raw server text', async () => {
    const onShare = vi.fn();
    renderOpen({ ...base, error: 'Forbidden', failure: 'create', onShare });
    const retry = await screen.findByTestId('share-create');
    expect(retry).toHaveTextContent('Try again');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Couldn’t create a link. Check your connection and try again.',
    );
    expect(screen.getByTestId('share-panel')).not.toHaveTextContent('Forbidden');
    await userEvent.click(retry);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('created: sentence, read-only url, Copy share link + Stop sharing', async () => {
    renderOpen({ ...base, url: URL });
    const panel = await screen.findByTestId('share-panel');
    expect(panel).toHaveAttribute('data-state', 'created');
    expect(panel).toHaveTextContent(SENTENCE);
    expect(screen.getByTestId('share-url')).toHaveAttribute('readonly');
    expect(screen.getByTestId('share-url')).toHaveAccessibleName('Share link');
    expect(screen.getByTestId('share-copy')).toHaveTextContent('Copy share link');
    expect(screen.getByTestId('share-stop')).toHaveTextContent('Stop sharing');
  });

  it('copied: button confirms and the change is announced', async () => {
    renderOpen({ ...base, url: URL, copied: true });
    expect(await screen.findByTestId('share-copy')).toHaveTextContent('Copied ✓');
    expect(screen.getByRole('status')).toHaveTextContent('Link copied to clipboard.');
  });

  it('copy failure: manual-copy guidance and the link text is selected for the user', async () => {
    renderOpen({ ...base, url: URL, copyFailed: true });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t copy. Select the link above and copy it manually.',
    );
    const input = screen.getByTestId('share-url') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(URL.length);
  });

  it('stopping: Stop is busy + disabled, Copy is paused, link stays shown with guidance', async () => {
    renderOpen({ ...base, url: URL, stopping: true });
    const stop = await screen.findByTestId('share-stop');
    expect(stop).toHaveTextContent('Stopping…');
    expect(stop).toBeDisabled();
    expect(stop).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('share-copy')).toBeDisabled();
    expect(screen.getByTestId('share-url')).toHaveValue(URL);
    expect(screen.getByRole('status')).toHaveTextContent('Your link stays active until this finishes.');
  });

  it('stop failure: link kept, readable alert, Stop sharing available again', async () => {
    renderOpen({ ...base, url: URL, error: 'stop failed', failure: 'stop' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t stop sharing. Your link is still active. Try again.',
    );
    expect(screen.getByTestId('share-stop')).not.toBeDisabled();
    expect(screen.getByTestId('share-url')).toHaveValue(URL);
    expect(screen.getByTestId('share-panel')).not.toHaveTextContent('stop failed');
  });

  it('shows one feedback message at a time (failure outranks copied)', async () => {
    renderOpen({ ...base, url: URL, copied: true, failure: 'stop', error: 'x' });
    await screen.findByTestId('share-panel');
    expect(screen.queryByText('Link copied to clipboard.')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t stop sharing.');
  });
});
