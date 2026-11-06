import { forwardRef } from 'react';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Square, icon-only control. Default (md) is 32px. sm stays 24px for tight
// toolbar chrome. Glyph artwork is centered; pass a 16px or 18px svg. A caller
// size utility (for example h-4 w-4 on a tab close) wins over the default.
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
  surface?: UISurface;
  // Accessible label is required — icon buttons have no visible text.
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', surface = 'dark', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      type={type}
      data-ui-surface={surface}
      className={cn(
        'ui-icon-button',
        surfaceClass(surface),
        size === 'sm' && 'ui-icon-button--sm',
        'disabled:pointer-events-none',
        className,
      )}
    />
  );
});
