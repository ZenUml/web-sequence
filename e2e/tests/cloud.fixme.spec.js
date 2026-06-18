// Infra-gated E2E gap cases — AUTH / CLOUD / PADDLE buckets from
// e2e/E2E_GAP_TEST_PLAN.md, captured as a runnable-but-PENDING scaffold.
//
// WHY EVERY CASE IS test.fixme():
//   These cases need infrastructure that is NOT available in this checkout:
//     - the Firebase Emulator Suite (auth + firestore + functions), and
//     - a Paddle sandbox / a mocked `usePaddle` openCheckout.
//   The signed-out staging gate cannot reach them (it runs anonymously against a
//   live deploy). Rather than delete or fake-pass them, each is written as a real
//   body sketch wrapped in `test.fixme(title, fn)`. Playwright reports a fixme
//   test as PENDING (skipped) — it is NEVER executed, so the body cannot fail the
//   suite, and it cannot fake-pass either. The moment the emulator project exists
//   (see e2e/EMULATOR_SETUP.md), flip `test.fixme` → `test` per case and the body
//   is already written against the real selectors.
//
// SELECTORS ARE REAL: every data-testid referenced below was read out of the
// live components (web/src/components/**), so the sketches are accurate, not
// guesses. The bodies are best-effort and may need small timing/seed tweaks once
// the emulator is wired — that is exactly what un-fixme-ing each case will surface.
//
// NAMING: each fixme title starts with its gap-plan ID and a one-line
//   "needs: <emulator|paddle> — <what to do>" note, so `--list` reads as a
//   checklist of what infra unlocks what.
//
// HELPERS reused from the signed-out specs (openEditor/gotoHome/typeDsl pattern):
//   the emulator project keeps the same page-driving shape; only auth/seed change.

import { test, expect } from '@playwright/test';
import { suppressOneTimeModals } from './helpers/onetime';
import { openEditor, gotoHome } from './helpers/hub';

const selectAll = process.platform === 'darwin' ? 'Meta+a' : 'Control+a';

// ── shared sketch helpers (intentionally NOT exported; these run only once the
//    emulator project is live, so they live beside the cases that use them) ─────

/** Editor CM6 content surface. */
function editorLocator(page) {
  return page.locator('[data-testid="dsl-editor"] .cm-content');
}

/**
 * Sign in via the emulator. PLACEHOLDER until the emulator project exists:
 * with the Auth emulator wired (see EMULATOR_SETUP.md §3), real flows are either
 *   (a) seed a custom token into the page and call signInWithCustomToken, or
 *   (b) drive the emulator's popup provider stub.
 * Sketch (a) — the deterministic one — is shown; it needs `firebase/auth` exposed
 * on window in dev OR an addInitScript that signs in before AppRoot boots.
 */
async function signInViaEmulator(
  page,
  { uid = 'e2e-user', email = 'e2e@test.local' } = {},
) {
  // needs: Auth emulator + a test custom token (EMULATOR_SETUP.md §3/§4)
  await page.evaluate(
    async ({ uid, email }) => {
      // window.__e2eSignIn is the dev-only test hook described in EMULATOR_SETUP.md §4.
      // It wraps signInWithCustomToken(auth, <minted token for uid>).
      await window.__e2eSignIn?.({ uid, email });
    },
    { uid, email },
  );
  // ProfileMenu's trigger only mounts once onAuthStateChanged fires signed-in.
  await expect(page.locator('[data-testid="profile-trigger"]')).toBeVisible({
    timeout: 15_000,
  });
}

