import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('typing calls onChange with the field value', async () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    await userEvent.type(screen.getByTestId('search-input'), 'a');
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('hides the clear button when empty and shows it when there is a value', () => {
    const { rerender } = render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByTestId('search-clear')).not.toBeInTheDocument();

    rerender(<SearchInput value="flow" onChange={vi.fn()} />);
    expect(screen.getByTestId('search-clear')).toBeInTheDocument();
  });

  it('clicking the clear button calls onChange with an empty string', async () => {
    const onChange = vi.fn();
    render(<SearchInput value="flow" onChange={onChange} />);
    await userEvent.click(screen.getByTestId('search-clear'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('honors an overridable data-testid', () => {
    render(<SearchInput value="" onChange={vi.fn()} data-testid="library-search" />);
    expect(screen.getByTestId('library-search')).toBeInTheDocument();
  });
});
