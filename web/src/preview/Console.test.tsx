import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Console } from './Console';

describe('Console', () => {
  it('shows the log count and entries', () => {
    render(<Console open entries={[{ level: 'log', args: ['hello'] }]} onClear={() => {}} onEval={() => {}} onToggle={() => {}} />);
    expect(screen.getByTestId('console-count')).toHaveTextContent('1');
    expect(screen.getByText(/hello/)).toBeInTheDocument();
  });
  it('clear button calls onClear; eval submits on Enter', async () => {
    const onClear = vi.fn(); const onEval = vi.fn();
    render(<Console open entries={[]} onClear={onClear} onEval={onEval} onToggle={() => {}} />);
    await userEvent.click(screen.getByTestId('console-clear'));
    expect(onClear).toHaveBeenCalled();
    await userEvent.type(screen.getByTestId('console-eval'), '1+1{enter}');
    expect(onEval).toHaveBeenCalledWith('1+1');
  });
});
