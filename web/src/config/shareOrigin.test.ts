import { CANONICAL_APP_ORIGIN, shareOrigin } from './shareOrigin';

describe('shareOrigin', () => {
  it('uses the real location origin for the web app (non-extension)', () => {
    expect(shareOrigin({ isExtension: false }, 'https://staging.zenuml.com')).toBe('https://staging.zenuml.com');
    expect(shareOrigin({ isExtension: false }, 'http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('overrides to the canonical app origin under the extension', () => {
    expect(shareOrigin({ isExtension: true }, 'chrome-extension://abcdef')).toBe(CANONICAL_APP_ORIGIN);
    expect(CANONICAL_APP_ORIGIN).toBe('https://app.zenuml.com');
  });
});
