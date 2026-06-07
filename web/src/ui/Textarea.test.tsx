import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './Textarea';

function Controlled({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Textarea
      aria-label="Custom CSS"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

describe('Textarea', () => {
  it('is a controlled field — keystrokes flow through value/onChange and render', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const el = screen.getByLabelText('Custom CSS') as HTMLTextAreaElement;
    await userEvent.type(el, 'abc');
    // onChange saw each keystroke and the controlled value re-rendered through it.
    expect(onChange).toHaveBeenLastCalledWith('abc');
    expect(el.value).toBe('abc');
  });

  it('renders a real <textarea> (multi-line), not an <input>', () => {
    render(<Textarea data-testid="acss" defaultValue="x" />);
    expect(screen.getByTestId('acss').tagName).toBe('TEXTAREA');
  });

  it('forwards data-testid and aria-label', () => {
    render(<Textarea data-testid="acss" aria-label="Atomic CSS" />);
    const el = screen.getByTestId('acss');
    expect(el).toBe(screen.getByLabelText('Atomic CSS'));
  });

  it('light surface uses the paper field tokens, not the dark ink ones', () => {
    render(<Textarea data-testid="acss" surface="light" />);
    const el = screen.getByTestId('acss');
    expect(el.className).toContain('bg-paper-50');
    expect(el.className).not.toContain('bg-ink-800');
  });
});
