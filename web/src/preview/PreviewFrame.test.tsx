import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

import { TEMPLATES } from '../domain/templates';
import { computeCss } from './transpilers';
import { PreviewFrame, type PreviewHandle } from './PreviewFrame';

describe('PreviewFrame', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('accepts Escape only from its own iframe while presenting, without replacing the iframe', () => {
    const onExitPresentation = vi.fn();
    const props = { code: 'A.b', css: '', stickyOffset: 0, onExitPresentation };
    const { container, rerender } = render(<PreviewFrame {...props} fit />);
    const iframe = container.querySelector('iframe')!;
    const send = (source: MessageEventSource | null) => act(() => {
      window.dispatchEvent(new MessageEvent('message', { source, data: { type: 'escape' } }));
    });
    send(window);
    expect(onExitPresentation).not.toHaveBeenCalled();
    send(iframe.contentWindow);
    expect(onExitPresentation).toHaveBeenCalledTimes(1);
    rerender(<PreviewFrame {...props} />);
    expect(container.querySelector('iframe')).toBe(iframe);
    send(iframe.contentWindow);
    expect(onExitPresentation).toHaveBeenCalledTimes(1);
    rerender(<PreviewFrame {...props} fit embed />);
    send(iframe.contentWindow);
    expect(onExitPresentation).toHaveBeenCalledTimes(1);
  });

  it.each(['black-white', 'blue', 'starUMLTheme'])('keeps real compiled %s template CSS on the compatible renderer when mobile requests SVG', async (id) => {
    const item = TEMPLATES.find(t => t.id === id)!.item;
    const { code: css } = await computeCss(item.css!, item.cssMode!, item.cssSettings);
    const ref = createRef<PreviewHandle>();
    const { container } = render(<PreviewFrame ref={ref} code={item.js!} css={css} stickyOffset={0} svgMode readOnly />);
    const iframe = container.querySelector('iframe')!;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })));
    const message = post.mock.calls.find(([m]) => m.type === 'render')![0];
    expect(message.options.renderMode).toBe('html');
    expect(message.options.enableParticipantStyleEditing).toBe(false);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'updateCss', css, revision: expect.any(Number) }), '*');
    act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'rendered', token: message.token } })));
    expect(ref.current!.getExportSnapshot()).toMatchObject({ code: item.js, css, renderMode: 'html' });
  });

  it('switches blank SVG → custom CSS HTML → blank SVG without remount, stale ack or hidden-edit export', () => {
    const ref = createRef<PreviewHandle>();
    const base = { code: 'A.b', css: '', stickyOffset: 0, svgMode: true, readOnly: true, autoPreview: false };
    const { container, rerender } = render(<PreviewFrame ref={ref} {...base} />);
    const iframe = container.querySelector('iframe')!;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    const send = (data: unknown) => act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data })));
    const latest = () => post.mock.calls.filter(([m]) => m.type === 'render').at(-1)![0];
    send({ type: 'ready' }); const svg = latest();
    send({ type: 'rendered', token: svg.token });
    expect(ref.current!.getExportSnapshot()?.renderMode).toBe('svg');
    rerender(<PreviewFrame ref={ref} {...base} code="Unsaved.edit" css=".participant{background:red}" />);
    const html = latest();
    expect(html.options).toMatchObject({ renderMode: 'html', enableParticipantStyleEditing: false });
    expect(html.code).toBe('A.b');
    expect(container.querySelector('iframe')).toBe(iframe);
    expect(ref.current!.getExportSnapshot()).toBeNull();
    send({ type: 'rendered', token: svg.token });
    expect(ref.current!.getExportSnapshot()).toBeNull();
    send({ type: 'rendered', token: html.token });
    expect(ref.current!.getExportSnapshot()).toMatchObject({ renderMode: 'html', code: 'A.b', css: '.participant{background:red}' });
    rerender(<PreviewFrame ref={ref} {...base} />);
    const cleared = latest();
    expect(cleared.options.renderMode).toBe('svg');
    expect(ref.current!.getExportSnapshot()).toBeNull();
    expect(container.querySelector('iframe')).toBe(iframe);
  });

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

  it.each([
    { mode: 'editor', props: {}, enabled: true },
    { mode: 'shared visitor', props: { readOnly: true }, enabled: false },
    { mode: 'embed', props: { embed: true }, enabled: false },
    { mode: 'presentation', props: { fit: true }, enabled: false },
    { mode: 'mobile SVG', props: { svgMode: true }, enabled: false },
  ])('posts participant style editing $enabled in $mode mode', ({ props, enabled }) => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} {...props} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'render',
        options: expect.objectContaining({ enableParticipantStyleEditing: enabled }),
      }),
      '*',
    );
  });

  it('turns participant style editing off in presentation and back on in the editor even with auto-preview off', () => {
    const base = { code: 'A.b', css: '', stickyOffset: 0, autoPreview: false };
    const { container, rerender } = render(<PreviewFrame {...base} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });

    post.mockClear();
    rerender(<PreviewFrame {...base} fit />);
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', options: expect.objectContaining({ enableParticipantStyleEditing: false }) }),
      '*',
    );

    post.mockClear();
    rerender(<PreviewFrame {...base} />);
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', options: expect.objectContaining({ enableParticipantStyleEditing: true }) }),
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

  // #824: auto-preview gating + the manual render() handle. These are the cheap,
  // debounce-precise mirror of e2e PRV-6 (with auto-preview OFF, edits don't re-render
  // until a manual refresh). Fake timers let us advance PAST the 500ms debounce and
  // prove the always-on render did NOT fire — the false-green the old e2e missed.
  it('with autoPreview OFF, a code change does NOT re-render even after the debounce', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(
        <PreviewFrame code="A.b" css="" stickyOffset={0} autoPreview={false} />,
      );
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      const post = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
      act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
      post.mockClear(); // ignore the ready-triggered render

      rerender(<PreviewFrame code="C.d" css="" stickyOffset={0} autoPreview={false} />); // edit
      act(() => { vi.advanceTimersByTime(2000); }); // well past PREVIEW_DEBOUNCE (500ms)

      // Auto-preview is OFF → no render posted for the edit.
      expect(post).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'render', code: 'C.d' }), '*',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches HTML theme without revealing unsaved DSL when auto-preview is off', () => {
    const base = { css: '', stickyOffset: 0, autoPreview: false };
    const { container, rerender } = render(<PreviewFrame {...base} code="A.b" />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    rerender(<PreviewFrame {...base} code="C.d" />);
    post.mockClear();
    rerender(<PreviewFrame {...base} code="C.d" theme="theme-clean-dark" />);

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', code: 'A.b', options: expect.objectContaining({ theme: 'theme-clean-dark', renderMode: 'html' }) }),
      '*',
    );
    expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'render', code: 'C.d' }), '*');
  });

  it('switches SVG theme without revealing unsaved DSL when auto-preview is off', () => {
    const base = { css: '', stickyOffset: 0, autoPreview: false, svgMode: true };
    const { container, rerender } = render(<PreviewFrame {...base} code="A.b" theme="theme-default" />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })));
    rerender(<PreviewFrame {...base} code="C.d" theme="theme-default" />);
    post.mockClear();
    rerender(<PreviewFrame {...base} code="C.d" theme="theme-dark" />);
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', code: 'A.b', options: expect.objectContaining({ theme: 'theme-dark', renderMode: 'svg' }) }),
      '*',
    );
  });

  it('with autoPreview OFF, the imperative render() forces a re-render of the current code', () => {
    const ref = createRef<PreviewHandle>();
    const { container, rerender } = render(
      <PreviewFrame ref={ref} code="A.b" css="" stickyOffset={0} autoPreview={false} />,
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });

    rerender(<PreviewFrame ref={ref} code="C.d" css="" stickyOffset={0} autoPreview={false} />); // edit (no auto render)
    post.mockClear();

    // Manual refresh → renders the LATEST code on demand.
    act(() => { ref.current!.render(); });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'render', code: 'C.d' }), '*');
  });

  it('with autoPreview ON (default), a code change re-renders after the debounce', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      const post = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
      act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
      post.mockClear();

      rerender(<PreviewFrame code="C.d" css="" stickyOffset={0} />); // edit
      act(() => { vi.advanceTimersByTime(600); }); // past the 500ms debounce

      expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'render', code: 'C.d' }), '*');
    } finally {
      vi.useRealTimers();
    }
  });

  it('render() is a no-op before the iframe reports ready', () => {
    const ref = createRef<PreviewHandle>();
    const { container } = render(<PreviewFrame ref={ref} code="A.b" css="" stickyOffset={0} autoPreview={false} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    // No 'ready' dispatched yet.
    act(() => { ref.current!.render(); });
    expect(post).not.toHaveBeenCalled();
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

  // Editor zoom (app-side): a manual zoom sizes the iframe to wrapper/scale and
  // scales it back from the top-left, and the effective scale is reported.
  it('editor zoom: manual zoom scales the iframe from the top-left and reports the scale', () => {
    const onZoomChange = vi.fn();
    const { container } = render(
      <PreviewFrame code="A.b" css="" stickyOffset={0} zoom={{ kind: 'manual', scale: 2 }} onZoomChange={onZoomChange} />,
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.style.transform).toBe('scale(2)');
    expect(iframe.style.transformOrigin).toBe('0 0');
    expect(iframe.style.width).toBe('50%');
    expect(iframe.style.height).toBe('50%');
    expect(onZoomChange).toHaveBeenLastCalledWith(2);
  });

  // DISCRIMINATING: fit-width uses viewport width / diagram width (not height).
  it('editor zoom: fit width resolves against the wrapper and diagram widths', () => {
    class FakeRO {
      constructor(private cb: ResizeObserverCallback) {}
      observe(el: Element) {
        Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
        Object.defineProperty(el, 'clientHeight', { value: 300, configurable: true });
        this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    }
    const prev = globalThis.ResizeObserver;
    globalThis.ResizeObserver = FakeRO as unknown as typeof ResizeObserver;
    try {
      const onZoomChange = vi.fn();
      const { container } = render(
        <PreviewFrame code="A.b" css="" stickyOffset={0} zoom={{ kind: 'fit-width' }} onZoomChange={onZoomChange} />,
      );
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'contentSize', width: 400, height: 600 } }));
      });
      expect(onZoomChange).toHaveBeenLastCalledWith(2);
      expect(container.querySelector('iframe')!.style.transform).toBe('scale(2)');
    } finally {
      globalThis.ResizeObserver = prev;
    }
  });

  it('editor zoom: present (fit) mode ignores the editor zoom', () => {
    const { container } = render(
      <PreviewFrame code="A.b" css="" stickyOffset={0} fit zoom={{ kind: 'manual', scale: 2 }} />,
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
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

  // ---- SVG render mode (mobile) ----
  // On mobile the HTML diagram overflows the narrow viewport (fixed-px layout, no
  // reflow). svgMode tells the iframe to render the native vector SVG instead, which
  // fits-to-width and shows the full diagram. The host signals it via renderMode.
  it('sends renderMode "svg" in the render options when svgMode is set', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} svgMode />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', options: expect.objectContaining({ renderMode: 'svg' }) }),
      '*',
    );
  });

  it('defaults renderMode to "html" when svgMode is not set', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', options: expect.objectContaining({ renderMode: 'html' }) }),
      '*',
    );
  });

  // ---- Acknowledged render delivery (WebKit dropped-postMessage fix) ----
  // WebKit/Safari silently drops a single fire-and-forget render postMessage to the
  // srcdoc iframe under tight prod timing, so the preview never re-renders after first
  // paint. Each render carries a token; the iframe echoes it in `rendered`; an unacked
  // render is re-posted.
  it('render messages carry a token', () => {
    const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', token: expect.any(Number) }),
      '*',
    );
  });

  it('re-posts the render when no "rendered" ack arrives (dropped-message resilience)', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      const post = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
      act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
      // The first render was posted with a token; capture it.
      const firstRender = post.mock.calls.find((c) => (c[0] as { type: string }).type === 'render')![0] as { token: number };
      post.mockClear();
      // No ack within the ack window → the same token is re-posted.
      act(() => { vi.advanceTimersByTime(300); });
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'render', token: firstRender.token }),
        '*',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops retrying once a matching "rendered" ack arrives', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      const post = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
      act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
      const firstRender = post.mock.calls.find((c) => (c[0] as { type: string }).type === 'render')![0] as { token: number };
      // Iframe acks the render → no further re-posts.
      act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'rendered', token: firstRender.token } })); });
      post.mockClear();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'render' }), '*');
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts a slow committed render after the delivery retry budget is exhausted', () => {
    vi.useFakeTimers();
    try {
      const ref = createRef<PreviewHandle>();
      const { container } = render(<PreviewFrame ref={ref} code="A.b" css="" stickyOffset={0} />);
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      const post = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
      act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })));
      const token = post.mock.calls.find(([message]) => message.type === 'render')![0].token;
      act(() => vi.advanceTimersByTime(2000));
      act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'rendered', token } })));
      expect(ref.current?.getExportSnapshot()).toMatchObject({ code: 'A.b' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports only the latest render surface and the latest CSS revision to its host', () => {
    const onSurfaceChange = vi.fn();
    const { container, rerender } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} onSurfaceChange={onSurfaceChange} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    const emit = (data: unknown) => act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data })));
    emit({ type: 'ready' });
    const first = post.mock.calls.find(([message]) => message.type === 'render')![0].token;
    rerender(<PreviewFrame code="A.b" css="html,body{background:#aabbcc}" stickyOffset={0} onSurfaceChange={onSurfaceChange} />);
    const cssMessage = post.mock.calls.filter(([message]) => message.type === 'updateCss').at(-1)![0];
    emit({ type: 'surface', token: first, cssRevision: cssMessage.revision - 1, backgroundColor: '#111111' });
    expect(onSurfaceChange).not.toHaveBeenCalled();
    emit({ type: 'surface', token: first, cssRevision: cssMessage.revision, backgroundColor: '#aabbcc' });
    expect(onSurfaceChange).toHaveBeenLastCalledWith('#aabbcc');
    rerender(<PreviewFrame code="A.b" css="html,body{background:#ddeeff}" stickyOffset={0} theme="theme-dark" onSurfaceChange={onSurfaceChange} />);
    const second = post.mock.calls.filter(([message]) => message.type === 'render').at(-1)![0].token;
    emit({ type: 'surface', token: first, cssRevision: cssMessage.revision, backgroundColor: '#111111' });
    expect(onSurfaceChange).toHaveBeenCalledTimes(1);
    const currentCss = post.mock.calls.filter(([message]) => message.type === 'updateCss').at(-1)![0];
    emit({ type: 'surface', token: second, cssRevision: currentCss.revision, backgroundColor: '#ddeeff' });
    expect(onSurfaceChange).toHaveBeenLastCalledWith('#ddeeff');
  });

  it('seeds dark theme and SoftDark roles in srcdoc before core loads', () => {
    const { container, rerender } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} theme="theme-dark" />);
    const iframe = container.querySelector('iframe')!;
    const srcdoc = iframe.getAttribute('srcdoc')!;
    expect(srcdoc).toContain('data-zenuml-initial-theme="theme-dark"');
    expect(srcdoc).toContain('zenuml-initial-base');
    expect(decodeURIComponent(srcdoc)).toContain('"canvasBg":"#343F4B"');
    rerender(<PreviewFrame code="A.b" css="" stickyOffset={0} theme="theme-default" />);
    expect(container.querySelector('iframe')).toBe(iframe);
  });

  it('re-renders with svg mode when svgMode flips on after ready (e.g. rotate to a narrow viewport)', () => {
    const { container, rerender } = render(<PreviewFrame code="A.b" css="" stickyOffset={0} svgMode={false} />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, data: { type: 'ready' } })); });
    post.mockClear();
    vi.useFakeTimers();
    rerender(<PreviewFrame code="A.b" css="" stickyOffset={0} svgMode />);
    act(() => { vi.runAllTimers(); });
    vi.useRealTimers();
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'render', options: expect.objectContaining({ renderMode: 'svg' }) }),
      '*',
    );
  });
});
