import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CodeAppearanceBar } from './CodeAppearanceBar';
import {
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  CODE_THEME_OPTIONS,
  codeThemeLabel,
  effectiveCodeThemeId,
  stepCodeFontSize,
} from './codeAppearance';
import { THEMES } from '../../editor/themes';
import { DEFAULT_SETTINGS } from '../../domain/types';

// Radix Select needs pointer-capture / scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.useRealTimers();
});

function mockCoarsePointer(coarse: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// The bar watches its parent (the code area) for the pointer nearing the bottom.
// jsdom has no layout, so give the area a fixed rect: 0..400 px tall.
function Harness({
  initialTheme = 'ink',
  initialSize = 16,
  onTheme = vi.fn(),
  onSize = vi.fn(),
}: {
  initialTheme?: string;
  initialSize?: number;
  onTheme?: (id: string) => void;
  onSize?: (n: number) => void;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [size, setSize] = useState(initialSize);
  return (
    <div data-testid="code-area">
      <textarea data-testid="code" />
      <CodeAppearanceBar
        themeId={theme}
        fontSize={size}
        hideDelay={300}
        onThemeChange={(id) => { setTheme(id); onTheme(id); }}
        onFontSizeChange={(n) => { setSize(n); onSize(n); }}
      />
    </div>
  );
}

// The bar's slot sits at 340..376 inside the area; the reveal band is just above
// and over that slot.
function setAreaRect() {
  const area = screen.getByTestId('code-area');
  area.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 400, width: 300, height: 400, toJSON: () => ({}) }) as DOMRect;
  const el = screen.getByTestId('code-appearance-bar');
  Object.defineProperty(el, 'offsetTop', { configurable: true, value: 340 });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 36 });
  return area;
}

function pointerEvent(type: string, el: Element, init: { clientX?: number; clientY: number; buttons?: number; pointerType: string }) {
  // jsdom's PointerEvent ignores clientY/buttons init; build a MouseEvent-backed one.
  const ev = new MouseEvent(type, { bubbles: true, clientX: init.clientX ?? 150, clientY: init.clientY, buttons: init.buttons ?? 0 });
  Object.defineProperty(ev, 'pointerType', { value: init.pointerType });
  fireEvent(el, ev);
}

function pointerMove(el: Element, clientY: number, buttons = 0) {
  // jsdom's PointerEvent ignores clientY/buttons init; build a MouseEvent-backed one.
  const ev = new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY, buttons });
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
  fireEvent(el, ev);
}

const bar = () => screen.getByTestId('code-appearance-bar');

describe('codeAppearance helpers', () => {
  it('uses the documented 12–18 font range and the default 16 sits inside it', () => {
    expect(CODE_FONT_SIZE_MIN).toBe(12);
    expect(CODE_FONT_SIZE_MAX).toBe(18);
    expect(DEFAULT_SETTINGS.fontSize).toBeGreaterThanOrEqual(CODE_FONT_SIZE_MIN);
    expect(DEFAULT_SETTINGS.fontSize).toBeLessThanOrEqual(CODE_FONT_SIZE_MAX);
  });

  it('steps by one and clamps to the range', () => {
    expect(stepCodeFontSize(16, 1)).toBe(17);
    expect(stepCodeFontSize(16, -1)).toBe(15);
    expect(stepCodeFontSize(18, 1)).toBe(18);
    expect(stepCodeFontSize(12, -1)).toBe(12);
    expect(stepCodeFontSize(20, -1)).toBe(18);
  });

  it('offers exactly the resolvable editor themes, with ink labelled "Follow app"', () => {
    expect(CODE_THEME_OPTIONS.map((t) => t.id)).toEqual(THEMES.map((t) => t.id));
    expect(codeThemeLabel('ink')).toBe('Follow app');
    expect(codeThemeLabel('dracula')).toBe('Dracula');
  });

  it('shows an unknown stored theme as what the editor renders (ink) without renaming it', () => {
    expect(effectiveCodeThemeId('cobalt')).toBe('ink');
    expect(codeThemeLabel('cobalt')).toBe('Follow app');
  });
});

