import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
  it('exposes the switch role and reflects checked state via aria-checked', () => {
    render(<Switch checked aria-label="Auto save" onCheckedChange={vi.fn()} />);
    const el = screen.getByRole('switch');
    expect(el).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking an unchecked switch fires onCheckedChange(true)', async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        checked={false}
        aria-label="Auto save"
        onCheckedChange={onCheckedChange}
      />,
    );
    await userEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('forwards data-testid and aria-label to the control', () => {
    render(
      <Switch data-testid="auto-save" aria-label="Auto save" onCheckedChange={vi.fn()} />,
    );
    expect(screen.getByTestId('auto-save')).toBe(screen.getByLabelText('Auto save'));
  });

  it('checked track fills with the accent (not left at the paper-200 rest state)', () => {
    render(<Switch checked aria-label="Auto save" onCheckedChange={vi.fn()} />);
    // data-[state=checked]:bg-accent is what carries the "on" affordance.
    expect(screen.getByRole('switch').className).toContain('data-[state=checked]:bg-accent');
  });
});
