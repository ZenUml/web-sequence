// Analytics / telemetry E2E (editor-as-landing instrumentation).
//
// WHAT THIS COVERS — the three editor-as-landing telemetry events wired in
// web/src/app/AppRoot.tsx, observed at their real transport boundary:
//   ANL-1  landed_in_editor{label:<bootKind>}  fires once per editor boot
//   ANL-2  hub_opened{label:<source>}          fires on hub arrival, re-arms on Back
//   ANL-3  first_edit                          fires once per mount on the first DSL edit
//
// TRANSPORT (verified in code, not guessed):
//   useAnalytics().track(event, props) → analytics.emit(event, props, ctx).
//   emit() (web/src/services/analytics.ts) is NOT in debug mode locally
//   (window.DEBUG unset, no `wmdebug` cookie), so it:
//     (a) POSTs to /track via cloudFunctions.trackEvent — fetch('/track', {body:
//         JSON.stringify({event, userId, ...props})}). This is the reliable
//         in-browser seam: the request fires for EVERY tracked event regardless of
//         whether any CDN snippet loaded.
//     (b) ALSO pushes to window.dataLayer / window.mixpanel — but those CDN globals
//         are NEVER injected on the local dev/preview origin (loadClientAnalytics is
//         a stub until the keys land), so (a) is what we intercept.
//   We page.route('**/track') and fulfill 200 (the real endpoint 404s locally; the
//   POST is fire-and-forget and swallows errors, but fulfilling keeps the network
//   clean and lets us read every event body). Each captured body is {event, userId,
//   category, label, ...} — we assert on event name + label, the observable contract.
//
// NOT debug-guarded: the /track POST is the production path and works against a
// deployed target too, so these tests run on the staging gate unchanged (no
// PW_BASE_URL skip needed — there is no local-only build dependency here).

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

