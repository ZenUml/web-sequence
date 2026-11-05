import { test, expect } from '@playwright/test';

const PROJECT = 'staging-zenuml-27954';
const FIRESTORE = `http://127.0.0.1:8180/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = {
  Authorization: 'Bearer owner',
  'Content-Type': 'application/json',
};
const EMPTY_LIBRARY = 'Nothing saved yet.';

function toValue(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: toFields(value) } };
}

function toFields(object) {
  return Object.fromEntries(
    Object.entries(object).map(([k, v]) => [k, toValue(v)]),
  );
}

async function seedDoc(path, data) {
  const response = await fetch(`${FIRESTORE}/${path}`, {
    method: 'PATCH',
    headers: OWNER,
    body: JSON.stringify({ fields: toFields(data) }),
  });
  expect(response.ok, `seed ${path}`).toBe(true);
}

async function readDoc(path) {
  const response = await fetch(`${FIRESTORE}/${path}`, { headers: OWNER });
  expect(response.ok, `read ${path}`).toBe(true);
  return (await response.json()).fields;
}

async function seedLibrary(uid, count, { plus = false } = {}) {
  const index = {};
  for (let i = 1; i <= count; i += 1) {
    const id = `${uid}-item-${i}`;
    index[id] = true;
    await seedDoc(`items/${id}`, {
      id,
      title: `Seeded ${i}`,
      js: `A.m${i}()`,
      css: '',
      html: '',
      createdBy: uid,
      updatedOn: 1000 + i,
    });
  }
  await seedDoc(`users/${uid}`, { items: index });
  if (plus) {
    await seedDoc(`user_subscriptions/user-${uid}`, {
      status: 'active',
      passthrough: JSON.stringify({ userId: uid, planType: 'plus-yearly' }),
    });
  }
}

function dialogRecorder(page) {
  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  return dialogs;
}

async function prepareBrowser(page) {
  await page
    .context()
    .addCookies([
      { name: 'onboarded', value: '1', url: 'http://localhost:3100' },
    ]);
  await page.addInitScript(() => {
    // Skip the first-run onboarding modal, which would cover the app.
    window.localStorage.setItem('lastSeenVersion', JSON.stringify('9999.0.0'));
    // Skip the import prompt for the blank diagram saved locally before sign-in.
    window.localStorage.setItem('askedToImportCreations', 'true');
    window.__sawEmptyLibrary = false;
    setInterval(() => {
      if (
        document.body &&
        document.body.innerText.includes('Nothing saved yet.')
      ) {
        window.__sawEmptyLibrary = true;
      }
    }, 20);
  });
}

async function signIn(page, uid) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__e2eFirebase);
  await page.evaluate(async (userId) => {
    const encode = (value) =>
      btoa(JSON.stringify(value))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const now = Math.floor(Date.now() / 1000);
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      iss: 'firebase-auth-emulator@example.com',
      sub: 'firebase-auth-emulator@example.com',
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid: userId,
    })}.`;
    try {
      await window.__e2eFirebase.auth().signInWithCustomToken(token);
    } catch (error) {
      throw new Error(
        `emulator sign-in failed: ${error.code} ${error.message}`,
      );
    }
  }, uid);
  await page.waitForFunction(() => !!window.user);
}

const library = (page) => page.locator('button[title="My Library"]');
const uniqueUid = (name) => `${name}-${Date.now()}`;

test('Library never claims it is empty while saved diagrams are still loading', async ({
  page,
}) => {
  const uid = uniqueUid('slow-load');
  await seedLibrary(uid, 5, { plus: true });
  dialogRecorder(page);
  await prepareBrowser(page);
  await signIn(page, uid);

  // Hold every Firestore read so the panel opens before users/{uid} arrives.
  await page.route(
    '**/google.firestore.v1.Firestore/Listen/**',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue().catch(() => {});
    },
  );
  await page.reload();
  await expect(library(page)).toBeVisible();
  await library(page).click();

  await expect(page.getByTestId('library-loading')).toBeVisible();
  await expect(page.getByText('Unfiled')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Seeded 5')).toBeVisible();
  await expect(page.getByText(EMPTY_LIBRARY)).toHaveCount(0);
  expect(await page.evaluate(() => window.__sawEmptyLibrary)).toBe(false);
});

