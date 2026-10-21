import { describe, it, expect, vi } from 'vitest';
// The bootstrap is now a real `.js` asset (CSP fix — roadmap §9 M05 finding #1),
// loaded via `<script src=...>` rather than an inline string. Import its source
// text via Vite's `?raw` so the content assertions stay bulletproof — a content
// revert still fails these tests.
import BOOTSTRAP from './previewBootstrap.runtime.js?raw';

describe('previewBootstrap.runtime.js', () => {
  it('instantiates the engine on #mounting-point and posts ready', () => {
    expect(BOOTSTRAP).toContain("new window.zenuml.default('#mounting-point', false, initial)");
    expect(BOOTSTRAP).toContain("type: 'ready'");
  });
  it('passes the requested native theme to both SVG and HTML renderers', () => {
    expect(BOOTSTRAP).toContain('renderToSvg(msg.code, { theme: theme, palette: msg.options && msg.options.palette })');
    expect(BOOTSTRAP).toContain("theme: theme,");
    expect(BOOTSTRAP).toContain('msg.options');
    expect(BOOTSTRAP).not.toContain('window.location.search');
  });
  it('awaits render so rejections post error and rendered posts only on success', () => {
    expect(BOOTSTRAP).toContain('await app.render');
  });
  it('guards the message listener to the parent source', () => {
    expect(BOOTSTRAP).toContain('e.source !== parent');
  });
  it('handles updateCss, getPng and evalConsole, and forwards codeChange', () => {
    expect(BOOTSTRAP).toContain("'updateCss'");
    expect(BOOTSTRAP).toContain("'getPng'");
    expect(BOOTSTRAP).toContain("'evalConsole'");
    expect(BOOTSTRAP).toContain("type: 'codeChange'");
  });
  it('passes participant style editing to core and forwards edited DSL to the host', () => {
    const listeners: Record<string, (event?: any) => void> = {};
    const postMessage = vi.fn();
    const parent = { postMessage };
    const renderCore = vi.fn(async (_code: string, _options: {
      enableParticipantStyleEditing: boolean;
      onContentChange: (code: string) => void;
    }) => {});
    class Engine { render = renderCore; }
    const mount = { style: {}, scrollHeight: 100, scrollWidth: 100 };
    const listenerOptions: Record<string, unknown> = {};
    const frameWindow = {
      zenuml: { default: Engine },
      addEventListener: (type: string, listener: (event?: any) => void, options?: unknown) => { listeners[type] = listener; listenerOptions[type] = options; },
    };
    const frameDocument = {
      getElementById: (id: string) => id === 'mounting-point' || id === 'diagram' ? mount : null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { insertBefore: vi.fn() },
      querySelector: () => null,
      documentElement: { scrollHeight: 100, scrollWidth: 100, getAttribute: () => null },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, frameDocument, parent, frameConsole, vi.fn(), undefined,
    );

    postMessage.mockClear();
    listeners.keydown?.({ key: 'Enter' });
    expect(postMessage).not.toHaveBeenCalled();
    expect(listeners.keydown).toBeTypeOf('function');
    expect(listenerOptions.keydown).toBe(true);
    listeners.keydown({ key: 'Escape' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'escape' }, '*');

    listeners.load();
    listeners.message({
      source: parent,
      data: { type: 'render', code: 'A.b', options: { renderMode: 'html', enableParticipantStyleEditing: true } },
    });
    expect(renderCore).toHaveBeenCalledWith('A.b', expect.objectContaining({ enableParticipantStyleEditing: true }));
    renderCore.mock.calls[0][1].onContentChange('A #FF0000');
    expect(postMessage).toHaveBeenCalledWith({ type: 'codeChange', code: 'A #FF0000' }, '*');
  });
  it('keeps the iframe transparent through HTML and SVG theme changes', async () => {
    document.head.innerHTML = '<style id="zenuml-host-backing">html,body{background:transparent}</style><style id="zenumlstyle"></style>';
    document.body.innerHTML = '<div id="diagram"><div id="mounting-point"></div></div>';
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const frameWindow = {
      zenuml: {
        default: class {
          render = vi.fn(async () => {});
        },
        renderToSvg: vi.fn(() => ({ svg: '<svg viewBox="0 0 100 100"></svg>', width: 100, height: 100 })),
      },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    listeners.load();
    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'html', theme: 'theme-dark' } } });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'rendered' }), '*'));

    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'html', theme: 'theme-default' } } });
    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'svg', theme: 'theme-dark' } } });
    await vi.waitFor(() => expect(frameWindow.zenuml.renderToSvg).toHaveBeenCalledWith('A.b', { theme: 'theme-dark' }));
    expect(document.getElementById('zenuml-host-backing')?.textContent).toBe('html,body{background:transparent}');
    expect(parent.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'surface' }), '*');
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });
  it('updates CSS without painting the iframe backing or rerendering', async () => {
    document.head.innerHTML = '<style id="zenuml-host-backing">html,body{background:transparent}</style><style id="zenumlstyle"></style>';
    document.body.innerHTML = '<div id="diagram"><div id="mounting-point"></div></div>';
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const renderCore = vi.fn(async () => {});
    const frameWindow = {
      zenuml: { default: class { render = renderCore; } },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    listeners.load();
    listeners.message({ source: parent, data: { type: 'render', token: 7, code: 'A.b', options: { theme: 'theme-dark' } } });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'rendered', token: 7 }), '*'));
    listeners.message({ source: parent, data: { type: 'updateCss', css: '#diagram .bg-skin-canvas{background:#fff}' } });
    expect(renderCore).toHaveBeenCalledTimes(1);
    expect(document.getElementById('zenumlstyle')?.textContent).toContain('background:#fff');
    expect(document.getElementById('zenuml-host-backing')?.textContent).toContain('transparent');
    expect(parent.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'surface' }), '*');
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });
  it('passes the initial dark palette before the first render and rejects a late older render', async () => {
    document.documentElement.setAttribute('data-zenuml-initial-theme', 'theme-dark');
    document.documentElement.setAttribute('data-zenuml-initial-palette', encodeURIComponent(JSON.stringify({ frameBg: '#343F4B' })));
    document.head.innerHTML = '<style id="zenumlstyle"></style>';
    document.body.innerHTML = '<div id="diagram"><div id="mounting-point"></div></div>';
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const resolutions = new Map<string, () => void>();
    const renderCore = vi.fn((code: string) => new Promise<void>((resolve) => resolutions.set(code, resolve)));
    const constructorOptions = vi.fn();
    const frameWindow = {
      zenuml: { default: class {
        constructor(_mount: string, _naked: boolean, options: unknown) { constructorOptions(options); }
        render = renderCore;
      } },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    listeners.load();
    expect(constructorOptions).toHaveBeenCalledWith({ theme: 'theme-dark', palette: { frameBg: '#343F4B' } });
    listeners.message({ source: parent, data: { type: 'render', token: 1, code: 'old', options: { theme: 'theme-dark' } } });
    listeners.message({ source: parent, data: { type: 'render', token: 2, code: 'new', options: { theme: 'theme-dark' } } });
    resolutions.get('new')!();
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'rendered', token: 2 }), '*',
    ));
    resolutions.get('old')!();
    await Promise.resolve();
    expect(parent.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'rendered', token: 1 }), '*');
    document.documentElement.removeAttribute('data-zenuml-initial-theme');
    document.documentElement.removeAttribute('data-zenuml-initial-palette');
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });
  // Mobile SVG mode: when options.renderMode === 'svg', render the native vector SVG
  // (window.zenuml.renderToSvg) instead of the HTML diagram, sized fit-to-width so the
  // full diagram shows by default.
  it('renders the native SVG (renderToSvg) fit-to-width when renderMode is svg', () => {
    expect(BOOTSTRAP).toContain('renderToSvg');
    expect(BOOTSTRAP).toContain('renderMode');
    expect(BOOTSTRAP).toContain("'svg'");
    // fit-to-width: width 100% + height auto on the injected <svg>.
    expect(BOOTSTRAP).toContain("'100%'");
  });
  it('forwards explicit backing to core exports and leaves the default transparent', async () => {
    document.head.innerHTML = '<style id="zenuml-host-backing">html,body{background:transparent}</style><style id="zenumlstyle"></style>';
    document.body.innerHTML = '<div id="diagram"><div id="mounting-point"></div></div>';
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const getPng = vi.fn(async () => 'data:image/png;base64,AAAA');
    const getSvg = vi.fn(async () => '<svg></svg>');
    const frameWindow = {
      zenuml: { default: class { render = vi.fn(async () => {}); getPng = getPng; getSvg = getSvg; } },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    listeners.load();
    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { theme: 'theme-dark' } } });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'rendered' }), '*'));
    listeners.message({ source: parent, data: { type: 'getPng', id: 1 } });
    listeners.message({ source: parent, data: { type: 'getPng', id: 2, backingColor: '#123456' } });
    listeners.message({ source: parent, data: { type: 'getSvg', id: 3 } });
    listeners.message({ source: parent, data: { type: 'getSvg', id: 4, backingColor: '#123456' } });
    await vi.waitFor(() => expect(getSvg).toHaveBeenCalledTimes(2));
    expect(getPng).toHaveBeenNthCalledWith(1, { backingColor: undefined });
    expect(getPng).toHaveBeenNthCalledWith(2, { backingColor: '#123456' });
    expect(getSvg).toHaveBeenNthCalledWith(1, { backingColor: undefined });
    expect(getSvg).toHaveBeenNthCalledWith(2, { backingColor: '#123456' });
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });
  it('asks core to flatten native SVG once, then rasterizes that SVG without another backing fill', async () => {
    document.head.innerHTML = '<style id="zenumlstyle"></style>';
    document.body.innerHTML = '<div id="diagram"><div id="mounting-point"></div></div>';
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const renderToSvg = vi.fn((_code: string, options: { backingColor?: string }) => ({
      svg: `<svg viewBox="0 0 100 100">${options.backingColor ? '<rect class="export-backing" fill="rgb(18, 52, 86)" style="fill:rgb(18, 52, 86) !important" width="100" height="100"/>' : ''}<rect class="frame" x="5" y="5" width="90" height="90"/></svg>`,
      width: 100, height: 100,
    }));
    const frameWindow = {
      zenuml: { default: class {}, renderToSvg },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    listeners.load();
    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'svg', theme: 'theme-dark' } } });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'rendered' }), '*'));
    listeners.message({ source: parent, data: { type: 'getSvg', id: 1 } });
    listeners.message({ source: parent, data: { type: 'getSvg', id: 2, backingColor: '#123456' } });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'svg', id: 2 }), '*'));
    const outputs = parent.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === 'svg');
    expect(outputs.find((message) => message.id === 1)?.svg).not.toContain('export-backing');
    expect(outputs.find((message) => message.id === 2)?.svg).toContain('export-backing');
    expect(renderToSvg).toHaveBeenNthCalledWith(2, 'A.b', expect.objectContaining({ theme: 'theme-dark', backingColor: '#123456' }));
    expect(BOOTSTRAP).not.toContain('context.fillRect(');
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });
  // Custom CSS must win over the core stylesheet at equal specificity. @zenuml/core
  // appends its own <style> to <head> at runtime, AFTER the #zenumlstyle rail from
  // the srcdoc, so a user rule like `.zenuml .participant { color }` lost to
  // `.zenuml .text-skin-participant` and never applied.
  it("keeps the user CSS rail (#zenumlstyle) last in <head> after core injects styles", async () => {
    document.head.innerHTML = "<style id=\"zenuml-host-backing\">html,body{background:transparent}</style><style id=\"zenumlstyle\"></style>";
    document.body.innerHTML = "<div id=\"diagram\"><div id=\"mounting-point\"></div></div>";
    const injectCoreStyle = (tag: string) => {
      const style = document.createElement("style");
      style.dataset.core = tag;
      document.head.appendChild(style);
    };
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const frameWindow = {
      zenuml: {
        default: class {
          constructor() { injectCoreStyle("init"); }
          render = vi.fn(async () => { injectCoreStyle("render"); });
        },
      },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(["log", "info", "warn", "error", "debug"].map((level) => [level, vi.fn()]));
    new Function("window", "document", "parent", "console", "requestAnimationFrame", "ResizeObserver", BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    const lastStyleId = () => document.head.lastElementChild?.id;

    listeners.load();
    expect(lastStyleId()).toBe("zenumlstyle");

    listeners.message({ source: parent, data: { type: "render", code: "A.b", options: { renderMode: "html" } } });
    await vi.waitFor(() => expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "rendered" }), "*"));
    expect(lastStyleId()).toBe("zenumlstyle");

    injectCoreStyle("late");
    listeners.message({ source: parent, data: { type: "updateCss", css: ".zenuml .participant{color:red}" } });
    expect(lastStyleId()).toBe("zenumlstyle");
    expect(document.getElementById("zenumlstyle")!.textContent).toBe(".zenuml .participant{color:red}");
    // The host backing stays before the user rail, so custom CSS can override it.
    const ids = [...document.head.children].map((el) => el.id);
    expect(ids.indexOf("zenuml-host-backing")).toBeLessThan(ids.indexOf("zenumlstyle"));
  });
});
