import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';

// Radix Popover relies on pointer-capture APIs that jsdom doesn't implement.
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
});

describe('Popover', () => {
  it('content is hidden until the trigger is clicked, then shows children (portal)', async () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <span>popover body</span>
        </PopoverContent>
      </Popover>,
    );

    // Closed by default — content not in the document.
    expect(screen.queryByText('popover body')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Open'));

    // Radix renders content in a portal; query the whole document.
    expect(await screen.findByText('popover body')).toBeInTheDocument();
  });

  it('puts the light surface on the portaled node and closes on Escape', async () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent className="caller-pop">
          <span>popover body</span>
        </PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByText('Open');
    await userEvent.click(trigger);
    const body = await screen.findByText('popover body');
    const panel = body.closest('[data-ui-surface]') as HTMLElement;
    expect(panel).toHaveAttribute('data-ui-surface', 'light');
    expect(panel.className).toContain('ui-popover');
    expect(panel.className).toContain('caller-pop');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('popover body')).not.toBeInTheDocument();
  });
});
