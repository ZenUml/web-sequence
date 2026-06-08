import { forwardRef } from 'react';
import { cn } from './cn';

// Square, icon-only control for toolbars and tab affordances (close/add).
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
  surface?: 'dark' | 'light';
  // Accessible label is required — icon buttons have no visible text.
  'aria-label': string;
}

const sizes = { sm: 'h-6 w-6', md: 'h-8 w-8' } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', surface = 'dark', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded transition-colors duration-150 ease-draft',
        'disabled:opacity-40 disabled:pointer-events-none',
        surface === 'light'
          ? 'text-onlight-muted hover:text-onlight-strong hover:bg-black/5 ring-draft-light'
          : 'text-ondark-muted hover:text-ondark-strong hover:bg-white/5 ring-draft',
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
