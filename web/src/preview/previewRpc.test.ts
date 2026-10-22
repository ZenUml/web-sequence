import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewRpc, PreviewRpcError } from './previewRpc';
import type { FrameMessage } from './previewProtocol';

let iframe: HTMLIFrameElement;
let other: HTMLIFrameElement;

beforeEach(() => {
  iframe = document.createElement('iframe');
  other = document.createElement('iframe');
  document.body.append(iframe, other);
});

afterEach(() => {
  iframe.remove();
  other.remove();
  vi.useRealTimers();
});

function fromFrame(data: unknown, source: Window | null = iframe.contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}

describe('createPreviewRpc', () => {
  it('request posts the message with a fresh id and resolves on the matching reply', async () => {
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    const first = rpc.request((id) => ({ type: 'getSvg', id }), (m, id) => m.type === 'svg' && m.id === id);
    const second = rpc.request((id) => ({ type: 'getSvg', id }), (m, id) => m.type === 'svg' && m.id === id);
    const ids = post.mock.calls.map(([message]) => (message as { id: number }).id);
    expect(new Set(ids).size).toBe(2);
    fromFrame({ type: 'svg', id: ids[1], svg: '<svg b/>' });
    fromFrame({ type: 'svg', id: ids[0], svg: '<svg a/>' });
    await expect(first).resolves.toEqual({ type: 'svg', id: ids[0], svg: '<svg a/>' });
    await expect(second).resolves.toEqual({ type: 'svg', id: ids[1], svg: '<svg b/>' });
    rpc.dispose();
  });

  it('wait resolves on a matching message without posting anything', async () => {
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const ready = rpc.wait((m) => m.type === 'ready');
    fromFrame({ type: 'ready' });
    await expect(ready).resolves.toEqual({ type: 'ready' });
    rpc.dispose();
  });

  it('ignores messages from another window and messages outside the protocol', async () => {
    vi.useFakeTimers();
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const ready = rpc.wait((m) => m.type === 'ready', { timeoutMs: 1000 });
    const settled = vi.fn();
    ready.then(settled, settled);
    fromFrame({ type: 'ready' }, other.contentWindow);
    fromFrame({ type: 'notInProtocol' });
    fromFrame('ready');
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).not.toHaveBeenCalled();
    fromFrame({ type: 'ready' });
    await expect(ready).resolves.toEqual({ type: 'ready' });
    rpc.dispose();
  });

  it('rejects with reason "timeout" after timeoutMs', async () => {
    vi.useFakeTimers();
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const ready = rpc.wait((m) => m.type === 'ready', { timeoutMs: 500 });
    const caught = ready.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(500);
    const error = await caught;
    expect(error).toBeInstanceOf(PreviewRpcError);
    expect((error as PreviewRpcError).reason).toBe('timeout');
    rpc.dispose();
  });

  it('rejects with reason "aborted" when the signal aborts, before or during the wait', async () => {
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const during = new AbortController();
    const pending = rpc.wait((m) => m.type === 'ready', { signal: during.signal });
    during.abort();
    await expect(pending).rejects.toMatchObject({ reason: 'aborted' });

    const before = new AbortController();
    before.abort();
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    const request = rpc.request((id) => ({ type: 'getPng', id }), (m, id) => m.type === 'png' && m.id === id, { signal: before.signal });
    await expect(request).rejects.toMatchObject({ reason: 'aborted' });
    expect(post).not.toHaveBeenCalled();
    rpc.dispose();
  });

  it('a frame error rejects pending waits with reason "frame" and the frame message', async () => {
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const ready = rpc.wait((m) => m.type === 'ready');
    fromFrame({ type: 'error', message: 'render exploded' } satisfies FrameMessage);
    await expect(ready).rejects.toMatchObject({ reason: 'frame', message: 'render exploded' });
    rpc.dispose();
  });

  it('dispose removes the listener and rejects what is still pending', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const rpc = createPreviewRpc(() => iframe.contentWindow);
    const ready = rpc.wait((m) => m.type === 'ready');
    rpc.dispose();
    await expect(ready).rejects.toMatchObject({ reason: 'aborted' });
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    remove.mockRestore();
  });
});
