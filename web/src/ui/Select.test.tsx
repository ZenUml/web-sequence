import { createRef } from 'react';
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

function Fixture({
  onValueChange,
  contentSurface = 'dark',
}: {
  onValueChange: (v: string) => void;
  contentSurface?: 'dark' | 'light';
}) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger data-testid="theme-select" aria-label="Theme">
        <SelectValue placeholder="Pick a theme" />
      </SelectTrigger>
      <SelectContent surface={contentSurface}>
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

  it('forwards a ref and keeps a caller height class on the trigger', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Select>
        <SelectTrigger ref={ref} aria-label="Theme" className="h-7">
          <SelectValue placeholder="Pick a theme" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Theme' });
    expect(ref.current).toBe(trigger);
    expect(trigger.className).toContain('h-7');
    expect(trigger.className).toContain('ui-field');
    expect(trigger).toHaveAttribute('data-ui-surface', 'light');
  });

  it('selects with the keyboard and paints the portaled list with its own surface', async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} contentSurface="light" />);
    const trigger = screen.getByTestId('theme-select');
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const list = await screen.findByRole('listbox');
    expect(list).toHaveAttribute('data-ui-surface', 'light');
    expect(list.className).toContain('ui-surface-light');
    await userEvent.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalled();
  });
});