/** Boot the editor with a clean slate + one-time modals suppressed. */
async function gotoFresh(page) {
  await suppressOneTimeModals(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await openEditor(page);
}

/** Type a replacement DSL into the editor (select-all → Delete → type). */
async function typeDsl(page, dsl) {
  const editor = editorLocator(page);
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.press(selectAll);
  await page.keyboard.press('Delete');
  await editor.pressSequentially(dsl);
}

// ════════════════════════════════════════════════════════════════════════════
// §9 Authentication  (AUTH-1..6)  — Firebase Auth emulator
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'AUTH-1 — needs: emulator (auth) — login modal lists Google/GitHub/Facebook/Twitter',
  async ({ page }) => {
    await gotoFresh(page);
    // Header "Sign in" opens LoginModal. (header-login → AppHeader.tsx:379)
    await page.locator('[data-testid="header-login"]').click();
    // LoginModal renders one button per provider, testid login-<id>
    // (web/src/components/auth/LoginModal.tsx:87 → `login-${id}`).
    for (const id of ['google', 'github', 'facebook', 'twitter']) {
      await expect(page.locator(`[data-testid="login-${id}"]`)).toBeVisible();
    }
  },
);

test.fixme(
  'AUTH-2 — needs: emulator (auth) — Google sign-in → profile menu shows name/photo/plan',
  async ({ page }) => {
    await gotoFresh(page);
    await signInViaEmulator(page, { uid: 'auth2', email: 'auth2@test.local' });
    // ProfileMenu trigger present; opening it reveals the plan row (profile-plan).
    await page.locator('[data-testid="profile-trigger"]').click();
    await expect(page.locator('[data-testid="profile-plan"]')).toBeVisible();
    // Free account → "Free" / Starter copy in the plan row.
    await expect(page.locator('[data-testid="profile-plan"]')).toContainText(
      /free|starter/i,
    );
  },
);

test.fixme(
  'AUTH-3 — needs: emulator (auth) — last-used provider re-surfaces as primary with a "Last used" chip',
  async ({ page }) => {
    await gotoFresh(page);
    // Sign in with GitHub, then sign out. LoginModal persists lastProvider.
    await page.locator('[data-testid="header-login"]').click();
    await page.locator('[data-testid="login-github"]').click(); // emulator GitHub stub completes
    await page.locator('[data-testid="profile-trigger"]').click();
    await page.locator('[data-testid="profile-logout"]').click();
    // Reopen → GitHub elevated (cobalt primary) + login-github-lastused chip
    // (LoginModal.tsx:105 → `login-${id}-lastused`).
    await page.locator('[data-testid="header-login"]').click();
    await expect(
      page.locator('[data-testid="login-github-lastused"]'),
    ).toBeVisible();
  },
);

test.fixme(
  'AUTH-4 — needs: emulator (auth) — auth error surfaces in the modal alert',
  async ({ page }) => {
    await gotoFresh(page);
    await page.locator('[data-testid="header-login"]').click();
    // Force the provider to reject (emulator: configure the provider to fail, or
    // stub signInWithPopup to throw). LoginModal renders the message in login-error
    // (LoginModal.tsx:128).
    await page.evaluate(() => {
      window.__e2eForceAuthError?.('auth/popup-closed-by-user');
    });
    await page.locator('[data-testid="login-google"]').click();
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  },
);

test.fixme(
  'AUTH-5 — needs: emulator (auth) — login modal auto-dismisses once auth resolves (P5 regression)',
  async ({ page }) => {
    await gotoFresh(page);
    await page.locator('[data-testid="header-login"]').click();
    await expect(page.locator('[data-testid="login-google"]')).toBeVisible();
    await signInViaEmulator(page); // resolves onAuthStateChanged
    // Modal closes automatically — the provider buttons unmount.
    await expect(page.locator('[data-testid="login-google"]')).toBeHidden();
  },
);

