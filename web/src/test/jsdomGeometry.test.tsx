import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeEditor } from '../editor/CodeEditor';

// Test-harness contract (src/test/setup.ts): jsdom has no layout, so CodeMirror's
// click-to-position scan must still find a rect for each rendered piece of a line.
// A highlighted line has several span children; with no rects, CodeMirror's
// InlineCoordsScan read `.top` of undefined inside the mousedown handler, which
// Vitest reported as an unhandled error after the test had passed.
describe('jsdom geometry for CodeMirror', () => {
  it('a mouse click on a highlighted line raises no uncaught error', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => { errors.push(e.error ?? e.message); e.preventDefault(); };
    window.addEventListener('error', onError);
    try {
      render(<CodeEditor value={'A.method() {\n  B.call(x)\n}'} language="dsl" onChange={() => {}} testId="dsl-editor" />);
      const line = screen.getByTestId('dsl-editor').querySelector('.cm-line') as HTMLElement;
      expect(line.children.length).toBeGreaterThan(1); // the multi-span path, not the single-text shortcut
      await userEvent.click(line);
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });
});
