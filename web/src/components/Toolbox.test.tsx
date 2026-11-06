import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbox } from './Toolbox';
import { SNIPPETS, type Snippet } from '../editor/snippets';

// f023f89 ("feat(hub): … alt/loop merge") curated the toolbar to a design-spec
// subset — see the in-source design-spec comments in Toolbox.tsx:
//  - group 1 (message): every `message` snippet EXCEPT Self (Self moves to group 2);
//  - group 2 (structure): Self · "Alt / Loop" (the `if` snippet re-labelled as the
//    merged alt+loop button) · Note (`comment`);
//  - `instance` is intentionally absent and `while` is folded into "Alt / Loop".
// These expectations mirror that shipped curation, not the raw SNIPPETS list.
const MESSAGE = SNIPPETS.filter((s) => s.group === 'message' && s.id !== 'self');
const STRUCTURE: Snippet[] = [
  SNIPPETS.find((s) => s.id === 'self')!,
  { ...SNIPPETS.find((s) => s.id === 'if')!, short: 'Alt / Loop' },
  SNIPPETS.find((s) => s.id === 'comment')!,
];
const CURATED = [...MESSAGE, ...STRUCTURE];

describe('Toolbox', () => {
  it('renders a button with a label for every curated snippet, keyed by testid', () => {
    render(<Toolbox onInsert={() => {}} />);
    for (const s of CURATED) {
      const btn = screen.getByTestId(`snippet-${s.id}`);
      expect(btn).toBeInTheDocument();
      // visible compact label is the short token; full label feeds title/aria-label
      expect(btn).toHaveTextContent(s.short);
      expect(btn).toHaveAttribute('aria-label', s.label);
      expect(btn).toHaveAttribute('title', s.label);
      // icon stacked over label
      expect(btn.querySelector('svg')).toBeInTheDocument();
    }
    // f023f89 design spec (Toolbox.tsx comments): Instance is intentionally absent
    // from the toolbar, and While has no standalone button (merged into "Alt / Loop").
    expect(screen.queryByTestId('snippet-instance')).toBeNull();
    expect(screen.queryByTestId('snippet-while')).toBeNull();
  });

  it('renders two .igroup clusters with the curated message/structure counts', () => {
    const { container } = render(<Toolbox onInsert={() => {}} />);
    const groups = container.querySelectorAll('[role="toolbar"] > div');
    expect(groups).toHaveLength(2);
    // f023f89 curated clusters (Toolbox.tsx design-spec comments): first cluster =
    // message snippets minus Self; second cluster = Self · merged Alt/Loop · Note.
    expect(groups[0].querySelectorAll('[data-testid^="snippet-"]')).toHaveLength(MESSAGE.length);
    expect(groups[1].querySelectorAll('[data-testid^="snippet-"]')).toHaveLength(STRUCTURE.length);
  });

  it('calls onInsert with the snippet code when a button is clicked', () => {
    const onInsert = vi.fn();
    render(<Toolbox onInsert={onInsert} />);
    fireEvent.click(screen.getByTestId('snippet-async'));
    expect(onInsert).toHaveBeenCalledWith('A->B:message');
  });
});