test.fixme(
  'AUTH-6 — needs: emulator (auth) — sign-out clears session, hides profile menu, restores "Sign in"',
  async ({ page }) => {
    await gotoFresh(page);
    await signInViaEmulator(page);
    await page.locator('[data-testid="profile-trigger"]').click();
    await page.locator('[data-testid="profile-logout"]').click();
    // Signed-out chrome: profile gone, header-login back.
    await expect(page.locator('[data-testid="profile-trigger"]')).toBeHidden();
    await expect(page.locator('[data-testid="header-login"]')).toBeVisible();
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §10 Import-on-login  (IOL-1..3)  — Auth (+ Firestore for the upload assertion)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'IOL-1 — needs: emulator (auth) — first sign-in with local diagrams offers AskToImportModal',
  async ({ page }) => {
    await gotoFresh(page);
    // Seed a local item first (save signed-out → localItems index).
    await typeDsl(page, 'A\nB\nA->B: local');
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await page
      .locator('[data-testid="confirm-cancel"]')
      .click()
      .catch(() => {}); // first-save notice
    // Sign in → useImportOnLogin detects locals → AskToImportModal
    // (import-confirm / import-dismiss → AskToImportModal.tsx:28/41).
    await signInViaEmulator(page);
    await expect(page.locator('[data-testid="import-confirm"]')).toBeVisible();
  },
);

test.fixme(
  'IOL-2 — needs: emulator (auth+firestore) — accepting import uploads locals to the cloud account',
  async ({ page }) => {
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: local');
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await page
      .locator('[data-testid="confirm-cancel"]')
      .click()
      .catch(() => {});
    await signInViaEmulator(page);
    await page.locator('[data-testid="import-confirm"]').click();
    // After a fresh reload signed-in, the item is read from the cloud account.
    await gotoHome(page);
    await expect(page.locator('[data-testid^="home-card-"]')).toHaveCount(1);
    // STRONGER assertion (needs Firestore admin probe): query the emulator's
    // users/{uid}/items and assert the doc exists. See EMULATOR_SETUP.md §5.
  },
);

test.fixme(
  'IOL-3 — needs: emulator (auth+firestore) — declining keeps locals untouched, no cloud write',
  async ({ page }) => {
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: local');
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await page
      .locator('[data-testid="confirm-cancel"]')
      .click()
      .catch(() => {});
    await signInViaEmulator(page);
    await page.locator('[data-testid="import-dismiss"]').click();
    // Firestore admin probe: assert users/{uid}/items is empty (no upload).
    // EMULATOR_SETUP.md §5 shows the admin-SDK read against the emulator.
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §5 Folders  (FLD-1..5)  — Auth + Firestore (folders live on users/{uid}.folders)
// ════════════════════════════════════════════════════════════════════════════
// Folders are cloud-backed (useFolders.ts / folderService.ts write users/{uid}),
// so they need the Firestore emulator + a signed-in session.

test.fixme(
  'FLD-1 — needs: emulator (auth+firestore) — create folder "Work" appears with count 0',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoHome(page);
    // folder-new → folder-new-input (testids confirmed in the folder UI).
    await page.locator('[data-testid="folder-new"]').click();
    await page.locator('[data-testid="folder-new-input"]').fill('Work');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Work', { exact: true })).toBeVisible();
    // Count chip reads 0 on a fresh folder.
  },
);

test.fixme(
  'FLD-2 — needs: emulator (auth+firestore) — move a diagram into a folder; counts update; Unfiled decrements',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoHome(page);
    // Seed item + folder, then move via the card kebab → "Move to". Assert the
    // Work count increments to 1 and folder-unfiled decrements.
    // (Exact move-menu testid TBD when the emulator project lands — folder-${id}.)
  },
);

test.fixme(
  'FLD-3 — needs: emulator (auth+firestore) — rename folder commits the new label',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoHome(page);
    // Open the folder row menu → Rename → type → Enter; assert new label visible.
  },
);

test.fixme(
  'FLD-4 — needs: emulator (auth+firestore) — delete folder returns its items to Unfiled',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoHome(page);
    // Delete a folder holding 1 item; assert folder-unfiled count increments and
    // the item still appears under Unfiled.
  },
);

