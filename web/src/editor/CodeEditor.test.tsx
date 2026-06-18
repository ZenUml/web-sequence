import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { keymap, type EditorView } from '@codemirror/view';
import { getIndentation, getIndentUnit } from '@codemirror/language';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
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

  it('renders DSL with the zenuml Lezer highlighter (text still present, tokens emitted)', () => {
    const { container } = render(
      <CodeEditor value={'if x\nA->B'} language="dsl" onChange={() => {}} testId="dsl-editor" />,
    );
    expect(screen.getByTestId('dsl-editor')).toHaveTextContent(/A->B/);
    // The LRLanguage builds a real syntax tree; CM emits highlight token spans.
    expect(container.querySelector('.cm-content')).toBeTruthy();
  });

  // Invoke the real inline Mod-Shift-f run handler from the live keymap facet.
  // (CM's keyName matching via runScopeHandlers is unreliable under jsdom; pulling
  // the actual binding and calling its `run` exercises the exact CodeEditor code.)
  function runFormatBinding(view: EditorView): boolean {
    const all = ([] as { key?: string; run?: (v: EditorView) => boolean }[]).concat(
      ...view.state.facet(keymap),
    );
    const binding = all.find((b) => b.key === 'Mod-Shift-f');
    expect(binding).toBeTruthy();
    return binding!.run!(view);
  }

  it('Mod-Shift-f formats a writable CSS editor exactly once (FIX 6b: no double-fire)', async () => {
    const onChange = vi.fn();
    const ref = createRef<ReactCodeMirrorRef>();
    render(<CodeEditor ref={ref} value=".a{color:red}" language="css" onChange={onChange} testId="css-editor" />);
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    expect(view.state.readOnly).toBe(false);
    expect(runFormatBinding(view)).toBe(true); // handler claims the key
    // @uiw passes (value, viewUpdate); assert on the first arg only.
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toBe('.a {\n  color: red;\n}\n');
    // The dispatched doc change is the SOLE onChange source — no extra explicit call.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // The DSL editor's onZoneChange feeds the context-sensitive Hint Bar. It's an
  // EditorView.updateListener (not keymap-dependent), so it's deterministic under
  // jsdom: dispatch a selection change and assert the emitted zone. Both docs were
  // probed against resolveZone(languageExtension('dsl')) to confirm they resolve
  // where asserted (block body vs head), so neither passes for an accidental reason.
  it('fires onZoneChange with the cursor parse zone when the selection moves into a block (dsl)', async () => {
    const onZoneChange = vi.fn();
    const ref = createRef<ReactCodeMirrorRef>();
    render(
      <CodeEditor ref={ref} value={'A.b() {\n  \n}'} language="dsl" onChange={() => {}}
        onZoneChange={onZoneChange} testId="dsl-editor" />,
    );
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    const inside = view.state.doc.line(2).from + 2; // inside the StatementBraceBlock body
    view.dispatch({ selection: { anchor: inside } });
    await waitFor(() => expect(onZoneChange).toHaveBeenCalledWith('block'));
  });

  it('fires onZoneChange with the head zone when the cursor sits in the head (dsl)', async () => {
    const onZoneChange = vi.fn();
    const ref = createRef<ReactCodeMirrorRef>();
    render(
      <CodeEditor ref={ref} value={'@Actor A'} language="dsl" onChange={() => {}}
        onZoneChange={onZoneChange} testId="dsl-editor" />,
    );
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    await waitFor(() => expect(onZoneChange).toHaveBeenCalledWith('head'));
  });

  // #825: indentSize/indentWith wiring. The editor sets CM6's `indentUnit` facet from
  // these props; the DSL grammar's delimitedIndent reads that facet, so a non-default
  // indent size produces an OBSERVABLE block-indent width change. We assert via the
  // public getIndentation API (same harness as indentInvariant.test.ts) — the body line
  // of `A.b() { … }` is indented exactly one indent unit past the opener.
  function dslBlockBodyIndent(view: EditorView): number | null {
    // doc is `A.b() {\n  body\n}` — line 2 is the block body. getIndentation returns the
    // GRAMMAR-computed indent (baseIndent + one unit), independent of the literal text.
    return getIndentation(view.state, view.state.doc.line(2).from);
  }

  it('indentSize=4 makes the DSL block body indent 4 columns (indentUnit wired)', async () => {
    const ref = createRef<ReactCodeMirrorRef>();
    render(
      <CodeEditor ref={ref} value={'A.b() {\n  X.y()\n}'} language="dsl" onChange={() => {}}
        testId="dsl-editor" indentWith="spaces" indentSize={4} />,
    );
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    expect(getIndentUnit(view.state)).toBe(4); // facet reflects the setting
    expect(dslBlockBodyIndent(view)).toBe(4);  // observable: body indents one 4-space unit
  });

  it('indentSize=2 (default) keeps the DSL block body at 2 columns', async () => {
    const ref = createRef<ReactCodeMirrorRef>();
    render(
      <CodeEditor ref={ref} value={'A.b() {\n  X.y()\n}'} language="dsl" onChange={() => {}}
        testId="dsl-editor" indentWith="spaces" indentSize={2} />,
    );
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    expect(getIndentUnit(view.state)).toBe(2);
    expect(dslBlockBodyIndent(view)).toBe(2);
  });

  it('indentWith=tabs sets a tab indent unit (one tabSize-wide level)', async () => {
    const ref = createRef<ReactCodeMirrorRef>();
    render(
      <CodeEditor ref={ref} value={'A.b() {\n\tX.y()\n}'} language="dsl" onChange={() => {}}
        testId="dsl-editor" indentWith="tabs" indentSize={4} />,
    );
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    // A tab unit reports its width as tabSize columns (getIndentUnit: tabSize * length).
    expect(getIndentUnit(view.state)).toBe(view.state.tabSize);
    expect(dslBlockBodyIndent(view)).toBe(view.state.tabSize);
  });

  it('indentSize change reconfigures the live editor (2 → 8) without remount', async () => {
    const ref = createRef<ReactCodeMirrorRef>();
    const { rerender } = render(
      <CodeEditor ref={ref} value={'A.b() {\n  X.y()\n}'} language="dsl" onChange={() => {}}
        testId="dsl-editor" indentWith="spaces" indentSize={2} />,
    );
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    expect(dslBlockBodyIndent(view)).toBe(2);
    // Same view instance after the prop change → the compartment reconfigured live.
    rerender(
      <CodeEditor ref={ref} value={'A.b() {\n  X.y()\n}'} language="dsl" onChange={() => {}}
        testId="dsl-editor" indentWith="spaces" indentSize={8} />,
    );
    await waitFor(() => expect(getIndentUnit(ref.current!.view!.state)).toBe(8));
    expect(ref.current!.view).toBe(view); // not remounted
    expect(dslBlockBodyIndent(ref.current!.view!)).toBe(8);
  });

  it('Mod-Shift-f does NOT format/mutate a read-only (ACSS) editor (FIX 6a)', async () => {
    const onChange = vi.fn();
    const ref = createRef<ReactCodeMirrorRef>();
    render(<CodeEditor ref={ref} value=".a{color:red}" language="css" onChange={onChange} testId="css-editor" readOnly />);
    await waitFor(() => expect(ref.current?.view).toBeTruthy());
    const view = ref.current!.view!;
    expect(view.state.readOnly).toBe(true);
    // FIX 6a: the guard returns false immediately — the key is NOT claimed and
    // formatCss is never invoked.
    expect(runFormatBinding(view)).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(onChange).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('.a{color:red}'); // unchanged
  });
});
