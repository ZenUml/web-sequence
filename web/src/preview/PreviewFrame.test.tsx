import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

import { PreviewFrame, type PreviewHandle } from './PreviewFrame';

describe('PreviewFrame', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sets srcdoc with the assembled document', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
    const iframe = container.querySelector('iframe')!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('srcdoc')).toContain('id="mounting-point"');
  });

  it('posts a render message after the iframe reports ready', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={7} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', code: 'A.b', options: expect.objectContaining({ stickyOffset: 7 }) }),
      '*',
    );
  });

  it('routes codeChange and console messages to callbacks', () => {
    const onCodeChange = vi.fn();
    const onConsole = vi.fn();
    const { container } = render(
      <PreviewFrame code="A.b" css="" stickyOffset={0} onCodeChange={onCodeChange} onConsole={onConsole} />,
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'codeChange', code: 'C.d' } }));
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'console', level: 'log', args: ['hi'] } }));
    });
    expect(onCodeChange).toHaveBeenCalledWith('C.d');
    expect(onConsole).toHaveBeenCalledWith({ level: 'log', args: ['hi'] });
  });

  it('re-render after iframe reload uses the latest code, not the initial (stale-closure regression)', () => {
    const { container, rerender } = render(<PreviewFrame code="A.b" css=".a{}" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    rerender(<PreviewFrame code="C.d" css=".a{}" stickyOffset={0} />); // code changed
    post.mockClear();
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); }); // reload re-readies
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'render', code: 'C.d' }), '*');
  });

  it('posts updateCss (not a full render) when only css changes after ready', () => {
    const { container, rerender } = render(<PreviewFrame code="A.b" css=".a{}" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    post.mockClear();
    rerender(<PreviewFrame code="A.b" css=".b{}" stickyOffset={0} />);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'updateCss', css: '.b{}' }), '*');
  });

  it('on ready posts BOTH a render AND an updateCss carrying the current css', () => {
    const { container } = render(<PreviewFrame code="A.b" css=".a{}" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'render', code: 'A.b' }), '*');
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'updateCss', css: '.a{}' }), '*');
  });

  it('css that changes BEFORE ready still reaches the iframe (latest css on ready)', () => {
    const { container, rerender } = render(<PreviewFrame code="A.b" css=".a{}" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    rerender(<PreviewFrame code="A.b" css=".later{}" stickyOffset={0} />); // css changes while !ready
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'updateCss', css: '.later{}' }), '*');
  });

  it('getPng posts a getPng message and resolves on the matching png reply', async () => {
    const ref = createRef<PreviewHandle>();
    const { container } = render(<PreviewFrame ref={ref} code="A.b" css="" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    let sent: any = null;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: (m: any) => { sent = m; } }, configurable: true });
    const p = ref.current!.getPng();
    expect(sent).toEqual(expect.objectContaining({ type: 'getPng' }));
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'png', id: sent.id, dataUrl: 'data:image/png;base64,X' } })); });
    await expect(p).resolves.toBe('data:image/png;base64,X');
  });

  it('routes error messages to onError', () => {
    const onError = vi.fn();
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} onError={onError} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'error', message: 'boom' } })); });
    expect(onError).toHaveBeenCalledWith('boom');
  });

  // M05 embed: the srcdoc bakes the core-chrome suppression CSS ONLY when embed.
  // DISCRIMINATING: default (non-embed, jsdom has empty location.search) must NOT
  // carry it; an explicit embed prop must.
  it('bakes embed chrome-suppression CSS into the srcdoc only when embed', () => {
    const { container: plain } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
    expect(plain.querySelector('iframe')!.getAttribute('srcdoc')).not.toContain('zenuml-embed-suppress');

    const { container: embedded } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} embed />);
    const srcdoc = embedded.querySelector('iframe')!.getAttribute('srcdoc')!;
    expect(srcdoc).toContain('id="zenuml-embed-suppress"');
    expect(srcdoc).toContain('.footer{display:none !important}');
  });

  // DISCRIMINATING (round-5): in embed mode, a 'contentSize' message must set BOTH
  // explicit pixel width and height on the iframe — width shrink-wraps the horizontal
  // stranding gap; height is the existing round-4 card-hugging. In non-embed mode the
  // message must be silently ignored (no style change, no crash).
  //
  // The width comes from .bg-skin-canvas.scrollWidth (the inline-block DiagramFrame
  // root — NOT from #diagram/docScrollWidth which equal the full iframe clientWidth).
  // Removing the 'contentSize' case from the switch OR wiring it to only set height
  // makes this test fail.
  it('in embed mode: contentSize message sets both iframe width and height', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} embed />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 265, height: 344 } }));
    });
    expect(iframe.style.width).toBe('265px');
    expect(iframe.style.height).toBe('344px');
  });

  // GATING CANARY: storing contentSize in ALL modes (Phase 2 ungate) must NOT leak
  // into the editor (non-embed, non-fit) iframe. The message is stored in state but
  // intentionally not applied — the iframe keeps h-full w-full with no inline px. If
  // this goes red, the mode gating regressed and the editor pane is being sized wrong.
  it('in non-embed non-fit mode: contentSize is stored but NOT applied (style stays unset)', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 265, height: 344 } }));
    });
    expect(iframe.style.width).toBe('');
    expect(iframe.style.height).toBe('');
    expect(iframe.style.transform).toBe('');
    expect(iframe.className).toContain('h-full');
  });

  // PHASE 2 fit: when `fit` AND a contentSize arrives, the iframe is sized to its
  // natural px and gets a `transform: scale(...)`. In jsdom ResizeObserver is an
  // inert stub and the wrapper has no layout (clientWidth 0) → the guarded measure
  // falls back to scale(1). Proves the message is HONORED in non-embed fit mode.
  it('in fit mode: contentSize sizes the iframe to natural px + applies a centered transform (RO-absent fallback = scale 1)', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} fit />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 400, height: 300 } }));
    });
    expect(iframe.style.width).toBe('400px');
    expect(iframe.style.height).toBe('300px');
    expect(iframe.style.transform).toBe('scale(1)');
    expect(iframe.style.transformOrigin).toBe('center center');
  });

  // DISCRIMINATING: proves the fit MATH, not just that some transform got applied.
  // Mock a real ResizeObserver that fires synchronously on observe(), with a wrapper
  // measuring 200×150 against a 400×300 diagram → scale = min(200/400, 150/300, 1)
  // = min(0.5, 0.5, 1) = 0.5. A broken min() (e.g. dropping a term or the cap) yields
  // a different number and fails here.
  it('in fit mode: computes scale < 1 when the wrapper is smaller than the content', () => {
    const observed: Element[] = [];
    class FakeRO {
      constructor(private cb: ResizeObserverCallback) {}
      observe(el: Element) {
        observed.push(el);
        // Make the wrapper report a measurable size smaller than the diagram.
        Object.defineProperty(el, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(el, 'clientHeight', { value: 150, configurable: true });
        this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    }
    const prev = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeRO as unknown as typeof ResizeObserver;
    try {
      const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} fit />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 400, height: 300 } }));
      });
      expect(observed.length).toBeGreaterThan(0);
      expect(iframe.style.transform).toBe('scale(0.5)');
    } finally {
      globalThis.ResizeObserver = prev;
    }
  });

  // GUARD: a missing ResizeObserver must not crash and must leave scale at 1.
  it('in fit mode: missing ResizeObserver does not crash (scale stays 1)', () => {
    const prev = globalThis.ResizeObserver;
    // @ts-expect-error intentionally remove for the feature-detect path
    delete globalThis.ResizeObserver;
    try {
      const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} fit />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 400, height: 300 } }));
      });
      expect(iframe.style.width).toBe('400px');
      expect(iframe.style.transform).toBe('scale(1)');
    } finally {
      globalThis.ResizeObserver = prev;
    }
  });

  // Embed must stay byte-identical even if `fit` is somehow also set: embed wins.
  it('embed sizing is unchanged when fit is also true (embed branch wins)', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} embed fit />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 265, height: 344 } }));
    });
    expect(iframe.style.width).toBe('265px');
    expect(iframe.style.height).toBe('344px');
    expect(iframe.style.transform).toBe('');
    expect(iframe.className).toBe('border-0');
  });
});