describe('CodeAppearanceBar', () => {
  it('shows the current theme name and the stored font size', () => {
    render(<Harness initialTheme="monokai" initialSize={14} />);
    expect(screen.getByTestId('code-theme-select')).toHaveTextContent('Monokai');
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('14');
  });

  it('shows a stored size outside the range truthfully and steps it back inside', async () => {
    const onSize = vi.fn();
    render(<Harness initialSize={20} onSize={onSize} />);
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('20');
    expect(screen.getByTestId('code-font-increase')).toBeDisabled();
    fireEvent.click(screen.getByTestId('code-font-decrease'));
    expect(onSize).toHaveBeenLastCalledWith(18);
  });

  it('+/- change the size by one step and disable at the limits', () => {
    const onSize = vi.fn();
    render(<Harness initialSize={13} onSize={onSize} />);
    const dec = screen.getByTestId('code-font-decrease');
    const inc = screen.getByTestId('code-font-increase');
    expect(dec).toHaveAccessibleName('Decrease code font size');
    expect(inc).toHaveAccessibleName('Increase code font size');

    fireEvent.click(dec);
    expect(onSize).toHaveBeenLastCalledWith(12);
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('12');
    expect(dec).toBeDisabled();
    expect(inc).toBeEnabled();

    for (let i = 0; i < 6; i++) fireEvent.click(inc);
    expect(onSize).toHaveBeenLastCalledWith(18);
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('18');
    expect(inc).toBeDisabled();
    expect(dec).toBeEnabled();
    expect(onSize).toHaveBeenCalledTimes(7);
  });

  it('selects an explicit theme, then Follow app restores ink', async () => {
    const user = userEvent.setup();
    const onTheme = vi.fn();
    render(<Harness onTheme={onTheme} />);
    expect(screen.getByTestId('code-theme-select')).toHaveTextContent('Follow app');

    await user.click(screen.getByTestId('code-theme-select'));
    await user.click(await screen.findByTestId('code-theme-option-dracula'));
    expect(onTheme).toHaveBeenLastCalledWith('dracula');
    expect(screen.getByTestId('code-theme-select')).toHaveTextContent('Dracula');

    await user.click(screen.getByTestId('code-theme-select'));
    await user.click(await screen.findByTestId('code-theme-option-ink'));
    expect(onTheme).toHaveBeenLastCalledWith('ink');
    expect(screen.getByTestId('code-theme-select')).toHaveTextContent('Follow app');
  });

  it('does not write the setting when the current theme is re-selected', async () => {
    const user = userEvent.setup();
    const onTheme = vi.fn();
    render(<Harness initialTheme="monokai" onTheme={onTheme} />);
    await user.click(screen.getByTestId('code-theme-select'));
    await user.click(await screen.findByTestId('code-theme-option-monokai'));
    expect(onTheme).not.toHaveBeenCalled();
  });

  it('is hidden by default and click-through, yet stays in the tab order', () => {
    mockCoarsePointer(false);
    render(<Harness />);
    expect(bar()).toHaveAttribute('data-state', 'hidden');
    expect(screen.getByTestId('code-theme-select')).not.toHaveAttribute('tabindex', '-1');
    expect(bar()).not.toHaveAttribute('aria-hidden');
  });

  it('reveals when the pointer approaches the bottom and hides after a short delay', () => {
    mockCoarsePointer(false);
    vi.useFakeTimers();
    render(<Harness />);
    const area = setAreaRect();

    pointerMove(area, 100); // far from the bottom
    expect(bar()).toHaveAttribute('data-state', 'hidden');

    pointerMove(area, 360); // within 64px of the bottom
    expect(bar()).toHaveAttribute('data-state', 'visible');

    pointerMove(area, 200); // moved away
    expect(bar()).toHaveAttribute('data-state', 'visible');
    act(() => { vi.advanceTimersByTime(299); });
    expect(bar()).toHaveAttribute('data-state', 'visible');
    act(() => { vi.advanceTimersByTime(2); });
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('does not reveal during a drag-selection near the bottom', () => {
    mockCoarsePointer(false);
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 380, 1);
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('hides when the pointer leaves the code area', () => {
    mockCoarsePointer(false);
    vi.useFakeTimers();
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 380);
    expect(bar()).toHaveAttribute('data-state', 'visible');
    fireEvent.pointerLeave(area);
    act(() => { vi.advanceTimersByTime(400); });
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('stays visible while the pointer is over the bar', () => {
    mockCoarsePointer(false);
    vi.useFakeTimers();
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 380);
    fireEvent.pointerEnter(bar(), { pointerType: 'mouse' });
    fireEvent.pointerLeave(area); // leaving the hot zone while on the bar
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bar()).toHaveAttribute('data-state', 'visible');
    fireEvent.pointerLeave(bar());
    act(() => { vi.advanceTimersByTime(400); });
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('stays visible while the theme menu is open', async () => {
    mockCoarsePointer(false);
    const user = userEvent.setup();
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 380);
    await user.click(screen.getByTestId('code-theme-select'));
    await screen.findByTestId('code-theme-menu');
    fireEvent.pointerLeave(area);
    fireEvent.pointerLeave(bar());
    await new Promise((r) => setTimeout(r, 450));
    expect(bar()).toHaveAttribute('data-state', 'visible');
    expect(screen.getByTestId('code-theme-menu')).toBeInTheDocument();
  });

  it('a pointer selection in the theme menu does not pin the bar open', async () => {
    mockCoarsePointer(false);
    const user = userEvent.setup();
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 380);
    await user.click(screen.getByTestId('code-theme-select'));
    await user.click(await screen.findByTestId('code-theme-option-monokai'));
    // Radix returns focus to the trigger; that focus came from a pointer.
    expect(screen.getByTestId('code-theme-select')).toHaveFocus();
    pointerMove(area, 100);
    fireEvent.pointerLeave(bar());
    await new Promise((r) => setTimeout(r, 450));
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('typing in the code area hides it again', () => {
    mockCoarsePointer(false);
    vi.useFakeTimers();
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 380);
    expect(bar()).toHaveAttribute('data-state', 'visible');
    fireEvent.keyDown(screen.getByTestId('code'), { key: 'a' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('keyboard focus reveals it, keeps it visible across its controls, and hides on leaving', async () => {
    mockCoarsePointer(false);
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByTestId('code').focus();
    expect(bar()).toHaveAttribute('data-state', 'hidden');

    await user.tab();
    expect(screen.getByTestId('code-theme-select')).toHaveFocus();
    expect(bar()).toHaveAttribute('data-state', 'visible');

    await user.tab();
    expect(screen.getByTestId('code-font-decrease')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('15');

    await user.tab();
    expect(screen.getByTestId('code-font-increase')).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('16');
    expect(bar()).toHaveAttribute('data-state', 'visible');

    await user.tab(); // leaves the bar
    await new Promise((r) => setTimeout(r, 400));
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('shows directly on a coarse (touch) pointer, in the same overlay slot', () => {
    mockCoarsePointer(true);
    render(<Harness />);
    expect(bar()).toHaveAttribute('data-state', 'visible');
    expect(bar()).not.toHaveClass('code-appearance-bar--inline');
  });

  it('does not reveal for a pointer below the slot (e.g. over the Custom CSS row)', () => {
    mockCoarsePointer(false);
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 395);
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });

  it('hybrid device: a touch in the code area shows it until a mouse moves again', () => {
    mockCoarsePointer(false);
    vi.useFakeTimers();
    render(<Harness />);
    const area = setAreaRect();
    pointerMove(area, 100); // mouse somewhere above
    expect(bar()).toHaveAttribute('data-state', 'hidden');

    pointerEvent('pointerdown', screen.getByTestId('code'), { clientY: 80, pointerType: 'touch' });
    pointerEvent('pointerup', screen.getByTestId('code'), { clientY: 80, pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bar()).toHaveAttribute('data-state', 'visible');

    // A stationary synthetic mouse move (same position) does not end touch mode.
    pointerMove(area, 100);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bar()).toHaveAttribute('data-state', 'visible');

    // A real mouse movement does.
    pointerMove(area, 140);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bar()).toHaveAttribute('data-state', 'hidden');
  });
});

describe('CodeAppearanceBar geometry observation across page switches', () => {
  // Controlled ResizeObserver: tracks which elements are currently watched.
  const watched = new Set<Element>();
  const unobserved: Element[] = [];
  let disconnects = 0;
  class FakeResizeObserver {
    observe(el: Element) { watched.add(el); }
    unobserve(el: Element) { watched.delete(el); unobserved.push(el); }
    disconnect() { watched.clear(); disconnects += 1; }
  }
  // Controlled rAF: frames run only when the test flushes them.
  let frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const flushFrames = () =>
    act(() => {
      const pending = frames;
      frames = new Map();
      pending.forEach((cb) => cb(0));
    });

  afterEach(() => {
    vi.unstubAllGlobals();
    watched.clear();
    unobserved.length = 0;
    disconnects = 0;
    frames = new Map();
  });

  // AppRoot keys the DSL editor by page id, so a page switch replaces its
  // .cm-editor/.cm-gutters while the bar stays mounted. The switch happens
  // outside the code area, so no input/click in the area accompanies it.
  function Workspace({ page }: { page: number }) {
    return (
      <div data-testid="code-area">
        <div className="editor-source-stack">
          <div key={page} className="cm-editor" data-page={page}>
            <div className="cm-gutters" />
          </div>
        </div>
        <CodeAppearanceBar themeId="ink" fontSize={16} onThemeChange={vi.fn()} onFontSizeChange={vi.fn()} />
        <div className="editor-css-panel">
          <div className="cm-editor" data-testid="css-editor">
            <div className="cm-gutters" />
          </div>
        </div>
      </div>
    );
  }

  function currentNodes() {
    const area = screen.getByTestId('code-area');
    return new Set<Element>([area, ...area.querySelectorAll('.cm-editor, .cm-gutters')]);
  }

  it('unobserves replaced editor nodes, watches only current ones, and disconnects on unmount', async () => {
    mockCoarsePointer(false);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });

    const { rerender, unmount } = render(<Workspace page={1} />);
    flushFrames();
    expect(watched).toEqual(currentNodes());
    const css = screen.getByTestId('css-editor');

    const replaced: Element[] = [];
    for (let page = 2; page <= 5; page += 1) {
      const area = screen.getByTestId('code-area');
      const old = area.querySelector('.editor-source-stack .cm-editor')!;
      replaced.push(old, old.querySelector('.cm-gutters')!);
      rerender(<Workspace page={page} />);
      // Let DOM-change notifications deliver, then run the scheduled measurement.
      await act(async () => { await Promise.resolve(); });
      flushFrames();

      const now = area.querySelector('.editor-source-stack .cm-editor')!;
      expect(now).toHaveAttribute('data-page', String(page));
      expect(watched).toEqual(currentNodes());
      for (const el of replaced) {
        expect(el.isConnected).toBe(false);
        expect(watched.has(el)).toBe(false);
        expect(unobserved).toContain(el);
      }
    }
    // The CSS editor was never replaced, so it was never dropped.
    expect(unobserved).not.toContain(css);
    expect(watched.has(css)).toBe(true);

    unmount();
    expect(disconnects).toBe(1);
    expect(watched.size).toBe(0);
    expect(frames.size).toBe(0);
  });
});
