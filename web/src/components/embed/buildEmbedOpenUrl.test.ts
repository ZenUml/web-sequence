import { describe, it, expect } from 'vitest';
import { CANONICAL_APP_ORIGIN } from '../../config/shareOrigin';
import { buildEmbedOpenUrl } from './buildEmbedOpenUrl';

const base = { embedByValue: false, embedCode: null, embedTitle: null, itemId: null, shareToken: null };

describe('buildEmbedOpenUrl', () => {
  it('by-value embed: carries the DSL and title', () => {
    const url = new URL(buildEmbedOpenUrl({ ...base, embedByValue: true, embedCode: 'A->B: hi', embedTitle: 'Order flow' }));
    expect(url.origin).toBe(CANONICAL_APP_ORIGIN);
    expect(url.searchParams.get('code')).toBe('A->B: hi');
    expect(url.searchParams.get('title')).toBe('Order flow');
  });

  it('by-value embed without a title omits title', () => {
    const url = new URL(buildEmbedOpenUrl({ ...base, embedByValue: true, embedCode: 'A.b()' }));
    expect(url.searchParams.get('code')).toBe('A.b()');
    expect(url.searchParams.has('title')).toBe(false);
  });

  it('shared embed: carries id and share-token', () => {
    expect(buildEmbedOpenUrl({ ...base, itemId: 'abc', shareToken: 'tok' }))
      .toBe(`${CANONICAL_APP_ORIGIN}/?id=abc&share-token=tok`);
  });

  it('id-only embed: carries id', () => {
    expect(buildEmbedOpenUrl({ ...base, itemId: 'abc' })).toBe(`${CANONICAL_APP_ORIGIN}/?id=abc`);
  });

  it('nothing to open: the app root', () => {
    expect(buildEmbedOpenUrl(base)).toBe(`${CANONICAL_APP_ORIGIN}/`);
  });
});
