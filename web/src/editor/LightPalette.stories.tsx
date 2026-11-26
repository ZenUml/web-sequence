import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useState } from 'react';
import { CodeEditor } from './CodeEditor';

// Light palette review: the real editor and the real shell classes, so the page
// colours come from globals.css exactly as on app.zenuml.com. The diagram is a
// static stand-in; only the surfaces around it matter here.

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

function Participant({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect x={x - 46} y={8} width={92} height={32} rx={6} fill="none" stroke="var(--editor-text-secondary)" />
      <text x={x} y={29} textAnchor="middle" fontSize={13} fill="var(--editor-text)">
        {label}
      </text>
      <line x1={x} y1={40} x2={x} y2={230} stroke="var(--editor-divider)" strokeDasharray="4 4" />
    </g>
  );
}

function Shell({ appearance }: { appearance: Appearance }) {
  useAppearance(appearance);
  const [value, setValue] = useState(SAMPLE);
  return (
    <div className="editor-hifi-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="editor-layout" style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 0 }}>
        <div className="editor-source-pane" style={{ display: 'flex', minHeight: 0, paddingBottom: 12 }}>
          <div className="editor-source-stack" data-testid="source-stack" style={{ flex: 1, minHeight: 0 }}>
            <CodeEditor value={value} onChange={setValue} language="dsl" testId="dsl-editor" />
          </div>
        </div>
        <div className="editor-preview-stage" style={{ display: 'flex' }}>
          <div className="editor-preview-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="editor-renderer-header">
              <span style={{ fontSize: 13, fontWeight: 500 }}>Preview</span>
            </div>
            <div className="editor-preview-canvas" style={{ flex: 1 }}>
              <svg width={420} height={240} aria-label="Diagram stand-in">
                <Participant x={60} label="Client" />
                <Participant x={210} label="API" />
                <Participant x={360} label="DB" />
                <line x1={60} y1={80} x2={204} y2={80} stroke="var(--editor-text)" />
                <text x={135} y={72} textAnchor="middle" fontSize={12} fill="var(--editor-text)">
                  placeOrder
                </text>
                <line x1={210} y1={130} x2={354} y2={130} stroke="var(--editor-text)" />
                <text x={285} y={122} textAnchor="middle" fontSize={12} fill="var(--editor-text)">
                  save(order)
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof Shell> = {
  title: 'Editor/Light palette',
  component: Shell,
  decorators: [(Story) => <div style={{ margin: '-2rem' }}><Story /></div>],
  parameters: { layout: 'fullscreen' },
  args: { appearance: 'light' },
  argTypes: { appearance: { control: 'inline-radio', options: ['light', 'dark'] } },
};
export default meta;

type Story = StoryObj<typeof Shell>;

export const Light: Story = {};
export const Dark: Story = { args: { appearance: 'dark' } };
