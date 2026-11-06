import { forwardRef } from 'react';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  surface?: UISurface;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { surface = 'dark', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      data-ui-surface={surface}
      className={cn('ui-field', 'ui-field--control', surfaceClass(surface), className)}
    />
  );
});
