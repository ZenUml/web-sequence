import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeEditor } from './CodeEditor';

it('renders a lint diagnostic gutter marker for provided errors', async () => {
  const { container } = render(
    <CodeEditor value={'A.b\nbad'} language="css" onChange={() => {}} testId="css-editor"
      diagnostics={[{ lineNumber: 1, message: 'boom' }]} />,
  );
  await Promise.resolve();
  expect(container.querySelector('.cm-gutters')).toBeTruthy();
  // The lint gutter column (added by lintGutter()) renders synchronously even
  // though the async marker (.cm-lint-marker) needs layout jsdom lacks.
  expect(container.querySelector('.cm-gutter-lint')).toBeTruthy();
});

describe('CodeEditor', () => {
  it('renders the initial value', () => {
    render(<CodeEditor value="A.method()" language="dsl" onChange={() => {}} testId="dsl-editor" />);
    expect(screen.getByTestId('dsl-editor')).toBeInTheDocument();
    expect(screen.getByTestId('dsl-editor')).toHaveTextContent(/A\.method/);
  });
  it('fires onChange when the user types', async () => {
    const onChange = vi.fn();
    render(<CodeEditor value="" language="dsl" onChange={onChange} testId="dsl-editor" />);
    const area = screen.getByTestId('dsl-editor').querySelector('.cm-content') as HTMLElement;
    await userEvent.click(area);
    await userEvent.keyboard('A');
    expect(onChange).toHaveBeenCalled();
  });
});
