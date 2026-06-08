import { forwardRef } from 'react';
import { cn } from './cn';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  surface?: 'dark' | 'light';
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { surface = 'dark', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'rounded px-2 h-8 text-[13px] transition-colors duration-150 ease-draft',
        surface === 'dark'
          ? 'bg-ink-800 text-ondark-strong border border-ink-line/50 placeholder:text-ondark-faint ring-draft'
          : 'bg-paper-50 text-onlight-strong border border-paper-line placeholder:text-onlight-faint ring-draft-light',
        className,
      )}
      {...rest}
    />
  );
});
