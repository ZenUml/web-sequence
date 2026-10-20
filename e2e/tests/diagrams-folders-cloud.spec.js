// Diagrams folders, signed in, against the LOCAL Firebase emulators only (Auth +
// Firestore). No real user data. Every write is checked in the emulator, not just
// on screen. Failures are real permission-denied rejections: the test swaps the
// emulator's security rules for a deny variant and restores the repo rules after.
//
// The file name matches /cloud\.spec\.js/, so the default signed-out chromium suite
// ignores it (playwright.config.js testIgnore); it runs under an emulator config.
//
//   FDR-1  create inline: blank does nothing, Esc cancels, Enter creates; persisted
//   FDR-2  create failure keeps the name; Try again writes exactly one folder
//   FDR-3  rename inline (button + Enter); Esc cancels; persisted
//   FDR-4  delete folder: real name + count; Cancel; confirm keeps the diagram data
//   FDR-5  natural mouse drag onto a folder: highlight, drop moves, Undo restores null
//   FDR-6  drag cancelled with Escape moves nothing
//   FDR-7  keyboard Move to folder: Enter, arrows, Enter; focus returns; persisted
//   FDR-8  move failure keeps the current folder; Try again succeeds
//   FDR-9  390 touch: tap Move to folder; status docks; every action stays reachable
//   FDR-10 empty folder vs no search results, light and dark

import { test, expect } from '@playwright/test';
import { signInViaEmulator, gotoFresh, gotoHome, uidForEmail } from './helpers/cloud';
import { setDoc, getDoc, PROJECT_ID, HOST } from '../cloud/firestoreEmu.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_RULES = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../firestore.rules'), 'utf8');
const RULES_URL = `http://${HOST}/emulator/v1/projects/${PROJECT_ID}:securityRules`;

async function putRules(content) {
  const res = await fetch(RULES_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  });
  if (!res.ok) throw new Error(`rules PUT ${res.status}`);
}
// Deny writes to users/{uid} (folders live there) or items/{id} (folderId lives there).
const DENY_USERS = REPO_RULES.replace(
  /match \/users\/\{userId\} \{[\s\S]*?\n    \}/,
  'match /users/{userId} {\n      allow read: if request.auth.uid == userId;\n      allow write: if false;\n    }',
);
const DENY_ITEM_UPDATE = REPO_RULES.replace(
  'allow read, update, delete: if resource.data.createdBy == request.auth.uid;',
  'allow read, delete: if resource.data.createdBy == request.auth.uid;\n      allow update: if false;',
);

function seedItem(uid, id, extra = {}) {
  return setDoc(`items/${id}`, {
    id,
    title: extra.title ?? 'Seeded',
    js: extra.js ?? 'Browser->Gateway: request\nGateway-->Browser: response',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'sequence',
    createdBy: uid,
    updatedOn: extra.updatedOn ?? Date.now(),
    isShared: false,
    shareToken: '',
    folderId: extra.folderId ?? null,
    pages: [],
    currentPageId: '',
  });
}

const FOLDERS = [
  { id: 'fd-checkout', name: 'Checkout', createdOn: 1, updatedOn: 1 },
  { id: 'fd-auth', name: 'Authentication', createdOn: 2, updatedOn: 2 },
];

// One account per test: users/{uid} with folders + item index, and the item docs.
async function seedAccount(email, { folders = FOLDERS, items = [] } = {}) {
  const uid = uidForEmail(email);
  const index = Object.fromEntries(items.map((i) => [i.id, true]));
  await setDoc(`users/${uid}`, { items: index, folders });
  for (const [n, it] of items.entries()) await seedItem(uid, it.id, { updatedOn: Date.now() - n * 60_000, ...it });
  return uid;
}

async function openHub(page, email, appearance = 'light') {
  await gotoFresh(page);
  await page.evaluate((a) => localStorage.setItem('appearance', JSON.stringify(a)), appearance);
  await signInViaEmulator(page, { email });
  await gotoHome(page);
  await expect(page.locator('[data-testid="home-avatar"]')).toBeVisible({ timeout: 15_000 });
}

