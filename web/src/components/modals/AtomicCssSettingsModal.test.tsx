import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtomicCssSettingsModal } from './AtomicCssSettingsModal';

describe('AtomicCssSettingsModal', () => {
  const setup = (over = {}) => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      value: { acssConfig: '{"breakPoints":{}}' },
      onChange: vi.fn(),
      ...over,
    };
    render(<AtomicCssSettingsModal {...props} />);
    return props;
  };

  it('renders the current acssConfig in the editor', () => {
    setup({ value: { acssConfig: '{"custom":{"foo":"bar"}}' } });
    const ta = screen.getByTestId('acss-config') as HTMLTextAreaElement;
    expect(ta.value).toBe('{"custom":{"foo":"bar"}}');
  });

  // Discriminating contract test: onChange must emit `acssConfig` as the JSON
  // *string* (not a parsed object) AND preserve other fields via `{ ...value }`.
  // transpilers.ts reads cssSettings.acssConfig and does JSON.parse on it, so
  // emitting a parsed object here would silently break the ACSS preview.
  it('valid edit emits acssConfig as a JSON string, preserving other fields', () => {
    const p = setup({ value: { acssConfig: '{}', other: 1 } as any });
    const ta = screen.getByTestId('acss-config');
    fireEvent.change(ta, { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByTestId('acss-save'));
    expect(p.onChange).toHaveBeenCalledTimes(1);
    const arg = p.onChange.mock.calls[0][0];
    expect(arg.acssConfig).toBe('{"a":1}');
    expect(typeof arg.acssConfig).toBe('string');
    // other fields preserved via spread
    expect((arg as any).other).toBe(1);
    // round-trips as valid JSON
    expect(() => JSON.parse(arg.acssConfig)).not.toThrow();
  });

  // Discriminating: invalid JSON surfaces an inline error and does NOT call onChange.
  it('invalid JSON shows an error and does not call onChange', () => {
    const p = setup();
    fireEvent.change(screen.getByTestId('acss-config'), {
      target: { value: '{bad json' },
    });
    fireEvent.click(screen.getByTestId('acss-save'));
    expect(p.onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('acss-error')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    setup({ open: false });
    expect(screen.queryByTestId('acss-modal')).not.toBeInTheDocument();
  });
});
