import { describe, it, expect } from 'vitest';
import { PREVIEW_BOOTSTRAP } from './previewBootstrap';

describe('PREVIEW_BOOTSTRAP', () => {
  it('instantiates the engine on #mounting-point and posts ready', () => {
    expect(PREVIEW_BOOTSTRAP).toContain("new window.zenuml.default('#mounting-point')");
    expect(PREVIEW_BOOTSTRAP).toContain("type: 'ready'");
  });
  it('renders with the fixed theme and reads stickyOffset from the message, not window.location', () => {
    expect(PREVIEW_BOOTSTRAP).toContain("theme: 'theme-default'");
    expect(PREVIEW_BOOTSTRAP).toContain('msg.options');
    expect(PREVIEW_BOOTSTRAP).not.toContain('window.location.search');
  });
  it('awaits render so rejections post error and rendered posts only on success', () => {
    expect(PREVIEW_BOOTSTRAP).toContain('await app.render');
  });
  it('guards the message listener to the parent source', () => {
    expect(PREVIEW_BOOTSTRAP).toContain('e.source !== parent');
  });
  it('handles updateCss, getPng and evalConsole, and forwards codeChange', () => {
    expect(PREVIEW_BOOTSTRAP).toContain("'updateCss'");
    expect(PREVIEW_BOOTSTRAP).toContain("'getPng'");
    expect(PREVIEW_BOOTSTRAP).toContain("'evalConsole'");
    expect(PREVIEW_BOOTSTRAP).toContain("type: 'codeChange'");
  });
});
