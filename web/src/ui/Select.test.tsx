import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './Select';

// Radix Select drives pointer interaction through APIs jsdom doesn't implement.
// Stub them so opening the listbox + clicking an option works in tests.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function Fixture({ onValueChange }: { onValueChange: (v: string) => void }) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger data-testid="theme-select" aria-label="Theme">
        <SelectValue placeholder="Pick a theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('opens and selecting an option fires onValueChange with that value', async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);

    // Options live in a portal that mounts only once the trigger is opened.
    expect(screen.queryByText('Dark')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('theme-select'));
    await userEvent.click(await screen.findByText('Dark'));

    expect(onValueChange).toHaveBeenCalledWith('dark');
  });

  it('forwards data-testid and aria-label to the trigger', () => {
    render(<Fixture onValueChange={vi.fn()} />);
    const trigger = screen.getByTestId('theme-select');
    expect(trigger).toBe(screen.getByLabelText('Theme'));
    expect(trigger).toHaveAttribute('role', 'combobox');
  });

  it('renders the placeholder before any selection', () => {
    render(<Fixture onValueChange={vi.fn()} />);
    expect(screen.getByText('Pick a theme')).toBeInTheDocument();
  });
});