test.fixme(
  'FLD-5 — needs: emulator (auth+firestore) — "All" vs "Unfiled" filters the grid',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoHome(page);
    // folder-all shows every card; folder-unfiled shows only unfoldered cards.
    await page.locator('[data-testid="folder-all"]').click();
    const allCount = await page.locator('[data-testid^="home-card-"]').count();
    await page.locator('[data-testid="folder-unfiled"]').click();
    const unfiledCount = await page
      .locator('[data-testid^="home-card-"]')
      .count();
    expect(unfiledCount).toBeLessThanOrEqual(allCount);
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §11 Sharing  (SHR-1..8)  — SHR-1 is AUTH-only; SHR-2..8 need Firestore+functions
// ════════════════════════════════════════════════════════════════════════════
// create-share / get-shared-item are cloud functions (firebase.json rewrites);
// they read the cloud item doc and need a fresh ID token → emulator functions.

test.fixme(
  'SHR-1 — needs: emulator (auth) — Share while signed-out opens the sign-in modal first',
  async ({ page }) => {
    await gotoFresh(page);
    // ShareButton is signed-out-gated: clicking it should route to LoginModal.
    await page.locator('[data-testid="share-button"]').click();
    await expect(page.locator('[data-testid="login-google"]')).toBeVisible();
  },
);

test.fixme(
  'SHR-2 — needs: emulator (auth+firestore+functions) — create share link → popover shows ?id=&share-token= URL',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: share me');
    // Save so the item exists in the cloud (create-share reads the cloud doc).
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    // Open share popover → Create link (share-create → SharePopover.tsx:82),
    // then assert the URL field carries both params (share-url → :36).
    await page.locator('[data-testid="share-button"]').click();
    await page.locator('[data-testid="share-create"]').click();
    const url = page.locator('[data-testid="share-url"]');
    await expect(url).toBeVisible();
    await expect(url).toHaveValue(/[?&]id=.+&share-token=.+/);
  },
);

test.fixme(
  'SHR-3 — needs: emulator (auth+firestore+functions) — Copy copies the URL and shows "Copied ✓"',
  async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInViaEmulator(page);
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: copy');
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await page.locator('[data-testid="share-button"]').click();
    await page.locator('[data-testid="share-create"]').click();
    await page.locator('[data-testid="share-copy"]').click(); // SharePopover.tsx:45
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/[?&]id=.+&share-token=.+/);
  },
);

test.fixme(
  'SHR-4 — needs: emulator (auth+firestore+functions) — Stop-sharing revokes the token',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: revoke');
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await page.locator('[data-testid="share-button"]').click();
    await page.locator('[data-testid="share-create"]').click();
    const url = await page.locator('[data-testid="share-url"]').inputValue();
    await page.locator('[data-testid="share-stop"]').click(); // SharePopover.tsx:56
    // Re-visiting the now-revoked URL should NOT render the diagram (token gone).
    await page.goto(url);
    await expect(
      page.locator('[data-testid="share-error-text"]'),
    ).toBeVisible();
  },
);

test.fixme(
  'SHR-5 — needs: emulator (firestore+functions) — opening a share URL renders read-only + "Open in ZenUML"',
  async ({ page }) => {
    // Pre-seed a shared item in Firestore (admin SDK, EMULATOR_SETUP.md §5) and
    // build ${origin}/?id=<id>&share-token=<tok>. useBootItem calls getSharedItem
    // (cloudFunctions.ts:51) → item with isReadOnly:true.
    const id = 'seeded-shared-id';
    const token = 'seeded-token';
    await page.goto(`/?id=${id}&share-token=${token}`);
    await expect(editorLocator(page)).toBeVisible();
    // Read-only chrome: header-savestate is in the "readonly" state (AppHeader.tsx:488).
    await expect(
      page.locator('[data-testid="header-savestate"]'),
    ).toHaveAttribute('data-state', 'readonly');
  },
);

