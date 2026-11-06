import { describe, it, expect } from 'vitest';
import { computeCss } from './transpilers';

describe('computeCss', () => {
  it('passes plain CSS through unchanged', async () => {
    expect(await computeCss('.a{color:red}', 'css', undefined)).toEqual({ code: '.a{color:red}' });
  });
  it('returns empty for ACSS when no settings present', async () => {
    const r = await computeCss('<div class="D(b)">', 'acss', undefined);
    expect(r.code).toBe('');
  });
  it('falls back to {} on malformed ACSS config instead of rejecting', async () => {
    // Must resolve (not throw/reject) — legacy degraded a bad config to {}.
    const r = await computeCss('<div>', 'acss', { acssConfig: '{bad json' });
    expect(typeof r.code).toBe('string');
  });
  it('reports a real (non-hardcoded) line + meaningful message for invalid SCSS', async () => {
    // Error is on line 2 (1-based); sass span.start.line is 0-based → 1.
    // > 0 discriminates against the old hardcoded `lineNumber: 0` without
    // over-pinning the exact value.
    const r = await computeCss('.a {\n  color: ;\n}', 'scss', undefined);
    expect(r.errors).toBeTruthy();
    expect(typeof r.errors![0].lineNumber).toBe('number');
    expect(r.errors![0].lineNumber).toBeGreaterThan(0);
    expect(r.errors![0].message.length).toBeGreaterThan(0);
  });
  it('reports the plain sass message, without the code frame or terminal colour codes', async () => {
    // The lint tooltip shows this text; the browser build of sass colours its
    // code frame with ANSI escapes, which rendered as "[34m … [0m" noise.
    const r = await computeCss('.a {\n  color: ;\n}', 'scss', undefined);
    expect(r.errors![0].message).toBe('Expected expression.');
  });
});
