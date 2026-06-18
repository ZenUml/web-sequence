// Connectivity — NET-1: going offline is reflected in the page runtime, and a
// local edit made while offline SURVIVES (the editor retains the text and the
// last-code 'code' slot is written, so a reload restores it).
//
// "Assert an offline indicator if one exists": this app renders NO visible
// offline indicator. Grepping every consumer of the online state
// (web/src/hooks/useOnlineStatus.ts → authStore.online) shows the flag is
// consumed ONLY by itemService's sync decision (web/src/services/itemService.ts)
// — it is never rendered to a banner/badge/aria-live, and there is no
// data-testid="*offline*"/"*online*" anywhere in web/src. So the OBSERVABLE the
// hook wires up is navigator.onLine itself: useOnlineStatus listens for the
// window 'offline' event and mirrors navigator.onLine into the store. We assert
// against that runtime signal (the proxy the product actually keys on) plus the
// real user-visible contract — the edit survives offline.
//
// context.setOffline(true) flips navigator.onLine to false AND dispatches the
// window 'offline' event that useOnlineStatus handles, exactly the path the app
// reacts to in production.
//
// Editor-as-landing (2026-06-13): bare '/' boots the EDITOR directly; we land on
// the CM6 surface via the inlined gotoFresh (clean localStorage slate → boot
// seeds a fresh sample, openEditor lands on '/').

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// Deployed sites (staging/prod via PW_BASE_URL) load third-party analytics/CDN
// scripts that throw their own uncaught errors we don't own; treat those as noise
// so genuine app errors still fail the test (copied from smoke.spec.js).
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

/** The CM6 editor content surface. */
function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

/**
 * Navigate to the EDITOR with a clean localStorage slate (mirrors
 * persistence.spec.js gotoFresh). Land on the origin first to clear storage, then
 * click through openEditor — avoids addInitScript-based clearing that would re-run
 * on reload and wipe the 'code' slot the reload is meant to read back.
 */
async function gotoFresh(page) {
  await suppressOneTimeModals(page); // M04: keep onboarding/pledge from trapping focus
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

/** Type a replacement DSL into the CM6 editor (select-all → Delete → type). */
async function typeDsl(page, dsl, { timeout = 15_000 } = {}) {
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

/**
 * Flush the last-code 'code' slot. AppRoot writes localStorage['code'] on
 * `visibilitychange` (document.hidden → true) and on `beforeunload`; dispatch
 * visibilitychange explicitly, then poll until the slot carries `token` — proving
 * the slot a bare-'/' reload reads back is populated (mirrors persistence.spec.js).
 */
async function flushCodeSlot(page, token) {
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
    token,
    { timeout: 5_000 },
  );
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    if (isThirdPartyError(err)) return;
    throw err;
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// NET-1 (core, runs everywhere): going offline is reflected in the page runtime,
// and a local edit made WHILE OFFLINE survives — editor keeps the text and the
// last-code 'code' slot is written.
//
// page.evaluate(navigator.onLine) and the localStorage read are plain runtime
// reads that work against any base URL, so this test is NOT skipped on the staging
// gate. (Only the back-online RELOAD round-trip below needs the local clean-slate
// guarantee and is guarded.)
// ──────────────────────────────────────────────────────────────────────────────
test('NET-1: offline is reflected in the page runtime and a local edit made offline survives', async ({
  page,
  context,
}) => {
  await gotoFresh(page);

  // Baseline: the page reports itself online before we cut the connection.
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);

  // Cut the connection. setOffline flips navigator.onLine AND fires the window
  // 'offline' event that useOnlineStatus handles (→ authStore.setOnline(false)).
  await context.setOffline(true);

  // The offline status is reflected in the page runtime — this is the signal the
  // product keys on (useOnlineStatus mirrors navigator.onLine into authStore.online;
  // there is no rendered offline indicator to assert against). Poll because the
  // 'offline' event propagates to the page on a microtask after setOffline resolves.
  await expect
    .poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 })
    .toBe(false);

  // Edit the DSL while OFFLINE — distinctive token proves restore, not the starter.
  const TOKEN = 'OfflineEditProbe';
  const DSL = `${TOKEN}\nPeer\nPeer->${TOKEN}: madeWhileOffline`;
  await typeDsl(page, DSL);

  // The edit is retained in the editor even though we are offline (local-first:
  // the editor never depends on the network to accept input).
  await expect(editorLocator(page)).toContainText(TOKEN);

  // And it survives to the persistence layer: the last-code 'code' slot is written
  // on visibilitychange while still offline (offline does NOT block local writes —
  // itemService.ts comment CQ-5: Firestore's cache queues, the local slot is always
  // written). flushCodeSlot asserts (via waitForFunction) the slot carries the token.
  await flushCodeSlot(page, TOKEN);

  // Restore connectivity for a clean teardown; the page reports online again.
  await context.setOffline(false);
  await expect
    .poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 })
    .toBe(true);
});

// ──────────────────────────────────────────────────────────────────────────────
// NET-1 (round-trip, local-only): an edit made while OFFLINE persists across a
// reload made AFTER coming back online — proving the offline write reached the
// 'code' slot the bare-'/' boot reads back.
//
// Guarded with PW_BASE_URL skip: this relies on the clean localStorage slate from
// gotoFresh and the deterministic 'code'-slot boot branch (preserveLastCode). On a
// remote staging/prod target that slate isn't guaranteed and the reload-reads-slot
// timing competes with third-party scripts, so self-skip on the staging gate (the
// core test above already proves offline is reflected + the edit survives).
// ──────────────────────────────────────────────────────────────────────────────
test('NET-1: an offline edit survives a reload after coming back online', async ({
  page,
  context,
}) => {
  test.skip(
    !!process.env.PW_BASE_URL,
    'reload-reads-code-slot round-trip needs the local clean-slate guarantee',
  );

  await gotoFresh(page);

  // Go offline, then edit.
  await context.setOffline(true);
  await expect
    .poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 })
    .toBe(false);

  const TOKEN = 'OfflineSurvivesReload';
  const DSL = `${TOKEN}\nMate\nMate->${TOKEN}: persistAcrossReload`;
  await typeDsl(page, DSL);
  await expect(editorLocator(page)).toContainText(TOKEN);

  // Flush the last-code slot WHILE STILL OFFLINE — the write must not depend on
  // the network being up.
  await flushCodeSlot(page, TOKEN);

  // Come back online, then reload bare '/': boot takes the preserveLastCode branch
  // and reads localStorage['code'], restoring our offline-made edit.
  await context.setOffline(false);
  await expect
    .poll(() => page.evaluate(() => navigator.onLine), { timeout: 5_000 })
    .toBe(true);

  await page.reload();

  await expect(editorLocator(page)).toBeVisible({ timeout: 15_000 });
  await expect(editorLocator(page)).toContainText(TOKEN, { timeout: 15_000 });
});
