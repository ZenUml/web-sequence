import { trackEvent as cloudTrackEvent } from './cloudFunctions';

// Client-side analytics fan-out (REQ-ANL-1). Framework-agnostic: the debug /
// isExtension / userId context is computed by the caller (the `useAnalytics`
// hook in Task 8 reads `window.DEBUG`/`wmdebug` cookie + runtimeMode) and passed
// in. This keeps the service pure and testable — it never inspects `window` for
// routing decisions, only for the presence of CDN-loaded globals to push to.

declare global {
  interface Window {
    // GTM dataLayer (pushed to when the GTM snippet has loaded).
    dataLayer?: unknown[];
    // Mixpanel CDN global (present once the Mixpanel snippet has loaded).
    mixpanel?: { track(event: string, props?: Record<string, unknown>): void };
  }
}

export interface AnalyticsContext {
  // The signed-in user's uid, or `null` for anonymous events.
  userId: string | null;
  // Route to console instead of any network/CDN side effect.
  debug: boolean;
  // Running inside the Chrome extension (`chrome-extension:` protocol). Still
  // POSTs to /track, but skips pushing to CDN globals that aren't loaded there.
  isExtension: boolean;
}

// Emit an analytics event. Synchronous by design: callers (e.g. test 1) assert
// the cloud call landed immediately after `emit(...)`, so we must NOT `await`
// anything before firing `cloudTrackEvent`. The cloud call is fire-and-forget
// (`void` discards the promise; `trackEvent` is non-blocking and never throws).
export function emit(
  event: string,
  props: Record<string, unknown>,
  ctx: AnalyticsContext,
): void {
  const { userId, debug, isExtension } = ctx;

  // Debug mode: route to console and short-circuit — no POST, no CDN push.
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, props);
    return;
  }

  // Server path: POST /track via the non-blocking cloud-function wrapper. Plain
  // spread only — adding defaulted keys would break the strict-equality assertions.
  void cloudTrackEvent({ event, userId, ...props });

  // Client CDN path: push to GTM/Mixpanel when their snippets are present. Skipped
  // under the extension, where the CDN scripts are never injected.
  if (!isExtension) {
    if (typeof window !== 'undefined') {
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event, ...props });
      }
      if (window.mixpanel && typeof window.mixpanel.track === 'function') {
        window.mixpanel.track(event, props);
      }
    }
  }
}

// Inject the GTM/Mixpanel/Clarity CDN snippets once per session, guarded by the
// runtime context. DOCUMENTED STUB: the actual `<script>` injection mirrors the
// legacy `src/utils.js:284` Clarity loader and the GTM/Mixpanel bootstraps, but
// the real keys/snippets land later (the structure + conditional guards are the
// M04 deliverable). Under the extension the CDN scripts are never loaded — the
// bundled copies are used instead — so this is a no-op there.
export function loadClientAnalytics(ctx: { isExtension: boolean }): void {
  if (ctx.isExtension) {
    // Extension build: CDN injection is skipped (bundled analytics, M05).
    return;
  }
  // Stub: GTM/Mixpanel/Clarity <script> injection wired when the keys land.
  // Mirrors legacy Clarity loader:
  //   (function(c,l,a,r,i,t,y){ ... clarity.ms/tag/<id> ... })(window, document, ...)
}