test('Library lists every diagram when a save is still pending during load', async ({ page }) => {
  const uid = uniqueUid('pending-write');
  await seedLibrary(uid, 5, { plus: true });
  dialogRecorder(page);
  await prepareBrowser(page);
  await signIn(page, uid);

  // A pending write makes Firestore raise a first query snapshot that holds only
  // that document, and the app must not treat it as the complete list.
  const holdFor = (ms) => async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue().catch(() => {});
  };
  await page.route('**/google.firestore.v1.Firestore/Write/**', holdFor(6000));
  await page.route('**/google.firestore.v1.Firestore/Listen/**', holdFor(3000));
  await page.addInitScript(() => {
    window.__e2eOnAuth = (user) => {
      if (!user || window.__e2eWroteOnAuth) return;
      window.__e2eWroteOnAuth = true;
      window.db.getDb().then((db) =>
        db
          .doc(`items/${user.uid}-item-3`)
          .set({ createdBy: user.uid, updatedOn: Date.now() }, { merge: true }),
      );
    };
  });
  await page.reload();
  await page.waitForFunction(() => window.__e2eWroteOnAuth === true);
  await library(page).click();

  await expect(page.locator('aside').getByText(/^Seeded \d$/)).toHaveCount(5, { timeout: 20000 });
});

test('Save button persists edits, and a free user over the limit can still save an existing diagram', async ({
  page,
}) => {
  const uid = uniqueUid('free-over-limit');
  await seedLibrary(uid, 5);
  const dialogs = dialogRecorder(page);
  await prepareBrowser(page);
  await signIn(page, uid);

  await library(page).click();
  await page.getByText('Seeded 3').click();
  await expect(page.locator('#saveBtn')).toBeVisible();

  // The Library panel replaces the editor panel, so switch back to edit.
  await page.getByRole('button', { name: 'code_blocks' }).click();
  // Opening an item is deferred by 350 ms and replaces the editor content.
  await expect(page.locator('.CodeMirror:visible').first()).toContainText(
    'A.m3()',
  );
  await page.locator('.CodeMirror:visible').first().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\nEditedWithSaveButton.call()');
  await page.locator('#saveBtn').click();

  await expect
    // Edits live in the migrated `pages` array, so inspect the whole document.
    .poll(async () => JSON.stringify(await readDoc(`items/${uid}-item-3`)), {
      timeout: 10000,
    })
    .toContain('EditedWithSaveButton');
  expect(dialogs.filter((message) => message.includes('the limit is'))).toEqual(
    [],
  );
});

test('A new diagram appears in the open Library without reopening it', async ({
  page,
}) => {
  const uid = uniqueUid('new-diagram');
  await seedLibrary(uid, 2, { plus: true });
  dialogRecorder(page);
  await prepareBrowser(page);
  await signIn(page, uid);
  await page.waitForFunction(() => window.user && window.user.subscription);

  await library(page).click();
  await expect(page.getByText('Seeded 2')).toBeVisible();
  const rowsBefore = await page
    .locator('aside')
    .getByText(/^Untitled/)
    .count();

  await page.getByRole('button', { name: 'Start a new creation' }).click();
  await page.getByRole('button', { name: /Start a blank creation/i }).click();

  await expect(page.locator('aside').getByText(/^Untitled/)).toHaveCount(
    rowsBefore + 1,
    { timeout: 10000 },
  );
});

test('Signed-out Save asks the visitor to sign in', async ({ page }) => {
  dialogRecorder(page);
  await prepareBrowser(page);
  await page.goto('/');
  await expect(page.locator('#saveBtn')).toBeVisible();
  await page.locator('#saveBtn').click();
  await expect(page.getByText(/Sign in|Login|Log in/i).first()).toBeVisible();
});
