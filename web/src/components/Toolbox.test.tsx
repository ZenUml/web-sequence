import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbox } from './Toolbox';
import { SNIPPETS } from '../editor/snippets';

describe('Toolbox', () => {
  it('renders a button with a label for every snippet, keyed by testid', () => {
    render(<Toolbox onInsert={() => {}} />);
    for (const s of SNIPPETS) {
      const btn = screen.getByTestId(`snippet-${s.id}`);
      expect(btn).toBeInTheDocument();
      // visible compact label is the short token; full label feeds title/aria-label
      expect(btn).toHaveTextContent(s.short);
      expect(btn).toHaveAttribute('aria-label', s.label);
      expect(btn).toHaveAttribute('title', s.label);
      // icon stacked over label
      expect(btn.querySelector('svg')).toBeInTheDocument();
    }
  });

  it('renders two .igroup clusters (message + structure)', () => {
    const { container } = render(<Toolbox onInsert={() => {}} />);
    const groups = container.querySelectorAll('[role="toolbar"] > div');
    expect(groups).toHaveLength(2);
    // first cluster = message group, second = structure group
    const messageIds = SNIPPETS.filter((s) => s.group === 'message').map((s) => s.id);
    const structureIds = SNIPPETS.filter((s) => s.group === 'structure').map((s) => s.id);
    expect(groups[0].querySelectorAll('[data-testid^="snippet-"]')).toHaveLength(messageIds.length);
    expect(groups[1].querySelectorAll('[data-testid^="snippet-"]')).toHaveLength(structureIds.length);
  });

  it('calls onInsert with the snippet code when a button is clicked', () => {
    const onInsert = vi.fn();
    render(<Toolbox onInsert={onInsert} />);
    fireEvent.click(screen.getByTestId('snippet-async'));
    expect(onInsert).toHaveBeenCalledWith('A->B:message');
  });
});