// Deployed sites load third-party analytics/CDN scripts that throw uncaught errors
// we don't own; treat those as noise (copied from smoke.spec.js).
const THIRD_PARTY_ERROR_SOURCES = [
  'userscript.js',
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

function isThirdPartyError(err) {
  const haystack = `${err?.message || ''}\n${err?.stack || ''}`;
  return THIRD_PARTY_ERROR_SOURCES.some((src) => haystack.includes(src));
}

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

/**
 * Install a /track interceptor that records every analytics event payload and
 * fulfils the request with 200 so the app's fire-and-forget POST resolves cleanly.
 * Returns the live `events` array (mutated as events arrive) plus a helper to read
 * the names that landed for a given event type.
 *
 * MUST be installed BEFORE the navigation that boots the editor — landed_in_editor
 * fires during boot resolution, so a route registered after page.goto would miss it.
 */
async function interceptAnalytics(page) {
  const events = [];
  await page.route('**/track', async (route) => {
    const req = route.request();
    let body = {};
    try {
      body = JSON.parse(req.postData() || '{}');
    } catch {
      body = { _unparsed: req.postData() };
    }
    events.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  return {
    events,
    /** All captured payloads whose `event` matches `name`. */
    of(name) {
      return events.filter((e) => e.event === name);
    },
  };
}

/** The CM6 editor content surface. */
function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

/** Type a replacement DSL into the CM6 editor (focus → select-all → Delete → type). */
async function typeDsl(page, dsl, { timeout = 15_000 } = {}) {
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
  await suppressOneTimeModals(page);
});

// ──────────────────────────────────────────────────────────────────────────────
// ANL-1: landed_in_editor fires once per editor boot, carrying the bootKind label.
//
// On a fresh slate (storage cleared by openEditor's default navigation reaching a
// no-last-code state) bare '/' boots and useBootItem resolves to kind 'new', so
// onResolved → track('landed_in_editor', {label:'new'}). We assert EXACTLY ONE such
// event fires for the single boot, and that its label is a real bootKind.
// ──────────────────────────────────────────────────────────────────────────────
test('ANL-1: landed_in_editor fires once per editor boot with a bootKind label', async ({
  page,
}) => {
  const analytics = await interceptAnalytics(page);

  // Start from a clean slate so the boot resolution is deterministic ('new').
  // The FIRST goto('/') exists only to get an origin we can clear storage on — it
  // boots the editor too (and fires its own landed_in_editor). We then RESET the
  // captured buffer so the assertion measures exactly ONE boot: the openEditor
  // navigation below. (Two boots → two events confirms per-boot firing; we isolate
  // a single boot here to assert the once-per-boot count cleanly.)
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  analytics.events.length = 0; // discard the pre-clear boot's events
  await openEditor(page);

  // landed_in_editor is emitted from useBootItem.onResolved during boot. Poll until
  // it lands (the POST is async + fire-and-forget).
  await expect
    .poll(() => analytics.of('landed_in_editor').length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  // Settle: give any (incorrect) duplicate from this single boot time to arrive
  // before asserting the count is exactly one.
  await page.waitForTimeout(500);

  const landed = analytics.of('landed_in_editor');
  // Exactly once per THIS boot — useBootItem guards onResolved with a booted ref, so
  // a StrictMode double-mount must not double-fire within a single boot.
  expect(landed.length).toBe(1);

  // The label is the resolved bootKind — a REAL BootResult kind, never empty/garbage.
  // We don't pin the exact kind here (the prior boot's seeded sample can populate the
  // last-code slot, so this single boot may resolve to 'new' OR 'lastcode' depending
  // on ordering); the dedicated 'lastcode' test below proves the label TRACKS the
  // resolution branch. What this test asserts is the once-per-boot count + a valid,
  // navigation-category label envelope.
  const VALID_BOOT_KINDS = ['new', 'lastcode', 'item', 'code', 'shared'];
  expect(VALID_BOOT_KINDS).toContain(landed[0].label);
  // Envelope parity: editor-boot events are category 'navigation'.
  expect(landed[0].category).toBe('navigation');
});

// ──────────────────────────────────────────────────────────────────────────────
// ANL-1 (variant): a preserved last-code boot tags landed_in_editor as 'lastcode'.
//
// Proves the label actually tracks the resolution branch (not a constant). We seed
// the last-code 'code' slot via the in-app write path (edit → visibilitychange),
// reload bare '/', and assert the NEW boot's landed_in_editor carries label
// 'lastcode'. This is a real observable: a different boot path → a different label.
// ──────────────────────────────────────────────────────────────────────────────
test('ANL-1: a last-code boot tags landed_in_editor with label "lastcode"', async ({
  page,
}) => {
  const analytics = await interceptAnalytics(page);

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);

  // First boot resolved to 'new'; confirm and then clear the buffer so the reload's
  // boot is isolated.
  await expect
    .poll(() => analytics.of('landed_in_editor').length, { timeout: 10_000 })
    .toBeGreaterThan(0);

  // Type distinctive DSL so the last-code slot is non-empty (resolveBootItem branch 3
  // only returns 'lastcode' when item.js is truthy).
  const TOKEN = 'LastCodeBootProbe';
  await typeDsl(page, `${TOKEN}\nUser\nUser->${TOKEN}: hi`);
  await expect(editorLocator(page)).toContainText(TOKEN);

  // AppRoot writes the last-code 'code' slot on visibilitychange (document.hidden).
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(
    (t) => {
      const raw = localStorage.getItem('code');
      if (!raw) return false;
      try {
        return JSON.parse(raw)?.js?.includes(t);
      } catch {
        return false;
      }
    },
    TOKEN,
    { timeout: 5_000 },
  );

  // Drop everything captured so far; the reload is a brand-new boot to observe.
  analytics.events.length = 0;

  await page.reload();
  await expect(editorLocator(page)).toContainText(TOKEN, { timeout: 15_000 });

  // The reload boot reads the 'code' slot → kind 'lastcode'.
  await expect
    .poll(() => analytics.of('landed_in_editor').length, { timeout: 10_000 })
    .toBe(1);
  expect(analytics.of('landed_in_editor')[0].label).toBe('lastcode');
});

// ──────────────────────────────────────────────────────────────────────────────
// ANL-2: hub_opened{source} fires on hub arrival, and RE-ARMS on browser Back.
//
// Arriving at the hub via ?view=diagrams emits hub_opened{label:'landing-param'}.
// Going INTO the editor (open a card / new) then pressing browser Back to the hub
// must emit a SECOND hub_opened — the landing ref re-arms when isHomeMode flips
// false on leaving. Without that re-arm, hub demand is under-counted.
// ──────────────────────────────────────────────────────────────────────────────
test('ANL-2: hub_opened fires on hub arrival and re-arms on browser Back', async ({
  page,
}) => {
  const analytics = await interceptAnalytics(page);

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  // First arrival at the hub via the landing param.
  await gotoHome(page);
  await expect
    .poll(() => analytics.of('hub_opened').length, { timeout: 10_000 })
    .toBe(1);
  expect(analytics.of('hub_opened')[0].label).toBe('landing-param');
  expect(analytics.of('hub_opened')[0].category).toBe('navigation');

  // Leave the hub: the empty library shows a "New" CTA that loads a blank diagram
  // and navigates to the editor (?id=). This is a client-side navigation, so the
  // hub→editor transition flips isHomeMode false and re-arms the landing ref.
  const emptyCta = page.locator('[data-testid="home-empty-new"]');
  const homeNew = page.locator('[data-testid="home-new"]');
  if (await emptyCta.isVisible()) {
    await emptyCta.click();
  } else {
    await homeNew.click();
  }
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });

  // Browser Back returns to ?view=diagrams — a FRESH hub arrival → a 2nd hub_opened.
  await page.goBack();
  await expect(page.locator('[data-testid="home-view"]')).toBeVisible({
    timeout: 15_000,
  });

  await expect
    .poll(() => analytics.of('hub_opened').length, { timeout: 10_000 })
    .toBe(2);
  // The re-armed arrival is still a landing-param arrival (the URL carries
  // ?view=diagrams; no breadcrumb click was involved).
  expect(analytics.of('hub_opened')[1].label).toBe('landing-param');
});

