import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { foldEffect, foldable } from '@codemirror/language';
import { CodeEditor } from './CodeEditor';
import type { GutterStyle } from './gutterStyle';

// F55 fold gutter review (Figma 128:5164): today's text arrows next to the F55 chevrons,
// same DSL, same size. Hover an editor to reveal chevrons; click one to fold.

const SAMPLE = `// Checkout
Client -> API: placeOrder
API.placeOrder() {
  if(inStock) {
    DB.save(order)
    return ok
  } else {
    return outOfStock
  }
}`;

type Appearance = 'light' | 'dark';

function useAppearance(appearance: Appearance) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.appearance;
    root.dataset.appearance = appearance;
    return () => {
      if (prev === undefined) delete root.dataset.appearance;
      else root.dataset.appearance = prev;
    };
  }, [appearance]);
}

// Folds the `if(inStock) {` block (line 4) once the editor exists.
function useFoldLine(ref: RefObject<ReactCodeMirrorRef | null>, lineNo: number | null) {
  useEffect(() => {
    if (lineNo == null) return;
    const id = window.setTimeout(() => {
      const view = ref.current?.view;
      if (!view) return;
      const line = view.state.doc.line(lineNo);
      const range = foldable(view.state, line.from, line.to);
      if (range) view.dispatch({ effects: foldEffect.of(range) });
    }, 300);
    return () => window.clearTimeout(id);
  }, [ref, lineNo]);
}

function Panel({ label, gutterStyle, foldLine }: { label: string; gutterStyle: GutterStyle; foldLine: number | null }) {
  const [value, setValue] = useState(SAMPLE);
  const ref = useRef<ReactCodeMirrorRef>(null);
  useFoldLine(ref, foldLine);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 380 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--editor-text-secondary)' }}>{label}</div>
      <div
        data-testid={`panel-${gutterStyle}`}
        style={{
          height: 290,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--editor-border)',
          background: 'var(--code-bg)',
        }}
      >
        <CodeEditor
          ref={ref}
          value={value}
          onChange={setValue}
          language="dsl"
          gutterStyle={gutterStyle}
          testId={`editor-${gutterStyle}`}
        />
      </div>
    </div>
  );
}

function Compare({ appearance, folded }: { appearance: Appearance; folded: boolean }) {
  useAppearance(appearance);
  const foldLine = folded ? 4 : null;
  return (
    <div
      className="editor-hifi-shell"
      style={{ display: 'flex', gap: 24, padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}
    >
      <Panel label="现状 · 文字箭头 (text)" gutterStyle="text" foldLine={foldLine} />
      <Panel label="提案 · SVG 箭头 (chevron, F55)" gutterStyle="chevron" foldLine={foldLine} />
    </div>
  );
}

const meta: Meta<typeof Compare> = {
  title: 'Editor/Fold gutter (F55)',
  component: Compare,
  // The global decorator pads on the ink surface; the editor shell paints its own.
  decorators: [(Story) => <div style={{ margin: '-2rem' }}><Story /></div>],
  args: { appearance: 'light', folded: false },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['light', 'dark'] },
  },
};
export default meta;

type Story = StoryObj<typeof Compare>;

export const Light: Story = {};
export const Dark: Story = { args: { appearance: 'dark' } };
export const LightFolded: Story = { args: { folded: true } };
export const DarkFolded: Story = { args: { appearance: 'dark', folded: true } };
