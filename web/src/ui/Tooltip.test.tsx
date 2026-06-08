import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';

// Radix Tooltip relies on pointer-capture APIs that jsdom doesn't implement.
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

describe('Tooltip', () => {
  it('reveals its label on keyboard focus (label is keyboard-reachable, not just hover)', async () => {
    render(
      <Tooltip label="Explain this control">
        <button data-testid="trigger">Do thing</button>
      </Tooltip>,
    );

    // Hidden by default — the label is not in the document.
    expect(screen.queryByText('Explain this control')).not.toBeInTheDocument();

    // Tabbing to the trigger (no pointer) must surface the microcopy. This is the
    // whole point of replacing native title="" — keyboard reachability.
    await userEvent.tab();
    expect(screen.getByTestId('trigger')).toHaveFocus();

    // Radix renders the tooltip content in a portal; query the whole document.
    // (Radix duplicates the label into an sr-only node, so allow multiple.)
    const labels = await screen.findAllByText('Explain this control');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('does not wrap the trigger in an extra interactive element (asChild)', () => {
    render(
      <Tooltip label="hi">
        <button data-testid="trigger">Do thing</button>
      </Tooltip>,
    );
    // asChild means the trigger IS our button — no nested button wrapper.
    const trigger = screen.getByTestId('trigger');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.closest('button:not([data-testid="trigger"])')).toBeNull();
  });
});
