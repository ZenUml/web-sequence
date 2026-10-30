import { forwardRef } from 'react';
import { cn } from './cn';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  surface?: UISurface;
}

// Multi-line field. Same surface, border, and focus tokens as TextInput.
// Settings/pricing/acss modals pass surface="light"; dark remains the default
// so existing callers keep the previous default.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { surface = 'dark', className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...rest}
      data-ui-surface={surface}
      className={cn('ui-field', 'ui-textarea', surfaceClass(surface), className)}
    />
  );
});
