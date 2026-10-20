import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installUiCascade, usedColor } from './computedCascade';
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

  it('forwards ref, className, and an explicit submit type', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} type="submit" className="h-12 provider-action">
        Continue
      </Button>,
    );
    const el = screen.getByRole('button', { name: 'Continue' });
    expect(ref.current).toBe(el);
    expect(el).toHaveAttribute('type', 'submit');
    expect(el.className).toContain('h-12');
    expect(el.className).toContain('provider-action');
    expect(el.className).toContain('ui-button');
  });

  it('does not fire click when disabled, and keeps the pointer-events guard', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const el = screen.getByRole('button', { name: 'Save' });
    expect(el).toBeDisabled();
    expect(el.className).toContain('disabled:pointer-events-none');
    await userEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the 32px compact size opt-in and the legacy dark surface', () => {
    const md = buttonClassName();
    const sm = buttonClassName({ size: 'sm', surface: 'light', className: 'h-7' });
    expect(md).toContain('ui-surface-dark');
    expect(md).not.toContain('ui-button--sm');
    expect(sm).toContain('ui-button--sm');
    expect(sm).toContain('ui-surface-light');
    expect(sm).toContain('h-7');
  });

  it('styles an anchor like a button without nesting a button', () => {
    const cls = buttonClassName({
      variant: 'primary',
      surface: 'light',
      className: 'sponsor-link',
    });
    render(
      <a href="/sponsor" className={cls}>
        Sponsor
      </a>,
    );
    const link = screen.getByRole('link', { name: 'Sponsor' });
    expect(link.querySelector('button')).toBeNull();
    expect(link.className).toContain('ui-button');
    expect(link.className).toContain('ui-button--primary');
    expect(link.className).toContain('ui-surface-light');
    expect(link.className).toContain('sponsor-link');
  });

  it('shows a disabled danger button as muted danger on both surfaces without blocking size overrides', async () => {
    installUiCascade();
    const onClick = vi.fn();
    render(
      <div>
        <Button surface="light" variant="danger" onClick={onClick}>
          Stop sharing
        </Button>
        <Button surface="light" variant="danger" disabled onClick={onClick}>
          Stop sharing disabled
        </Button>
        <Button surface="dark" variant="danger">
          Delete
        </Button>
        <Button surface="dark" variant="danger" disabled aria-disabled="true" onClick={onClick}>
          Delete disabled
        </Button>
        <Button surface="light" variant="danger" disabled className="h-12" style={{ width: 280 }}>
          Continue with Google
        </Button>
        <Button surface="light" variant="primary" disabled className="h-7">
          Open
        </Button>
        <Button surface="light" variant="subtle" disabled>
          Cancel
        </Button>
      </div>,
    );

    const lightOn = getComputedStyle(screen.getByRole('button', { name: 'Stop sharing' }));
    const lightOff = screen.getByRole('button', { name: 'Stop sharing disabled' });
    const lightOffStyle = getComputedStyle(lightOff);
    expect(lightOn.opacity).toBe('1');
    expect(Number(lightOffStyle.opacity)).toBeLessThan(0.6);
    expect(lightOffStyle.color).toBe(lightOn.color);
    expect(usedColor(lightOff, 'color')).toEqual([178, 58, 51, 1]);
    expect(lightOffStyle.backgroundColor).toBe(lightOn.backgroundColor);
    expect(lightOff).toBeDisabled();
    expect(lightOffStyle.pointerEvents).toBe('none');
    lightOff.focus();
    expect(lightOff).not.toHaveFocus();
    await expect(userEvent.click(lightOff)).rejects.toThrow(/pointer-events: none/);
    await userEvent.keyboard('{Enter}{ }');
    expect(onClick).not.toHaveBeenCalled();

    const darkOn = getComputedStyle(screen.getByRole('button', { name: 'Delete' }));
    const darkOff = getComputedStyle(screen.getByRole('button', { name: 'Delete disabled' }));
    expect(darkOn.opacity).toBe('1');
    expect(Number(darkOff.opacity)).toBeLessThan(0.6);
    expect(darkOff.color).toBe(darkOn.color);
    expect(usedColor(screen.getByRole('button', { name: 'Delete disabled' }), 'color')).toEqual([224, 82, 74, 1]);

    const provider = screen.getByRole('button', { name: 'Continue with Google' });
    expect(['48px', '3rem']).toContain(getComputedStyle(provider).height);
    expect(Number(getComputedStyle(provider).opacity)).toBeLessThan(0.6);

    const card = getComputedStyle(screen.getByRole('button', { name: 'Open' }));
    expect(['28px', '1.75rem']).toContain(card.height);
    expect(card.opacity).toBe('1');
    expect(usedColor(screen.getByRole('button', { name: 'Open' }), 'backgroundColor')).toEqual([232, 237, 242, 1]);

    const subtle = getComputedStyle(screen.getByRole('button', { name: 'Cancel' }));
    expect(subtle.opacity).toBe('1');
    expect(usedColor(screen.getByRole('button', { name: 'Cancel' }), 'backgroundColor')).toEqual([
      232, 237, 242, 1,
    ]);
  });

  it('marks the button with the explicit surface the portal contract uses', () => {
    render(
      <Button surface="light" variant="primary">
        New
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('data-ui-surface', 'light');
  });
});
