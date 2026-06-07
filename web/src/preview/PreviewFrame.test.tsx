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
});
