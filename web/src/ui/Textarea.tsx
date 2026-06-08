import { forwardRef } from 'react';
import { cn } from './cn';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  surface?: 'dark' | 'light';
}

// Design-system textarea — mirrors TextInput (same surface tokens / ring), but as
// a multi-line native <textarea>. Settings/pricing/acss modals use the light
// (paper) surface; the dark branch is kept for parity with TextInput.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ surface = 'dark', className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'rounded px-2 py-1.5 text-[13px] font-sans transition-colors duration-150 ease-draft resize-y',
          surface === 'dark'
            ? 'bg-ink-800 text-ondark-strong border border-ink-line/50 placeholder:text-ondark-faint ring-draft'
            : 'bg-paper-50 text-onlight-strong border border-paper-line placeholder:text-onlight-faint ring-draft-light',
          className,
        )}
        {...rest}
      />
    );
  },
);
