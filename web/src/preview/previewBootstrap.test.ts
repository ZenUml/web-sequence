import { describe, it, expect } from 'vitest';
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
