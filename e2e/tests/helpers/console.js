// Shared E2E helper: ignore uncaught errors thrown by third-party scripts.
//
// Deployed sites (staging/prod, reached via PW_BASE_URL) load analytics/CDN scripts
// (GTM, Cloudflare Zaraz, Clarity, Paddle) that throw their own uncaught errors we
// neither own nor can fix. Specs listening on `pageerror` treat those as noise;
// genuine app errors still fail the test. Locally there are no such scripts.
//
// Add a new noisy vendor host here once, not in each spec.
export const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js', // Cloudflare Zaraz wraps third-party tools in userscript.js
  'gtm.js',
  'googletagmanager',
  'google-analytics',
  'analytics.js',
  'clarity.js',
  'clarity.ms',
  'paddle.js',
  'cdn.paddle.com',
  'zaraz',
  'cloudflareinsights',
];

export function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}