test.fixme(
  'SHR-6 — needs: emulator (firestore+functions) — Fork a shared item → owned editable copy (clears readonly/shareToken)',
  async ({ page }) => {
    await signInViaEmulator(page);
    const id = 'seeded-shared-id';
    const token = 'seeded-token';
    await page.goto(`/?id=${id}&share-token=${token}`);
    // Fork lives in the header file-menu (filemenu-duplicate → AppHeader.tsx:293).
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="filemenu-duplicate"]').click();
    // After fork: savestate leaves readonly (becomes dirty/saved, owned copy).
    await expect(
      page.locator('[data-testid="header-savestate"]'),
    ).not.toHaveAttribute('data-state', 'readonly');
  },
);

test.fixme(
  'SHR-7 — needs: emulator (firestore+functions) — bad share link → ShareErrorNotice with "Start fresh"',
  async ({ page }) => {
    // getSharedItem rejects for an unknown token → useBootItem yields share-error.
    await page.goto('/?id=does-not-exist&share-token=bad');
    await expect(page.locator('[data-testid="share-error"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="share-error-fresh"]'),
    ).toBeVisible(); // "Start fresh"
  },
);

test.fixme(
  'SHR-8 — needs: emulator (firestore+functions) — Share button disabled for read-only items',
  async ({ page }) => {
    await signInViaEmulator(page);
    await page.goto('/?id=seeded-shared-id&share-token=seeded-token');
    await expect(editorLocator(page)).toBeVisible();
    // ShareButton renders disabled for read-only items (ShareButton.tsx:60 branch).
    await expect(page.locator('[data-testid="share-button"]')).toBeDisabled();
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §13 Subscription / pricing  (SUB-2/3/4/5)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'SUB-2 — needs: paddle (mock usePaddle.openCheckout) — Upgrade (signed-in) opens Paddle checkout for the chosen plan',
  async ({ page }) => {
    // Install a window.Paddle stub BEFORE app boot so usePaddle.ensurePaddle()
    // picks it up (usePaddle.ts:61 — "Paddle already present" path skips the CDN).
    // EMULATOR_SETUP.md §6 shows the addInitScript stub that records Checkout.open.
    await page.addInitScript(() => {
      window.__paddleCalls = [];
      window.Paddle = {
        Setup() {},
        Checkout: { open: (opts) => window.__paddleCalls.push(opts) },
      };
    });
    await signInViaEmulator(page);
    await gotoFresh(page);
    await page.locator('[data-testid="header-pricing"]').click(); // open PricingModal
    await page.locator('[data-testid="pricing-period-monthly"]').click();
    // Click an Upgrade CTA on the Plus tier (profile-upgrade / pricing tier button).
    await page.locator('[data-testid="profile-upgrade"]').first().click();
    // usePaddle passes JSON.stringify({ userId, planType }) as passthrough.
    const calls = await page.evaluate(() => window.__paddleCalls);
    expect(calls.length).toBe(1);
    expect(JSON.parse(calls[0].passthrough)).toMatchObject({
      planType: 'plus-monthly',
    });
  },
);

test.fixme(
  'SUB-3 — needs: emulator (auth) + paddle (mock) — anonymous Upgrade → sign-in → resumes checkout for captured plan',
  async ({ page }) => {
    await page.addInitScript(() => {
      window.__paddleCalls = [];
      window.Paddle = {
        Setup() {},
        Checkout: { open: (o) => window.__paddleCalls.push(o) },
      };
    });
    await gotoFresh(page);
    await page.locator('[data-testid="header-pricing"]').click();
    // Anonymous Upgrade should stash the plan and open LoginModal first.
    await page
      .locator('[data-testid="profile-upgrade"]')
      .first()
      .click()
      .catch(() => {});
    await expect(page.locator('[data-testid="login-google"]')).toBeVisible();
    await signInViaEmulator(page);
    // After auth resolves, checkout resumes for the captured plan (legacy product 5751479).
    const calls = await page.evaluate(() => window.__paddleCalls);
    expect(calls.length).toBe(1);
  },
);

test.fixme(
  'SUB-4 — needs: emulator (auth+firestore) — free user over 3 diagrams → limit notice + "Free Limit" event; local kept, cloud write withheld',
  async ({ page }) => {
    await signInViaEmulator(page, { uid: 'free-cap-user' });
    await gotoFresh(page);
    // Seed 3 saved diagrams (the free cap), then attempt a 4th save.
    // LimitReachedNotice mounts (limit-notice → LimitReachedNotice.tsx:25) with a
    // limit-upgrade CTA (:41). Firestore admin probe: assert the 4th doc was NOT
    // written (cloud write withheld) while the local copy is kept.
    // ... seed loop omitted in the sketch; see EMULATOR_SETUP.md §5 for the probe.
    await expect(page.locator('[data-testid="limit-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="limit-upgrade"]')).toBeVisible();
  },
);

test.fixme(
  'SUB-5 — needs: emulator (auth) — "Manage subscription" link present for paid users (Paddle cancel URL)',
  async ({ page }) => {
    // Seed a paid (plus) user doc in Firestore so resolved plan === plus, then open
    // the profile menu and assert the manage-subscription link is present.
    await signInViaEmulator(page, { uid: 'plus-user' });
    await page.locator('[data-testid="profile-trigger"]').click();
    await expect(page.locator('[data-testid="profile-plan"]')).toContainText(
      /plus/i,
    );
    // Manage-subscription link (Paddle cancel URL) — exact testid TBD when wired.
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §8 Persistence / autosave  (PST-2/3/4)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'PST-2 — needs: emulator (auth) — save indicator transitions Unsaved → Saving… → Saved (signed-in)',
  async ({ page }) => {
    await signInViaEmulator(page);
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: dirty');
    // header-savestate cycles data-state dirty → saving → saved (AppHeader.tsx:449/457/471).
    await expect(
      page.locator('[data-testid="header-savestate"]'),
    ).toHaveAttribute('data-state', 'dirty');
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await expect(
      page.locator('[data-testid="header-savestate"]'),
    ).toHaveAttribute('data-state', 'saved');
  },
);

test.fixme(
  'PST-3 — needs: emulator (firestore+functions) — read-only (shared) item: Save disabled, Fork offered',
  async ({ page }) => {
    await page.goto('/?id=seeded-shared-id&share-token=seeded-token');
    await expect(editorLocator(page)).toBeVisible();
    // Read-only: savestate is "readonly", Save is unavailable, Fork (filemenu-duplicate) offered.
    await expect(
      page.locator('[data-testid="header-savestate"]'),
    ).toHaveAttribute('data-state', 'readonly');
    await page.locator('[data-testid="header-menu"]').click();
    await expect(page.locator('[data-testid="header-save"]')).toBeDisabled();
    await expect(
      page.locator('[data-testid="filemenu-duplicate"]'),
    ).toBeVisible();
  },
);

test.fixme(
  'PST-4 — needs: emulator (firestore+functions) — read-only item is NOT written to the last-code slot',
  async ({ page }) => {
    await page.goto('/?id=seeded-shared-id&share-token=seeded-token');
    await expect(editorLocator(page)).toBeVisible();
    const sharedFirstLine = (await editorLocator(page).innerText()).split(
      '\n',
    )[0];
    // Reload bare '/' — editor-as-landing resumes last-code; the shared item must
    // NOT be it (read-only items skip the last-code write).
    await page.goto('/');
    await expect(editorLocator(page)).toBeVisible();
    await expect(editorLocator(page)).not.toContainText(sharedFirstLine);
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §14 Header / title / actions  (HDR-4/6)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'HDR-4 — needs: emulator (firestore+functions) — Fork duplicates current item into an owned copy',
  async ({ page }) => {
    await signInViaEmulator(page);
    await page.goto('/?id=seeded-shared-id&share-token=seeded-token');
    await expect(editorLocator(page)).toBeVisible();
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="filemenu-duplicate"]').click();
    // New owned, editable copy: savestate no longer readonly.
    await expect(
      page.locator('[data-testid="header-savestate"]'),
    ).not.toHaveAttribute('data-state', 'readonly');
  },
);

test.fixme(
  'HDR-6 — needs: emulator (auth) — signed-out header shows "Sign in"; signed-in shows profile menu',
  async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator('[data-testid="header-login"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-trigger"]')).toBeHidden();
    await signInViaEmulator(page);
    await expect(page.locator('[data-testid="profile-trigger"]')).toBeVisible();
    await expect(page.locator('[data-testid="header-login"]')).toBeHidden();
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §16 Embed (by-reference)  (EMB-1)  — Firestore + functions
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'EMB-1 — needs: emulator (firestore+functions) — embed by-reference ?embed&id=&share-token= renders the shared diagram',
  async ({ page }) => {
    // Seed a shared item (admin SDK), then visit the embed-by-reference URL.
    // AppRoot's embed path calls getSharedItem and renders the embed-root surface.
    const id = 'seeded-shared-id';
    const token = 'seeded-token';
    await page.goto(`/?embed&id=${id}&share-token=${token}`);
    await expect(page.locator('[data-testid="embed-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="embed-open-link"]')).toBeVisible();
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §20 Connectivity  (NET-2)  — Auth + Firestore (offline → reconnect sync)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'NET-2 — needs: emulator (auth+firestore) — reconnect resumes cloud sync without data loss',
  async ({ page, context }) => {
    await signInViaEmulator(page);
    await gotoFresh(page);
    await typeDsl(page, 'A\nB\nA->B: offline edit');
    // Go offline, edit + save locally, then reconnect; assert the edit syncs to the
    // cloud (Firestore admin probe confirms the doc reflects the offline edit).
    await context.setOffline(true);
    await page.locator('[data-testid="header-menu"]').click();
    await page.locator('[data-testid="header-save"]').click();
    await context.setOffline(false);
    // After reconnect, Firestore persistence flushes the queued write. Probe the
    // emulator doc (EMULATOR_SETUP.md §5) to assert no data loss.
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §7 Settings  (SET-7)  — Auth + Firestore (settings persist to cloud)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'SET-7 — needs: emulator (auth+firestore) — signed-in settings persist to cloud and survive a fresh session',
  async ({ page }) => {
    await signInViaEmulator(page, { uid: 'settings-user' });
    await gotoFresh(page);
    // Open settings, change a value (e.g. theme via theme-select), close.
    await page.locator('[data-testid="header-settings"]').click();
    await page
      .locator('[data-testid="theme-select"]')
      .selectOption({ index: 1 });
    // Sign out, clear localStorage, sign back in (fresh session — no local cache):
    // the cloud-synced setting should be restored from Firestore.
    await page.evaluate(() => localStorage.clear());
    await signInViaEmulator(page, { uid: 'settings-user' });
    await page.locator('[data-testid="header-settings"]').click();
    // Assert the previously-chosen theme is still selected (read from cloud).
  },
);

// ════════════════════════════════════════════════════════════════════════════
// §1 CSS gate  (CSS-5)  — Auth (non-plain CSS mode gated behind Plus)
// ════════════════════════════════════════════════════════════════════════════

test.fixme(
  'CSS-5 — needs: emulator (auth) — non-plain CSS mode gated behind Plus for free users (→ pricing)',
  async ({ page }) => {
    // Free signed-in user. Expand the CSS pane, switch the mode select to SCSS.
    await signInViaEmulator(page, { uid: 'free-css-user' });
    await gotoFresh(page);
    await page.locator('[data-testid="css-panel-strip"]').click(); // expand CSS pane
    await page.locator('[data-testid="css-mode-select"]').selectOption('scss');
    // Gate fires for free users → pricing / upgrade prompt surfaces.
    await expect(page.locator('[data-testid="pricing-modal"]')).toBeVisible();
  },
);
