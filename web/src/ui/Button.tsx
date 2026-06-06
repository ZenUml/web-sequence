import { forwardRef } from 'react';
import { cn } from './cn';

// Design-system Button ("Drafting Table"). Variants map to intent, not color names.
// Default surface is the dark ink chrome (the app header lives there). For the
// light paper surface, pass `surface="light"` so the focus ring contrasts.
type Variant = 'primary' | 'subtle' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  surface?: 'dark' | 'light';
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-medium select-none ' +
  'rounded transition-colors duration-150 ease-draft disabled:opacity-40 ' +
  'disabled:pointer-events-none whitespace-nowrap';

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3.5 text-[13px]',
};

// Variants are surface-aware: the same intent reads correctly on the dark `ink`
// chrome and on the light `paper` surface (modals/menus). `primary` (the cobalt
// signal) is identical on both; the quiet variants flip their neutrals.
const variants: Record<'dark' | 'light', Record<Variant, string>> = {
  dark: {
    primary: 'bg-accent text-white hover:bg-accent-press active:bg-accent-press shadow-inset',
    subtle: 'bg-ink-700/70 text-ondark-strong hover:bg-ink-700 border border-ink-line/50',
    ghost: 'bg-transparent text-ondark-muted hover:text-ondark-strong hover:bg-white/5',
    danger: 'bg-transparent text-danger hover:bg-danger/10 border border-danger/30',
  },
  light: {
    primary: 'bg-accent text-white hover:bg-accent-press active:bg-accent-press shadow-inset',
    subtle: 'bg-paper-100 text-onlight-strong hover:bg-paper-200 border border-paper-line',
    ghost: 'bg-transparent text-onlight-muted hover:text-onlight-strong hover:bg-black/5',
    danger: 'bg-transparent text-danger hover:bg-danger/10 border border-danger/30',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'subtle', size = 'md', surface = 'dark', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        sizes[size],
        variants[surface][variant],
        surface === 'light' ? 'ring-draft-light' : 'ring-draft',
        className,
      )}
      {...rest}
    />
  );
});
