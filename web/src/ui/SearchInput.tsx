import { forwardRef } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { surfaceClass, type UISurface } from './surface';
import './tokens.css';

// Design-system search field: leading search glyph + input styled like TextInput,
// plus a clear (×) affordance shown only when there's a value. `onChange` is
// value-style (string), not the raw DOM event, to keep call sites terse.
// `className` stays on the wrapper, matching the previous layout hook.
export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange(value: string): void;
  surface?: UISurface;
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
  const hasValue = value.length > 0;
  return (
    <div className={cn('ui-search', surfaceClass(surface), className)} data-ui-surface={surface}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="ui-search-icon"
      >
        <circle cx="7" cy="7" r="4.25" />
        <path d="m10.5 10.5 3 3" />
      </svg>
      <input
        ref={ref}
        {...rest}
        type="search"
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        data-ui-surface={surface}
        onChange={(e) => onChange(e.target.value)}
        className={cn('ui-field', 'ui-field--control', 'ui-search-input', surfaceClass(surface))}
      />
      {hasValue ? (
        <IconButton
          size="sm"
          surface={surface}
          aria-label="Clear search"
          data-testid="search-clear"
          className="ui-search-clear"
          onClick={() => onChange('')}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </IconButton>
      ) : null}
    </div>
  );
});
