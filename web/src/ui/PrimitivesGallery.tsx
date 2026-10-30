import { useLayoutEffect, useRef, useState } from 'react';
import { Button, buttonClassName } from './Button';
import { IconButton } from './IconButton';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { SearchInput } from './SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { Switch } from './Switch';
import { TextInput } from './TextInput';
import { Textarea } from './Textarea';
import { Tooltip } from './Tooltip';
import type { UISurface } from './surface';

const STATES = [
  ['default', 'Default'],
  ['hover', 'Hover'],
  ['pressed', 'Pressed'],
  ['focus', 'Focus'],
  ['disabled', 'Disabled'],
] as const;

function stateProps(state: (typeof STATES)[number][0]): {
  disabled?: boolean;
  'data-ui-state'?: 'hover' | 'pressed' | 'focus';
} {
  if (state === 'disabled') return { disabled: true };
  if (state === 'default') return {};
  return { 'data-ui-state': state };
}

function Glyph({ size }: { size: 16 | 18 }) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M9 4v10M4 9h10" />
    </svg>
  );
}

function Probe({
  id,
  children,
  width,
}: {
  id: string;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('Measuring…');
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('button, a, input') as HTMLElement | null;
    if (!el) return;
    const style = getComputedStyle(el);
    const outline =
      style.outlineStyle === 'none' ? 'outline none' : `outline ${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
    setText(
      [
        `${Math.round(parseFloat(style.width))}×${Math.round(parseFloat(style.height))}px`,
        `font ${style.fontSize}/${style.lineHeight}`,
        `radius ${style.borderRadius}`,
        `fill ${style.backgroundColor}`,
        outline,
      ].join('\n'),
    );
  }, []);
  return (
    <div ref={ref} style={{ display: 'grid', gap: 6, justifyItems: 'start', width }}>
      {children}
      <p data-measure={id} style={{ margin: 0, fontSize: 11, lineHeight: '14px', whiteSpace: 'pre-line' }}>
        {text}
      </p>
    </div>
  );
}

function StateTable({ surface }: { surface: UISurface }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {(['primary', 'subtle'] as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end' }}>
          <div style={{ width: 88, fontSize: 13 }}>{variant === 'primary' ? 'Primary' : 'Secondary'}</div>
          {STATES.map(([state, label]) => (
            <Probe key={state} id={`${surface}-${variant}-${state}`} width={156}>
              <Button variant={variant} surface={surface} {...stateProps(state)}>
                {variant === 'primary' ? <Glyph size={18} /> : null}
                {variant === 'primary' ? 'New' : 'Sign in'}
              </Button>
              <span style={{ fontSize: 12 }}>{label}</span>
            </Probe>
          ))}
        </div>
      ))}
    </div>
  );
}

function Fields({ surface }: { surface: UISurface }) {
  const [query, setQuery] = useState(surface === 'light' ? 'sequence' : '');
  const [on, setOn] = useState(true);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'start' }}>
      <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
        Text
        <TextInput aria-label="Diagram name" surface={surface} defaultValue="Checkout" />
      </label>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, minWidth: 180 }}>
        Search
        <SearchInput aria-label="Search diagrams" surface={surface} value={query} onChange={setQuery} />
      </label>
      <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
        Select
        <Select defaultValue="sequence">
          <SelectTrigger surface={surface} aria-label="Diagram type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent surface={surface}>
            <SelectItem value="sequence">Sequence</SelectItem>
            <SelectItem value="class">Class</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, minWidth: 220 }}>
        Notes
        <Textarea aria-label="Notes" surface={surface} defaultValue="Alice -> Bob: Hello" />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
        <Switch surface={surface} checked={on} onCheckedChange={setOn} aria-label="Grid" />
        Grid
      </label>
      <Menu>
        <MenuTrigger asChild>
          <Button surface={surface} variant="subtle">
            Menu
          </Button>
        </MenuTrigger>
        <MenuContent surface={surface}>
          <MenuItem>Rename</MenuItem>
          <MenuItem tone="danger">Delete</MenuItem>
        </MenuContent>
      </Menu>
      <Popover>
        <PopoverTrigger asChild>
          <Button surface={surface} variant="subtle">
            Popover
          </Button>
        </PopoverTrigger>
        <PopoverContent surface={surface}>
          <TextInput aria-label="Link name" surface={surface} defaultValue="Shared link" />
        </PopoverContent>
      </Popover>
      <Tooltip label="Add a diagram" surface={surface}>
        <IconButton aria-label="Add diagram" surface={surface}>
          <Glyph size={18} />
        </IconButton>
      </Tooltip>
    </div>
  );
}

function SurfaceBlock({ surface, title }: { surface: UISurface; title: string }) {
  return (
    <section
      id={`surface-${surface}`}
      className={surface === 'light' ? 'ui-surface-light' : 'ui-surface-dark'}
      data-ui-surface={surface}
      style={{
        background: 'var(--ui-page)',
        color: 'var(--ui-text)',
        padding: 24,
        display: 'grid',
        gap: 20,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, lineHeight: '24px' }}>{title}</h2>
      <StateTable surface={surface} />
      <Fields surface={surface} />
    </section>
  );
}

export function PrimitivesGallery() {
  return (
    <main id="primitive-gallery" style={{ margin: 0, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <SurfaceBlock surface="light" title="Light" />
      <SurfaceBlock surface="dark" title="Soft dark" />
      <section
        id="overrides"
        className="ui-surface-light"
        data-ui-surface="light"
        style={{ background: 'var(--ui-page)', color: 'var(--ui-text)', padding: 24, display: 'grid', gap: 16 }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Caller overrides</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'end' }}>
          <Probe id="standard-button">
            <Button variant="primary" surface="light">
              <Glyph size={18} />
              New
            </Button>
          </Probe>
          <Probe id="compact-button">
            <Button variant="subtle" size="sm" surface="light">
              Stop sharing
            </Button>
          </Probe>
          <Probe id="card-28">
            <Button variant="subtle" surface="light" className="h-7">
              Open
            </Button>
          </Probe>
          <Probe id="provider-48">
            <Button variant="primary" surface="light" className="h-12 w-full" style={{ width: 280 }}>
              Continue with Google
            </Button>
          </Probe>
          <Probe id="icon-32">
            <IconButton aria-label="More" surface="light">
              <Glyph size={16} />
            </IconButton>
          </Probe>
          <Probe id="icon-18">
            <IconButton aria-label="Add" surface="light">
              <Glyph size={18} />
            </IconButton>
          </Probe>
          <Probe id="anchor-button">
            <a href="#sponsor" className={buttonClassName({ variant: 'subtle', surface: 'light' })}>
              Sponsor
            </a>
          </Probe>
        </div>
      </section>
      <section
        id="keyboard-lab"
        className="ui-surface-light"
        data-ui-surface="light"
        style={{ background: 'var(--ui-surface)', color: 'var(--ui-text)', padding: 24, display: 'grid', gap: 12 }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Keyboard</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <TextInput id="kb-input" aria-label="Keyboard field" surface="light" defaultValue="" />
          <Select>
            <SelectTrigger id="kb-select" surface="light" aria-label="Keyboard select">
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent surface="light">
              <SelectItem value="one">One</SelectItem>
              <SelectItem value="two">Two</SelectItem>
            </SelectContent>
          </Select>
          <Menu>
            <MenuTrigger asChild>
              <Button id="kb-menu" surface="light" variant="subtle">
                Keyboard menu
              </Button>
            </MenuTrigger>
            <MenuContent surface="light">
              <MenuItem>First</MenuItem>
              <MenuItem>Second</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </section>
    </main>
  );
}
