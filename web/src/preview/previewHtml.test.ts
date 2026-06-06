import { describe, it, expect, vi } from 'vitest';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

import { getCompleteHtml, MOUNT_HTML } from './previewHtml';

describe('getCompleteHtml', () => {
  it('includes an empty zenuml style hook, mount point, core script, and bootstrap', () => {
    // CSS is NEVER baked into the initial doc (pushed via updateCss after ready),
    // so the style element is present but empty even when css is passed.
    const html = getCompleteHtml({ css: '.x{color:red}' });
    expect(html).toContain('<style id="zenumlstyle"></style>');
    expect(html).not.toContain('.x{color:red}');
    expect(html).toContain('id="mounting-point"');
    expect(html).toContain('<script src="/zenuml-test-url.js"></script>');
    expect(html).toContain("new window.zenuml.default('#mounting-point')");
  });
  it('defaults css to empty and still produces a valid doc', () => {
    const html = getCompleteHtml({});
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain(MOUNT_HTML);
  });
});
