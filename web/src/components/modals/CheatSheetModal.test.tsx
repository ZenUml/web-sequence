import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CheatSheetModal } from './CheatSheetModal';

describe('CheatSheetModal', () => {
  it('does not render content when closed', () => {
    render(<CheatSheetModal open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId('cheatsheet-modal')).toBeNull();
  });

  it('renders the DSL feature rows when open', () => {
    render(<CheatSheetModal open onOpenChange={() => {}} />);
    expect(screen.getByTestId('cheatsheet-modal')).toBeTruthy();
    for (const feature of [
      'Participant',
      'Message',
      'Async message',
      'Nested message',
      'Self-message',
      'Return',
      'Instance creation',
      'Alt (conditional)',
      'Loop',
      'Comment',
    ]) {
      expect(screen.getByText(feature)).toBeTruthy();
    }
  });

  it('shows the exact sourced DSL examples in font-mono code blocks', () => {
    render(<CheatSheetModal open onOpenChange={() => {}} />);
    const root = screen.getByTestId('cheatsheet-modal');
    const codeText = Array.from(root.querySelectorAll('code.font-mono')).map(
      (c) => c.textContent,
    );

    // Legacy-sourced examples.
    expect(codeText).toContain('Alice->Bob: How are you?');
    expect(codeText.some((t) => t === 'A.messageA() {\n  B.messageB()\n}')).toBe(
      true,
    );
    expect(codeText).toContain('internalMessage()');
    // Plan-sourced examples (return, instance creation).
    expect(codeText).toContain('result = A.method() {}');
    expect(codeText).toContain('a = new A()');
    // Grammar-sourced comment (`// ...`).
    expect(codeText).toContain('// This is a comment');
  });
});
