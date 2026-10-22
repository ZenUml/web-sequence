import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PreviewExportSnapshot } from '../preview/PreviewFrame';
import { renderDiagramExport } from './renderExport';

const snapshot: PreviewExportSnapshot = { code: 'A->B: Hello', css: '', theme: 'theme-default', renderMode: 'svg' };

type Posted = { type: string; id?: number; token?: number };

/**
 * Plays the export iframe: answers ready / render / getSvg / getPng the way
 * previewBootstrap does. `script` can replace the reply to one host message.
 */
function fakeFrame(script: Partial<Record<string, (message: Posted, reply: (data: unknown) => void) => void>> = {}) {
  const posted: Posted[] = [];
  const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    append(node);
    if (node instanceof HTMLIFrameElement) {
      const frame = node.contentWindow!;
      const reply = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, source: frame }));
      vi.spyOn(frame, 'postMessage').mockImplementation((message: unknown) => {
        const m = message as Posted;
        posted.push(m);
        const custom = script[m.type];
        if (custom) return custom(m, reply);
        if (m.type === 'render') reply({ type: 'rendered', token: m.token });
        if (m.type === 'getSvg') reply({ type: 'svg', id: m.id, svg: '<svg/>' });
        if (m.type === 'getPng') reply({ type: 'png', id: m.id, dataUrl: 'data:image/png;base64,AA' });
      });
      queueMicrotask(() => (script.ready ? script.ready({ type: 'ready' }, reply) : reply({ type: 'ready' })));
    }
    return node;
  });
  return posted;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('renderDiagramExport', () => {
  it('renders in a hidden iframe, returns the SVG, and removes the iframe', async () => {
    const posted = fakeFrame();
    await expect(renderDiagramExport(snapshot, 'light', 'svg')).resolves.toBe('<svg/>');
    expect(posted.map((m) => m.type)).toEqual(['updateCss', 'render', 'getSvg']);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('returns the PNG data URL', async () => {
    fakeFrame();
    await expect(renderDiagramExport(snapshot, 'light', 'png')).resolves.toBe('data:image/png;base64,AA');
  });

  it('ignores a reply for another request id', async () => {
    fakeFrame({
      getSvg: (m, reply) => {
        reply({ type: 'svg', id: (m.id ?? 0) + 100, svg: '<svg wrong/>' });
        reply({ type: 'svg', id: m.id, svg: '<svg right/>' });
      },
    });
    await expect(renderDiagramExport(snapshot, 'light', 'svg')).resolves.toBe('<svg right/>');
  });

  it('rejects with the frame error message', async () => {
    fakeFrame({ render: (_m, reply) => reply({ type: 'error', message: 'Parse failed' }) });
    await expect(renderDiagramExport(snapshot, 'light', 'svg')).rejects.toThrow('Parse failed');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('rejects "returned no image" on an empty result', async () => {
    fakeFrame({ getPng: (m, reply) => reply({ type: 'png', id: m.id, dataUrl: null }) });
    await expect(renderDiagramExport(snapshot, 'light', 'png')).rejects.toThrow('Diagram export returned no image.');
  });

  it('rejects "cancelled" when the caller aborts', async () => {
    const controller = new AbortController();
    fakeFrame({ render: () => controller.abort() });
    await expect(renderDiagramExport(snapshot, 'light', 'svg', controller.signal)).rejects.toThrow('Diagram export cancelled.');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('rejects "timed out" when the frame never answers', async () => {
    vi.useFakeTimers();
    fakeFrame({ ready: () => {} });
    const result = renderDiagramExport(snapshot, 'light', 'svg').catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(15000);
    await expect(result).resolves.toBe('Diagram export timed out.');
  });

  it('rejects SVG export with custom CSS before creating an iframe', async () => {
    const posted = fakeFrame();
    await expect(renderDiagramExport({ ...snapshot, css: '.x{}' }, 'light', 'svg')).rejects.toThrow(/does not support custom CSS/);
    expect(posted).toEqual([]);
  });
});
