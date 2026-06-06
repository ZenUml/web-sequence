import { forwardRef } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';

// Design-system search field: leading search glyph + input styled like TextInput,
// plus a clear (×) affordance shown only when there's a value. `onChange` is
// value-style (string), not the raw DOM event, to keep call sites terse.
export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange(value: string): void;
  surface?: 'dark' | 'light';
  'data-testid'?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value = '',
    onChange,
    surface = 'dark',
    className,
    placeholder = 'Search',
    'data-testid': testId = 'search-input',
    ...rest
  },
  ref,
) {
  const isDark = surface === 'dark';
  const hasValue = value.length > 0;
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={cn(
          'pointer-events-none absolute left-2 h-4 w-4',
          isDark ? 'text-ondark-faint' : 'text-onlight-faint',
        )}
      >
        <circle cx="7" cy="7" r="4.25" />
        <path d="m10.5 10.5 3 3" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-8 rounded pl-8 pr-8 text-[13px] transition-colors duration-150 ease-draft w-full',
          // Hide the native clear affordance — we render our own.
          '[&::-webkit-search-cancel-button]:appearance-none',
          isDark
            ? 'bg-ink-800 text-ondark-strong border border-ink-line/50 placeholder:text-ondark-faint ring-draft'
            : 'bg-paper-50 text-onlight-strong border border-paper-line placeholder:text-onlight-faint ring-draft-light',
        )}
        {...rest}
      />
      {hasValue ? (
        <IconButton
          size="sm"
          surface={surface}
          aria-label="Clear search"
          data-testid="search-clear"
          className="absolute right-1"
          onClick={() => onChange('')}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="h-3.5 w-3.5"
          >
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </IconButton>
      ) : null}
    </div>
  );
});