// ──────────────────────────────────────────────────────────────────────────────
// ANL-2 (variant): the in-editor breadcrumb fires hub_opened{label:'breadcrumb'}.
//
// goHome() (the header breadcrumb / hub affordance) emits hub_opened with label
// 'breadcrumb' BEFORE navigating, and sets hubLandingFired up-front so the ensuing
// isHomeMode landing effect does NOT also fire 'landing-param'. So a breadcrumb
// click must produce EXACTLY ONE hub_opened, labelled 'breadcrumb'.
// ──────────────────────────────────────────────────────────────────────────────
test('ANL-2: the breadcrumb-to-hub action fires hub_opened{label:"breadcrumb"} once', async ({
  page,
}) => {
  const analytics = await interceptAnalytics(page);

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });

  // The breadcrumb back affordance that calls goHome() (AppHeader, editor mode):
  // data-testid="header-go-home", aria-label "Back to your diagrams". onGoHome is
  // wired unconditionally to goHome in the editor render, so this always renders here.
  const target = page.locator('[data-testid="header-go-home"]');
  await expect(target).toBeVisible({ timeout: 10_000 });
  await target.click();

  await expect(page.locator('[data-testid="home-view"]')).toBeVisible({
    timeout: 15_000,
  });

  await expect
    .poll(() => analytics.of('hub_opened').length, { timeout: 10_000 })
    .toBe(1);
  expect(analytics.of('hub_opened')[0].label).toBe('breadcrumb');
});

// ──────────────────────────────────────────────────────────────────────────────
// ANL-3: first_edit fires ONCE per mount on the first DSL edit (not on subsequent
// edits). handleDslChange guards with firstEditFired ref; first_edit carries
// category 'fn' and no bootKind.
// ──────────────────────────────────────────────────────────────────────────────
test('ANL-3: first_edit fires once per mount on the first DSL edit only', async ({
  page,
}) => {
  const analytics = await interceptAnalytics(page);

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });

  // No edit yet → no first_edit. (boot may have fired landed_in_editor; that's a
  // different event and is asserted in ANL-1.)
  expect(analytics.of('first_edit').length).toBe(0);

  // First user edit: type a single character into the DSL editor.
  const editor = editorLocator(page);
  await editor.click();
  await page.keyboard.press('End');
  await editor.pressSequentially('A');

  await expect
    .poll(() => analytics.of('first_edit').length, { timeout: 10_000 })
    .toBe(1);
  expect(analytics.of('first_edit')[0].category).toBe('fn');

  // Subsequent edits must NOT re-fire first_edit (once-per-mount contract). Type
  // several more characters and confirm the count stays at exactly 1.
  await editor.pressSequentially('BCDE');
  // Give any (incorrect) extra event time to land before asserting it did NOT.
  await page.waitForTimeout(750);
  expect(analytics.of('first_edit').length).toBe(1);
});
