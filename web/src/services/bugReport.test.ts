import { describe, it, expect } from 'vitest';
import { buildIssueUrl, type BuildIssueInput } from './bugReport';

const base: BuildIssueInput = {
  description: 'Arrows render upside down',
  includeDsl: false,
  appVersion: '2026.6.7',
  userAgent: 'Mozilla/5.0 (Test)',
  view: 'editor',
  signedIn: false,
};

function body(url: string): string {
  return new URL(url).searchParams.get('body') ?? '';
}
function title(url: string): string {
  return new URL(url).searchParams.get('title') ?? '';
}

describe('buildIssueUrl', () => {
  it('targets the repo new-issue endpoint with a bug label', () => {
    const url = buildIssueUrl(base);
    expect(url.startsWith('https://github.com/ZenUml/web-sequence/issues/new?')).toBe(true);
    expect(new URL(url).searchParams.get('labels')).toBe('bug');
  });

  it('puts the first non-empty line in the title', () => {
    const url = buildIssueUrl({ ...base, description: '  \n  Arrows broken  \nmore detail' });
    expect(title(url)).toBe('Arrows broken');
  });

  it('falls back to a generic title when description is blank', () => {
    expect(title(buildIssueUrl({ ...base, description: '   \n  ' }))).toBe('Bug report');
  });

  it('includes environment lines and the description', () => {
    const b = body(buildIssueUrl(base));
    expect(b).toContain('Arrows render upside down');
    expect(b).toContain('App version: 2026.6.7');
    expect(b).toContain('Browser: Mozilla/5.0 (Test)');
    expect(b).toContain('View: editor · Signed in: no');
  });

  it('omits the DSL block when includeDsl is false', () => {
    expect(body(buildIssueUrl({ ...base, includeDsl: false, dsl: 'A -> B: x' }))).not.toContain('<details>');
  });

  it('includes the DSL block when includeDsl is true and dsl is present', () => {
    const b = body(buildIssueUrl({ ...base, includeDsl: true, dsl: 'A -> B: hello' }));
    expect(b).toContain('<details><summary>Diagram DSL</summary>');
    expect(b).toContain('A -> B: hello');
  });

  it('omits the DSL block when dsl is empty even if includeDsl is true', () => {
    expect(body(buildIssueUrl({ ...base, includeDsl: true, dsl: '   ' }))).not.toContain('<details>');
  });

  it('truncates an oversized DSL so the URL stays within budget', () => {
    const url = buildIssueUrl({ ...base, includeDsl: true, dsl: 'X'.repeat(20000) });
    expect(url.length).toBeLessThanOrEqual(6000);
    const b = body(url);
    expect(b).toContain('truncated');
    expect(b).toContain('Arrows render upside down'); // description is never dropped
  });
});