async function folderIdOf(itemId) {
  const doc = await getDoc(`items/${itemId}`);
  return doc ? doc.folderId ?? null : undefined;
}
async function folderNames(uid) {
  const doc = await getDoc(`users/${uid}`);
  return (doc?.folders ?? []).map((f) => f.name);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw err; });
  await putRules(REPO_RULES);
});
test.afterEach(async () => {
  await putRules(REPO_RULES);
});

test('FDR-1: create a folder inline (blank does nothing, Esc cancels, Enter creates) and it persists', async ({ page }) => {
  const email = 'fdr1@test.local';
  const uid = await seedAccount(email, { folders: [], items: [{ id: 'fdr1-a', title: 'Checkout flow' }] });
  await openHub(page, email);
  await page.getByTestId('folder-new').click();
  const input = page.getByTestId('folder-new-input');
  await expect(page.getByTestId('folder-edit')).toContainText('Enter to create · Esc to cancel');
  await input.press('Enter');
  await expect(input).toBeVisible();
  await input.fill('Scratch');
  await input.press('Escape');
  await expect(input).toBeHidden();
  await expect(page.getByTestId('folder-new')).toBeFocused();
  await page.getByTestId('folder-new').click();
  await page.getByTestId('folder-new-input').fill('Backend');
  await page.getByTestId('folder-new-input').press('Enter');
  await expect(page.getByTestId('home-sidebar').getByText('Backend', { exact: true })).toBeVisible();
  await expect.poll(() => folderNames(uid)).toEqual(['Backend']);
  await page.reload();
  await expect(page.getByTestId('home-sidebar').getByText('Backend', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: test.info().outputPath('fdr1-created.png') });
});

test('FDR-2: a failed create keeps the typed name; Try again writes exactly one folder', async ({ page }) => {
  const email = 'fdr2@test.local';
  const uid = await seedAccount(email, { folders: [], items: [{ id: 'fdr2-a', title: 'Checkout flow' }] });
  await openHub(page, email);
  await putRules(DENY_USERS);
  await page.getByTestId('folder-new').click();
  await page.getByTestId('folder-new-input').fill('Backend');
  await page.getByTestId('folder-new-input').press('Enter');
  const error = page.getByTestId('folder-edit-error');
  await expect(error).toContainText('Couldn’t create this folder', { timeout: 15_000 });
  await expect(error).toContainText('Your folder name is kept.');
  await expect(page.getByTestId('folder-new-input')).toHaveValue('Backend');
  await page.screenshot({ path: test.info().outputPath('fdr2-create-failed.png') });
  expect(await folderNames(uid)).toEqual([]);
  await putRules(REPO_RULES);
  await page.getByTestId('folder-edit-retry').click();
  await expect(page.getByTestId('folder-new-input')).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => folderNames(uid)).toEqual(['Backend']);
});

test('FDR-3: rename a folder inline; Esc cancels; Enter renames and persists', async ({ page }) => {
  const email = 'fdr3@test.local';
  const uid = await seedAccount(email, { items: [{ id: 'fdr3-a', title: 'Checkout flow', folderId: 'fd-checkout' }] });
  await openHub(page, email);
  await page.getByTestId('folder-fd-auth').click();
  await page.getByRole('button', { name: 'Rename folder Authentication' }).click();
  const input = page.getByTestId('folder-rename-fd-auth');
  await expect(input).toHaveValue('Authentication');
  await input.fill('Identity');
  await input.press('Escape');
  await expect(page.getByTestId('folder-fd-auth')).toContainText('Authentication');
  await page.getByTestId('folder-fd-auth').focus();
  await page.keyboard.press('F2');
  await page.getByTestId('folder-rename-fd-auth').fill('Identity');
  await page.getByTestId('folder-rename-fd-auth').press('Enter');
  await expect(page.getByTestId('folder-fd-auth')).toContainText('Identity');
  await expect.poll(() => folderNames(uid)).toEqual(['Checkout', 'Identity']);
});

