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
});
