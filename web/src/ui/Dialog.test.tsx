import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogContent } from './Dialog';

// NOTE: jsdom has no layout engine, so the original centering bug (pop-in's
// `transform: scale(1)` clobbering the centering translate) is NOT observable
// here — there are no computed transforms. The centering fix is verified by the
// structural change (grid-centered wrapper + Content no longer carries a
// translate) and by a screenshot at integrate time. What this test DOES
// discriminate is the universal close affordance and that content is reachable.

describe('Dialog', () => {
  const renderOpen = (over: { onOpenChange?: (o: boolean) => void } = {}) =>
    render(
      <Dialog open onOpenChange={over.onOpenChange}>
        <DialogContent title="My Title" description="My desc">
          <button>body action</button>
        </DialogContent>
      </Dialog>,
    );

  it('renders title, description and children content (reachable)', () => {
    renderOpen();
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My desc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'body action' })).toBeInTheDocument();
  });

  it('renders a labelled close button', () => {
    renderOpen();
    // Revert-to-fail: removing the DialogClose IconButton breaks this.
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('clicking the close button dismisses the dialog (onOpenChange(false))', async () => {
    const onOpenChange = vi.fn();
    renderOpen({ onOpenChange });
    await userEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('content wrapper centers via grid (no translate-based centering on content)', () => {
    renderOpen();
    // Structural guard for the fix: the dialog must be reached through a
    // grid-centered wrapper, and Content must not re-introduce a centering
    // translate (which the pop-in animation would clobber).
    const title = screen.getByText('My Title');
    const content = title.closest('[role="dialog"]') as HTMLElement;
    expect(content.className).not.toMatch(/-translate-[xy]-1\/2/);
    const wrapper = content.parentElement as HTMLElement;
    expect(wrapper.className).toContain('place-items-center');
  });
});

describe('DialogContent presentation props (backward compatible)', () => {
  it('defaults keep the ink shell and serif title', () => {
    render(
      <Dialog open>
        <DialogContent title="T">x</DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog').className).toContain('bg-ink-800');
    expect(screen.getByRole('heading', { name: 'T' }).className).toContain('font-serif');
  });

  it('bare drops the ink surface and serif title; slot classes apply', () => {
    render(
      <Dialog open>
        <DialogContent bare className="shell" titleClassName="ttl" closeClassName="cls" title="T">
          x
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('shell');
    expect(dialog.className).not.toContain('bg-ink-800');
    expect(screen.getByRole('heading', { name: 'T' }).className).toBe('ttl');
    expect(screen.getByLabelText('Close').className).toContain('cls');
  });

  it('closeDisabled disables the close button', () => {
    render(
      <Dialog open>
        <DialogContent title="T" closeDisabled>x</DialogContent>
      </Dialog>,
    );
    expect(screen.getByLabelText('Close')).toBeDisabled();
  });

  it('describedBy points the dialog description at body copy', () => {
    render(
      <Dialog open>
        <DialogContent title="T" describedBy="body-copy">
          <p id="body-copy">Body sentence.</p>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Body sentence.');
  });
});

describe('DialogContent focus + overlay options', () => {
  it('default: focus moves to the first control (close button)', async () => {
    render(
      <Dialog open>
        <DialogContent title="T">x</DialogContent>
      </Dialog>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Close')));
  });

  it('focusContentOnOpen: focus lands on the dialog container, Tab reaches the close button', async () => {
    render(
      <Dialog open>
        <DialogContent title="T" focusContentOnOpen>
          <button>action</button>
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
  });

  it('overlayClassName replaces the default ink overlay colour', () => {
    const { baseElement } = render(
      <Dialog open>
        <DialogContent title="T" overlayClassName="my-scrim">x</DialogContent>
      </Dialog>,
    );
    const overlay = baseElement.querySelector('.my-scrim')!;
    expect(overlay).not.toBeNull();
    expect(overlay.className).not.toContain('bg-ink-950/55');
  });
});