test('FDR-4: delete a folder — real name and count, Cancel, then the diagram is kept under Not in a folder', async ({ page }) => {
  const email = 'fdr4@test.local';
  const uid = await seedAccount(email, {
    items: [
      { id: 'fdr4-a', title: 'Checkout flow', folderId: 'fd-checkout' },
      { id: 'fdr4-b', title: 'Payment retry', folderId: 'fd-checkout' },
      { id: 'fdr4-c', title: 'Sign-in flow', folderId: 'fd-auth' },
    ],
  });
  await openHub(page, email);
  await page.getByTestId('folder-fd-checkout').click();
  const trigger = page.getByRole('button', { name: 'Delete folder Checkout' });
  await trigger.click();
  const dialog = page.getByTestId('folder-delete-dialog');
  await expect(dialog.getByRole('heading', { name: 'Delete “Checkout”?' })).toBeVisible();
  await expect(dialog).toContainText('The folder contains 2 diagrams.');
  await expect(dialog).toContainText('Your diagrams will be kept and moved to Not in a folder.');
  await expect(page.getByTestId('folder-delete-cancel')).toBeFocused();
  await page.screenshot({ path: test.info().outputPath('fdr4-delete-dialog.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await folderNames(uid)).toEqual(['Checkout', 'Authentication']);

  await trigger.click();
  await page.getByTestId('folder-delete-confirm').click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => folderNames(uid)).toEqual(['Authentication']);
  // Diagram data is kept; the orphaned folderId shows under Not in a folder.
  expect((await getDoc('items/fdr4-a'))?.title).toBe('Checkout flow');
  expect((await getDoc('items/fdr4-b'))?.title).toBe('Payment retry');
  await expect(page.getByTestId('folder-unfiled')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('folder-unfiled')).toContainText('2');
  await expect(page.getByTestId('home-card-fdr4-a')).toBeVisible();
  await expect(page.getByTestId('home-card-fdr4-b')).toBeVisible();
});

// Natural pointer drag: press on the card, move in steps, release over the folder.
async function startDrag(page, cardId, targetTestId) {
  const card = page.getByTestId(`home-card-${cardId}`);
  const from = await card.locator('.dh-card-title').boundingBox();
  const to = await page.getByTestId(targetTestId).boundingBox();
  await page.mouse.move(from.x + 20, from.y + 8);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 });
}

test('FDR-5: natural drag onto a folder highlights it, drop moves at once, Undo restores Not in a folder', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = 'fdr5@test.local';
  await seedAccount(email, {
    items: [
      { id: 'fdr5-a', title: 'Checkout flow' },
      { id: 'fdr5-b', title: 'Payment retry', folderId: 'fd-checkout' },
    ],
  });
  await openHub(page, email);
  await expect(page.getByTestId('folder-fd-auth')).toContainText('0');
  await startDrag(page, 'fdr5-a', 'folder-fd-auth');
  const target = page.getByTestId('folder-fd-auth');
  await expect(target).toHaveClass(/is-drop-target/);
  await expect(target).toContainText('+1');
  await expect(page.getByTestId('folder-drag-hint')).toHaveText('Drop to move · Esc to cancel');
  await page.screenshot({ path: test.info().outputPath('fdr5-dragging.png') });
  await page.mouse.up();
  await expect.poll(() => folderIdOf('fdr5-a')).toBe('fd-auth');
  const status = page.getByTestId('move-status');
  await expect(status).toContainText('Diagram moved');
  await expect(status).toContainText('Checkout flow → Authentication');
  await expect(status).toContainText('Diagram content is unchanged.');
  await expect(target).toContainText('1');
  await expect(page.getByRole('button', { name: /Move here/ })).toHaveCount(0);
  // The drag did not open the diagram.
  await expect(page.getByTestId('home-view')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('fdr5-moved.png') });
  await page.getByTestId('move-undo').click();
  await expect.poll(() => folderIdOf('fdr5-a')).toBe(null);
  await expect(status).toContainText('Move undone');
  await expect(page.getByTestId('folder-fd-auth')).toContainText('0');
  const doc = await getDoc('items/fdr5-a');
  expect(doc.js).toContain('Browser->Gateway');
});

