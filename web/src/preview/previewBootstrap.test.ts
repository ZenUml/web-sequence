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
  it('renders with the fixed theme and reads stickyOffset from the message, not window.location', () => {
    expect(BOOTSTRAP).toContain("theme: 'theme-default'");
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
});
