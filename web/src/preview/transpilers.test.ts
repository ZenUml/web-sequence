import { describe, it, expect } from 'vitest';
import { computeCss, computeJs } from './transpilers';

describe('computeCss', () => {
  it('passes plain CSS through unchanged', async () => {
    expect(await computeCss('.a{color:red}', 'css', undefined)).toEqual({ code: '.a{color:red}' });
  });
  it('returns empty for ACSS when no settings present', async () => {
    const r = await computeCss('<div class="D(b)">', 'acss', undefined);
    expect(r.code).toBe('');
  });
});

describe('computeJs', () => {
  it('passes plain JS/DSL through (no transpile for js mode)', async () => {
    expect(await computeJs('A.b', 'js')).toEqual({ code: 'A.b' });
  });
});