test('FDR-6: Escape cancels a drag and nothing moves', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = 'fdr6@test.local';
  await seedAccount(email, { items: [{ id: 'fdr6-a', title: 'Checkout flow' }] });
  await openHub(page, email);
  await startDrag(page, 'fdr6-a', 'folder-fd-auth');
  await expect(page.getByTestId('folder-fd-auth')).toHaveClass(/is-drop-target/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('folder-fd-auth')).not.toHaveClass(/is-drop-target/);
  await expect(page.getByTestId('move-status')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(await folderIdOf('fdr6-a')).toBe(null);
  await expect(page.getByTestId('home-view')).toBeVisible();
});

test('FDR-7: keyboard Move to folder completes at once and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = 'fdr7@test.local';
  await seedAccount(email, { items: [{ id: 'fdr7-a', title: 'Checkout flow', folderId: 'fd-checkout' }] });
  await openHub(page, email);
  const trigger = page.getByRole('button', { name: 'Move Checkout flow to folder' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByTestId('home-move-menu-fdr7-a');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Checkout/ })).toHaveAttribute('data-disabled', '');
  await page.screenshot({ path: test.info().outputPath('fdr7-menu.png') });
  // Opening from the keyboard focuses the first choice; the current folder is skipped.
  await expect(menu.getByRole('menuitem', { name: 'Not in a folder' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Authentication' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => folderIdOf('fdr7-a')).toBe('fd-auth');
  await page.getByTestId('move-undo').click();
  await expect.poll(() => folderIdOf('fdr7-a')).toBe('fd-checkout');
});

test('FDR-8: a failed move keeps the current folder; Try again succeeds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = 'fdr8@test.local';
  await seedAccount(email, { items: [{ id: 'fdr8-a', title: 'Checkout flow' }] });
  await openHub(page, email);
  await putRules(DENY_ITEM_UPDATE);
  await page.getByRole('button', { name: 'Move Checkout flow to folder' }).click();
  await page.getByTestId('home-move-to-fd-auth').click();
  const status = page.getByTestId('move-status');
  await expect(status).toContainText('Couldn’t move this diagram', { timeout: 15_000 });
  await expect(status).toHaveAttribute('role', 'alert');
  expect(await folderIdOf('fdr8-a')).toBe(null);
  // Firestore's local write is rolled back: the diagram is shown where it was.
  await expect(page.getByTestId('folder-unfiled')).toContainText('1');
  await expect(page.getByTestId('folder-fd-auth')).toContainText('0');
  await page.screenshot({ path: test.info().outputPath('fdr8-move-failed.png') });
  await putRules(REPO_RULES);
  await page.getByTestId('move-retry').click();
  await expect.poll(() => folderIdOf('fdr8-a')).toBe('fd-auth');
  await expect(status).toContainText('Diagram moved');
});

test.describe('390 touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const appearance of ['light', 'dark']) {
    test(`FDR-9: tap Move to folder; status docks; every card action stays reachable (${appearance})`, async ({ page }) => {
      const email = `fdr9-${appearance}@test.local`;
      const items = Array.from({ length: 6 }, (_, i) => ({ id: `fdr9-${appearance}-${i}`, title: `Diagram ${i + 1}` }));
      await seedAccount(email, { items });
      await openHub(page, email, appearance);
      await page.getByRole('button', { name: 'Move Diagram 1 to folder' }).tap();
      await page.getByTestId(`home-move-to-fd-checkout`).tap();
      await expect.poll(() => folderIdOf(`fdr9-${appearance}-0`)).toBe('fd-checkout');
      const status = page.getByTestId('move-status');
      await expect(status).toContainText('Diagram moved');
      await page.screenshot({ path: test.info().outputPath(`fdr9-${appearance}-moved.png`) });
      // With the status docked, every action can still be reached by scrolling.
      const unreachable = await page.evaluate(async () => {
        let scroller = document.querySelector('[data-testid="home-grid"]');
        while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
        const reached = new Set();
        const maxY = scroller.scrollHeight - scroller.clientHeight;
        for (let y = 0; y <= maxY + 40; y += 40) {
          scroller.scrollTop = Math.min(y, maxY);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          for (const btn of document.querySelectorAll('[data-testid^="home-action-"]')) {
            const r = btn.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (hit && btn.contains(hit)) reached.add(btn.dataset.testid);
          }
        }
        return [...document.querySelectorAll('[data-testid^="home-action-"]')].map((b) => b.dataset.testid).filter((t) => !reached.has(t));
      });
      expect(unreachable).toEqual([]);
      await page.getByTestId('move-undo').tap();
      await expect.poll(() => folderIdOf(`fdr9-${appearance}-0`)).toBe(null);
      await page.getByTestId('move-status-dismiss').tap();
      await expect(status).toHaveCount(0);
    });
  }
});

