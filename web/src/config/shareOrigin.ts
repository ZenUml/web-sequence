/**
 * Origin sent to the /create-share cloud function.
 *
 * Under the extension, `window.location.origin` is `chrome-extension://<id>`,
 * which is unreachable as a share URL. So the extension must send the canonical
 * web origin instead. The web app (app/staging/preview) keeps sending its real
 * `window.location.origin`.
 *
 * Pure + framework-agnostic: `locationOrigin` is injected (default reads
 * `window.location.origin` lazily at call time) — never read `window` at module
 * scope, so this stays testable and SSR-safe.
 */
export const CANONICAL_APP_ORIGIN = 'https://app.zenuml.com';

export function shareOrigin(
  ctx: { isExtension: boolean },
  locationOrigin: string = typeof window !== 'undefined' ? window.location.origin : CANONICAL_APP_ORIGIN,
): string {
  return ctx.isExtension ? CANONICAL_APP_ORIGIN : locationOrigin;
}
