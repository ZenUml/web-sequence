import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, buttonClassName } from './Button';

describe('Button', () => {
  it('renders a button with the given label and forwards data-testid', () => {
    render(
      <Button data-testid="save" variant="primary">
        Save
      </Button>,
    );
    const el = screen.getByTestId('save');
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveTextContent('Save');
  });

  it('defaults to type="button" so it never submits a surrounding form by accident', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  // WCAG AA contrast fix: the default danger red (#E0524A) is only ~3.6:1 on the
  // light paper surface, failing AA for button TEXT. The light danger variant must
  // carry its label in danger-strong (#B23A33, ~5.5:1 on paper-50) instead.
  it('light danger variant uses the AA-passing danger-strong for its TEXT, not plain danger', () => {
    const cls = buttonClassName({ surface: 'light', variant: 'danger' });
    expect(cls).toContain('text-danger-strong');
    // The plain danger text color (which only reaches ~3.6:1 on paper) must be gone.
    // Match on a word boundary so `text-danger-strong` does not satisfy this.
    expect(cls).not.toMatch(/\btext-danger(?!-strong)\b/);
  });

  it('light danger variant draws its border from danger-strong too (consistent legible outline)', () => {
    const cls = buttonClassName({ surface: 'light', variant: 'danger' });
    expect(cls).toContain('border-danger-strong/40');
  });

  // The dark danger variant sits on the ink chrome where DEFAULT danger passes AA;
  // it must stay on text-danger so we don't over-darken the on-dark label.
  it('dark danger variant keeps the DEFAULT danger color for its TEXT', () => {
    const cls = buttonClassName({ surface: 'dark', variant: 'danger' });
    expect(cls).toContain('text-danger');
    expect(cls).not.toContain('text-danger-strong');
  });

  it('renders danger variant on a real element via the component', () => {
    render(
      <Button data-testid="stop" surface="light" variant="danger">
        Stop sharing
      </Button>,
    );
    expect(screen.getByTestId('stop').className).toContain('text-danger-strong');
  });
});
