import { forwardRef } from 'react';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Shared button. `surface` stays explicit: dark is the legacy default.
// Sizes: md is the 36px control; sm is the 32px compact control. 28px cards and
// 48px provider buttons are caller utilities (h-7 / h-12). Control height is
// in :where() so those utilities win when this file is unlayered as well as
// when it sits in the components layer.
type Variant = 'primary' | 'subtle' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  surface?: UISurface;
}

// Light danger text uses danger-strong (#B23A33). The default danger red is
// about 3.6:1 on a light surface and fails WCAG AA for button text. Dark danger
// stays on the default danger color, which passes on the dark surface.
const LIGHT_DANGER =
  'bg-transparent text-danger-strong hover:bg-danger/10 border border-danger-strong/40';
const DARK_DANGER = 'bg-transparent text-danger hover:bg-danger/10 border border-danger/30';

// Full class strings, not a template. Tailwind only emits @layer rules for
// classes it can see in source.
const variantClass: Record<Variant, string> = {
  primary: 'ui-button--primary',
  subtle: 'ui-button--subtle',
  ghost: 'ui-button--ghost',
  danger: 'ui-button--danger',
};

// Shared class computation so non-button elements (e.g. an <a> that must LOOK like
// a button) can adopt identical design-system styling WITHOUT nesting a <button>
// inside another interactive element (invalid HTML / a11y defect). Used by the
// Support-pledge "Sponsor" link, which is semantically an anchor, not a button.
// Callers of this helper must keep the returned `ui-surface-*` class: that class
// is what resolves the palette. An ancestor surface does not style the anchor.
export function buttonClassName(opts?: {
  variant?: Variant;
  size?: Size;
  surface?: UISurface;
  className?: string;
}): string {
  const { variant = 'subtle', size = 'md', surface = 'dark', className } = opts ?? {};
  return cn(
    'ui-button',
    surfaceClass(surface),
    size === 'sm' && 'ui-button--sm',
    variantClass[variant],
    variant === 'danger' && (surface === 'light' ? LIGHT_DANGER : DARK_DANGER),
    'disabled:pointer-events-none',
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'subtle', size = 'md', surface = 'dark', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      type={type}
      data-ui-surface={surface}
      className={buttonClassName({ variant, size, surface, className })}
    />
  );
});
