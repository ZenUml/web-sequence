import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('defaults to a 32px control class, type button, and the dark surface', () => {
    render(<IconButton aria-label="Add page">+</IconButton>);
    const el = screen.getByRole('button', { name: 'Add page' });
    expect(el).toHaveAttribute('type', 'button');
    expect(el).toHaveAttribute('data-ui-surface', 'dark');
    expect(el.className).toContain('ui-icon-button');
    expect(el.className).not.toContain('ui-icon-button--sm');
  });

  it('forwards ref and a caller size class without dropping the primitive class', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton ref={ref} aria-label="Delete page" className="h-4 w-4" surface="light">
        ×
      </IconButton>,
    );
    const el = screen.getByRole('button', { name: 'Delete page' });
    expect(ref.current).toBe(el);
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-4');
    expect(el.className).toContain('ui-icon-button');
    expect(el).toHaveAttribute('data-ui-surface', 'light');
  });

  it('does not activate when disabled', async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Add page" disabled onClick={onClick}>
        +
      </IconButton>,
    );
    const el = screen.getByRole('button', { name: 'Add page' });
    expect(el.className).toContain('disabled:pointer-events-none');
    await userEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });
});
