import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Item } from '../../domain/types';

// DG-F3: the thumbnail compiles CSS from the same inputs as the Editor
// (AppRoot: html for ACSS, css otherwise, always with cssSettings).

const computeCss = vi.fn();
vi.mock('../../preview/transpilers', () => ({ computeCss: (...args: unknown[]) => computeCss(...args) }));

const { DiagramThumbnail } = await import('./DiagramThumbnail');

function item(extra: Partial<Item>): Item {
  return { id: 't', title: 'T', updatedOn: 1, js: 'A->B: hi', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: 'p', folderId: null, ...extra } as Item;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

// The thumbnail iframe in jsdom does not run the preview bootstrap; announce ready
// for it and record what the thumbnail posts.
function ready(container: HTMLElement) {
  const frame = container.querySelector('iframe') as HTMLIFrameElement;
  const win = frame.contentWindow as Window;
  const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {});
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'ready' }, source: win }));
  return post;
}
type Post = { mock: { calls: unknown[][] } };
const cssPosts = (post: Post) =>
  post.mock.calls
    .map((c) => c[0] as { type: string; css?: string })
    .filter((m) => m.type === 'updateCss')
    .map((m) => m.css);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => computeCss.mockReset());

describe('DiagramThumbnail CSS inputs (DG-F3)', () => {
  it('ACSS compiles item.html with cssSettings, not item.css', async () => {
    computeCss.mockResolvedValue({ code: '.C\\(red\\){color:red}' });
    const settings = { acssConfig: '{}' };
    const { container } = render(<DiagramThumbnail item={item({ cssMode: 'acss', html: '<p class="C(red)">', css: '.ignored{}', cssSettings: settings })} />);
    const post = ready(container);
    await flush();
    expect(computeCss).toHaveBeenCalledWith('<p class="C(red)">', 'acss', settings);
    expect(cssPosts(post)).toEqual(['.C\\(red\\){color:red}']);
  });

  it('SCSS and LESS still compile item.css with cssSettings; plain CSS passes through', async () => {
    computeCss.mockResolvedValue({ code: 'out' });
    const { container, rerender } = render(<DiagramThumbnail item={item({ cssMode: 'scss', css: '$a: 1;', html: '<x>' })} />);
    ready(container);
    await flush();
    expect(computeCss).toHaveBeenLastCalledWith('$a: 1;', 'scss', undefined);
    rerender(<DiagramThumbnail item={item({ cssMode: 'less', css: '@a: 1;', html: '<x>' })} />);
    ready(container);
    await flush();
    expect(computeCss).toHaveBeenLastCalledWith('@a: 1;', 'less', undefined);
    computeCss.mockClear();
    rerender(<DiagramThumbnail item={item({ cssMode: 'css', css: 'p{color:blue}' })} />);
    const post = ready(container);
    await flush();
    expect(computeCss).not.toHaveBeenCalled();
    expect(cssPosts(post)).toEqual(['p{color:blue}']);
  });

  it('an html-only change, then a cssSettings-only change, refreshes the same mounted item', async () => {
    computeCss.mockImplementation(async (code: string, _m: string, s?: { acssConfig: string }) => ({ code: `${code}|${s?.acssConfig}` }));
    const base = { cssMode: 'acss' as const, css: '', cssSettings: { acssConfig: '{"a":1}' } };
    const { container, rerender } = render(<DiagramThumbnail item={item({ ...base, html: 'one' })} />);
    ready(container);
    await flush();
    rerender(<DiagramThumbnail item={item({ ...base, html: 'two' })} />);
    let post = ready(container);
    await flush();
    expect(cssPosts(post)).toEqual(['two|{"a":1}']);
    rerender(<DiagramThumbnail item={item({ ...base, html: 'two', cssSettings: { acssConfig: '{"a":2}' } })} />);
    post = ready(container);
    await flush();
    expect(cssPosts(post)).toEqual(['two|{"a":2}']);
  });

  it('a stale compilation finishing late cannot overwrite the newer rules', async () => {
    const slow = deferred<{ code: string }>();
    computeCss.mockImplementationOnce(() => slow.promise).mockImplementation(async () => ({ code: 'new-rules' }));
    const base = { cssMode: 'acss' as const, css: '', cssSettings: { acssConfig: '{}' } };
    const { container, rerender } = render(<DiagramThumbnail item={item({ ...base, html: 'old' })} />);
    const oldPost = ready(container);
    rerender(<DiagramThumbnail item={item({ ...base, html: 'new' })} />);
    const newPost = ready(container);
    await flush();
    expect(cssPosts(newPost)).toEqual(['new-rules']);
    await act(async () => { slow.resolve({ code: 'old-rules' }); });
    await flush();
    expect(cssPosts(newPost)).toEqual(['new-rules']);
    expect(cssPosts(oldPost)).toEqual([]);
  });
});
