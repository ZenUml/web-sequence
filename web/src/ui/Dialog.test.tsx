import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
