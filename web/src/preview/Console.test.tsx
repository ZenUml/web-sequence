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
  it('toggle is a button exposing aria-expanded that reflects open state', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <Console open entries={[]} onClear={() => {}} onEval={() => {}} onToggle={onToggle} />,
    );
    const toggle = screen.getByTestId('console-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalled();
    rerender(<Console open={false} entries={[]} onClear={() => {}} onEval={() => {}} onToggle={onToggle} />);
    expect(screen.getByTestId('console-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
  it('labels the eval input accessibly', () => {
    render(<Console open entries={[]} onClear={() => {}} onEval={() => {}} onToggle={() => {}} />);
    expect(screen.getByTestId('console-eval')).toHaveAccessibleName();
  });
  it('shows a clean "No issues" pill when there are no error entries', () => {
    render(
      <Console
        open
        entries={[{ level: 'log', args: ['hello'] }, { level: 'warn', args: ['careful'] }]}
        onClear={() => {}}
        onEval={() => {}}
        onToggle={() => {}}
      />,
    );
    const pill = screen.getByTestId('console-status');
    expect(pill).toHaveTextContent('No issues');
    expect(pill).toHaveAttribute('data-clean', 'true');
    // The total entry count is unaffected by the pill.
    expect(screen.getByTestId('console-count')).toHaveTextContent('2');
  });
  it('shows a red error count pill when there are error entries', () => {
    render(
      <Console
        open
        entries={[
          { level: 'error', args: ['boom'] },
          { level: 'log', args: ['noise'] },
          { level: 'error', args: ['bang'] },
        ]}
        onClear={() => {}}
        onEval={() => {}}
        onToggle={() => {}}
      />,
    );
    const pill = screen.getByTestId('console-status');
    expect(pill).toHaveTextContent('2 errors');
    expect(pill).toHaveAttribute('data-clean', 'false');
  });
  it('uses the singular "error" label for a single error', () => {
    render(
      <Console open entries={[{ level: 'error', args: ['boom'] }]} onClear={() => {}} onEval={() => {}} onToggle={() => {}} />,
    );
    expect(screen.getByTestId('console-status')).toHaveTextContent('1 error');
  });
});
