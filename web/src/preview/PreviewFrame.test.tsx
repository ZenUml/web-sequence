import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

import { PreviewFrame } from './PreviewFrame';

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
});
