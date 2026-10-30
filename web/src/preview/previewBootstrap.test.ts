import { describe, it, expect, vi } from 'vitest';
// The bootstrap is now a real `.js` asset (CSP fix — roadmap §9 M05 finding #1),
// loaded via `<script src=...>` rather than an inline string. Import its source
// text via Vite's `?raw` so the content assertions stay bulletproof — a content
// revert still fails these tests.
import BOOTSTRAP from './previewBootstrap.runtime.js?raw';

describe('previewBootstrap.runtime.js', () => {
  it('instantiates the engine on #mounting-point and posts ready', () => {
    expect(BOOTSTRAP).toContain("new window.zenuml.default('#mounting-point')");
    expect(BOOTSTRAP).toContain("type: 'ready'");
  });
  it('keeps SVG on the default theme and reads HTML options from the message', () => {
    expect(BOOTSTRAP).toContain("renderToSvg(msg.code, { theme: 'theme-default' })");
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
    const frameWindow = {
      zenuml: { default: Engine },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameDocument = {
      getElementById: (id: string) => id === 'mounting-point' || id === 'diagram' ? mount : null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { insertBefore: vi.fn() },
      querySelector: () => null,
      documentElement: { scrollHeight: 100, scrollWidth: 100 },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, frameDocument, parent, frameConsole, vi.fn(), undefined,
    );

    listeners.load();
    listeners.message({
      source: parent,
      data: { type: 'render', code: 'A.b', options: { renderMode: 'html', enableParticipantStyleEditing: true } },
    });
    expect(renderCore).toHaveBeenCalledWith('A.b', expect.objectContaining({ enableParticipantStyleEditing: true }));
    renderCore.mock.calls[0][1].onContentChange('A #FF0000');
    expect(postMessage).toHaveBeenCalledWith({ type: 'codeChange', code: 'A #FF0000' }, '*');
  });
  it('clears the dark HTML correction before switching to SVG', () => {
    document.head.innerHTML = '<style id="zenumlstyle"></style>';
    document.body.innerHTML = '<div id="diagram"><div id="mounting-point"></div></div>';
    const listeners: Record<string, (event?: any) => void> = {};
    const parent = { postMessage: vi.fn() };
    const frameWindow = {
      zenuml: {
        default: class { render = vi.fn(async () => {}); },
        renderToSvg: vi.fn(() => ({ svg: '<svg viewBox="0 0 100 100"></svg>' })),
      },
      addEventListener: (type: string, listener: (event?: any) => void) => { listeners[type] = listener; },
    };
    const frameConsole = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map((level) => [level, vi.fn()]));
    new Function('window', 'document', 'parent', 'console', 'requestAnimationFrame', 'ResizeObserver', BOOTSTRAP)(
      frameWindow, document, parent, frameConsole, vi.fn(), undefined,
    );
    listeners.load();
    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'html', theme: 'theme-clean-dark' } } });
    expect(document.getElementById('zenuml-theme-base')?.textContent).toContain('html,body{background:#111628}');

    // Darcula (editor dark appearance): the iframe page matches the diagram canvas
    // instead of leaving a white page around the dark diagram.
    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'html', theme: 'theme-darcula' } } });
    expect(document.getElementById('zenuml-theme-base')?.textContent).toBe('html,body{background:#2b2b2b}.zenuml .bg-skin-canvas{--color-bg-canvas:#2b2b2b}');

    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'html', theme: 'theme-default' } } });
    expect(document.getElementById('zenuml-theme-base')?.textContent).toBe('');

    listeners.message({ source: parent, data: { type: 'render', code: 'A.b', options: { renderMode: 'svg', theme: 'theme-clean-dark' } } });
    expect(document.getElementById('zenuml-theme-base')?.textContent).toBe('');
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
  // Custom CSS must win over the core stylesheet at equal specificity. @zenuml/core
  // appends its own <style> to <head> at runtime, AFTER the #zenumlstyle rail from
  // the srcdoc, so a user rule like `.zenuml .participant { color }` lost to
  // `.zenuml .text-skin-participant` and never applied.
  it("keeps the user CSS rail (#zenumlstyle) last in <head> after core injects styles", async () => {
    document.head.innerHTML = "<style id=\"zenumlstyle\"></style>";
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
    // The dark-theme base correction stays BEFORE the user rail, so users can override it.
    const ids = [...document.head.children].map((el) => el.id);
    expect(ids.indexOf("zenuml-theme-base")).toBeLessThan(ids.indexOf("zenumlstyle"));
  });
});
