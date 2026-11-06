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

  it('checked track uses the shared primary action token, not the old accent utility', () => {
    render(<Switch checked aria-label="Auto save" onCheckedChange={vi.fn()} />);
    const el = screen.getByRole('switch');
    expect(el.className).toContain('ui-switch');
    expect(el.className).not.toContain('bg-accent');
    expect(el).toHaveAttribute('data-state', 'checked');
    expect(el).toHaveAttribute('data-ui-surface', 'light');
  });
});
