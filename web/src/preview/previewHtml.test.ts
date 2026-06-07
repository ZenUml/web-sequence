import { describe, it, expect, vi } from 'vitest';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));
vi.mock('./previewBootstrap.runtime.js?url', () => ({ default: '/bootstrap-test-url.js' }));

import { getCompleteHtml, MOUNT_HTML, EMBED_CHROME_SUPPRESS_CSS } from './previewHtml';

describe('getCompleteHtml', () => {
  it('includes an empty zenuml style hook, mount point, core script, and external bootstrap', () => {
    // CSS is NEVER baked into the initial doc (pushed via updateCss after ready),
    // so the style element is present but empty even when css is passed.
    const html = getCompleteHtml({ css: '.x{color:red}' });
    expect(html).toContain('<style id="zenumlstyle"></style>');
    expect(html).not.toContain('.x{color:red}');
    expect(html).toContain('id="mounting-point"');
    expect(html).toContain('<script src="/zenuml-test-url.js"></script>');
    // The bootstrap loads as an EXTERNAL same-origin asset (CSP fix).
    expect(html).toContain('<script src="/bootstrap-test-url.js"></script>');
  });

  // DISCRIMINATING (roadmap §9 M05 finding #1): an inline <script> block is blocked
  // under the packaged MV3 extension's `script-src 'self'` CSP. The document must
  // contain NO inline executable script — every <script> must carry a `src=`.
  // Reverting to an inline `<script>${PREVIEW_BOOTSTRAP}</script>` fails this.
  it('contains no inline executable <script> block (every script is external)', () => {
    const html = getCompleteHtml({});
    const scriptTags = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const tag of scriptTags) {
      expect(tag).toMatch(/\bsrc=/);
    }
    // No bootstrap body inlined into the document.
    expect(html).not.toContain("new window.zenuml.default('#mounting-point')");
    expect(html).not.toContain('addEventListener');
  });

  it('defaults css to empty and still produces a valid doc', () => {
    const html = getCompleteHtml({});
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain(MOUNT_HTML);
  });

  // M05 embed chrome suppression. DISCRIMINATING: the suppression <style> must be
  // present ONLY when embed=true. Dropping the embed branch (so the style is always
  // emitted) fails the "absent otherwise" cases; ignoring the flag (never emitting)
  // fails the embed=true case.
  it('injects the embed chrome-suppression style ONLY when embed=true', () => {
    const embedHtml = getCompleteHtml({ embed: true });
    expect(embedHtml).toContain('<style id="zenuml-embed-suppress">');
    expect(embedHtml).toContain(EMBED_CHROME_SUPPRESS_CSS);
    // Targets the real @zenuml/core DOM hooks for the chrome we must hide.
    expect(embedHtml).toContain('.footer{display:none !important}');
    // DISCRIMINATING: the skin-specific class (.bg-skin-title) ensures only the
    // top chrome band is hidden, NOT the diagram-internal fragment headers
    // (loop/alt/opt/par labels which use .header.bg-skin-fragment-header).
    // Reverting to the bare `.header` selector would hide fragment labels (regression).
    // Reverting to `.header .hide-export` would leave an empty white chrome band visible.
    expect(embedHtml).toContain('.header.bg-skin-title{display:none !important}');
    // The old child-selector form must NOT be present (it left the chrome band visible).
    expect(embedHtml).not.toContain('.header .hide-export');

    // Not in the normal editor preview (embed omitted or false).
    expect(getCompleteHtml({}).includes('zenuml-embed-suppress')).toBe(false);
    expect(getCompleteHtml({ embed: false }).includes('zenuml-embed-suppress')).toBe(false);
  });

  // The suppression style is SEPARATE from the user-CSS rail: the existing empty
  // #zenumlstyle hook is preserved in embed mode (updateCss still targets it).
  it('keeps the empty user-css style hook even in embed mode', () => {
    const embedHtml = getCompleteHtml({ embed: true });
    expect(embedHtml).toContain('<style id="zenumlstyle"></style>');
  });
});
