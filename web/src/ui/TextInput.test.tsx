import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  it('forwards ref, className, and the surface attribute', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <TextInput
        ref={ref}
        aria-label="Folder name"
        className="h-7"
        surface="light"
        defaultValue=""
      />,
    );
    const el = screen.getByRole('textbox', { name: 'Folder name' });
    expect(ref.current).toBe(el);
    expect(el.className).toContain('h-7');
    expect(el.className).toContain('ui-field');
    expect(el).toHaveAttribute('data-ui-surface', 'light');
  });

  it('accepts typing and ignores keystrokes when disabled', async () => {
    render(<TextInput aria-label="Title" defaultValue="" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    await userEvent.type(el, 'ab');
    expect(el).toHaveValue('ab');

    render(<TextInput aria-label="Locked" defaultValue="keep" disabled />);
    const locked = screen.getByRole('textbox', { name: 'Locked' });
    expect(locked).toBeDisabled();
    await userEvent.type(locked, 'zz');
    expect(locked).toHaveValue('keep');
  });
});