test.describe('390 touch folders', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('FDR-11: tap a folder, then rename and delete it from the strip', async ({ page }) => {
    const email = 'fdr11@test.local';
    const uid = await seedAccount(email, { items: [{ id: 'fdr11-a', title: 'Sign-in flow', folderId: 'fd-auth' }] });
    await openHub(page, email);
    await page.getByTestId('folder-fd-auth').tap();
    const rename = page.getByRole('button', { name: 'Rename folder Authentication' });
    await expect(rename).toBeInViewport();
    await rename.tap();
    await page.getByTestId('folder-rename-fd-auth').fill('Identity');
    await expect(page.getByTestId('folder-edit')).toContainText('Enter to rename · Esc to cancel');
    await page.screenshot({ path: test.info().outputPath('fdr11-rename.png') });
    await page.getByTestId('folder-rename-fd-auth').press('Enter');
    await expect.poll(() => folderNames(uid)).toEqual(['Checkout', 'Identity']);
    await expect(page.getByTestId('folder-rename-fd-auth')).toBeHidden();
    await expect(page.getByTestId('folder-fd-auth')).toContainText('Identity');
    await page.getByTestId('folder-fd-auth').tap();
    const del = page.getByRole('button', { name: 'Delete folder Identity' });
    await expect(del).toBeInViewport();
    await del.tap();
    await expect(page.getByTestId('folder-delete-dialog')).toContainText('The folder contains 1 diagram.');
    await page.getByTestId('folder-delete-confirm').tap();
    await expect.poll(() => folderNames(uid)).toEqual(['Checkout']);
    expect((await getDoc('items/fdr11-a'))?.title).toBe('Sign-in flow');
    await expect(page.getByTestId('home-card-fdr11-a')).toBeVisible();
  });
});

for (const appearance of ['light', 'dark']) {
  test(`FDR-10: empty folder and no search results are distinct (${appearance})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const email = `fdr10-${appearance}@test.local`;
    await seedAccount(email, { items: [{ id: `fdr10-${appearance}-a`, title: 'Checkout flow', folderId: 'fd-checkout' }] });
    await openHub(page, email, appearance);
    await page.getByTestId('folder-fd-auth').click();
    const empty = page.getByTestId('home-folder-empty');
    await expect(empty).toContainText('No diagrams in this folder');
    await expect(empty).toContainText('Drag a diagram here');
    await page.screenshot({ path: test.info().outputPath(`fdr10-${appearance}-empty-folder.png`) });
    await page.getByTestId('folder-all').click();
    await page.getByTestId('home-search').fill('no-such-diagram');
    const none = page.getByTestId('home-no-results');
    await expect(none).toContainText('No matches');
    await expect(none).toContainText('No diagrams match “no-such-diagram”.');
    await expect(page.getByTestId('home-search')).toHaveValue('no-such-diagram');
    await expect(empty).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`fdr10-${appearance}-no-results.png`) });
    await none.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByTestId('home-search')).toHaveValue('');
    await expect(page.getByTestId(`home-card-fdr10-${appearance}-a`)).toBeVisible();
  });
}
