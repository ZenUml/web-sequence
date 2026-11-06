import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider,
  TwitterAuthProvider, signInWithPopup, signInWithCustomToken, signOut,
  onAuthStateChanged, connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { config } from '../config/firebaseConfig';
import type { AppUser } from '../domain/types';
import type { ProviderName } from './types';

const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// ── E2E emulator wiring (opt-in, dev/test only) ──────────────────────────────
// Gated on the Vite build-time flag VITE_USE_EMULATOR. When unset (every
// production/staging build) NONE of this runs: import.meta.env.VITE_USE_EMULATOR
// is statically `undefined`, so the branch is dead-code-eliminated and the app
// talks to the real Firebase project. When the Playwright `cloud` project boots
// the dev server with VITE_USE_EMULATOR=1, the SDK is repointed at the local
// Auth/Firestore emulators and a deterministic, popup-free sign-in seam is exposed.
//
// Functions are NOT connected here: cloudFunctions.ts uses same-origin relative
// fetch ('/create-share' …) and web/vite.config.ts already proxies those paths to
// the functions emulator at 127.0.0.1:5002/<projectId>/us-central1. So with the
// functions emulator up, the relative fetches resolve to it with no client change.
const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

// Default to the production OAuth-popup login. Under the emulator we replace this
// with a deterministic REST sign-in so the provider buttons (login-google …) sign
// in a real emulator user without opening a popup Playwright can't drive.
let loginImpl = async (provider: ProviderName): Promise<void> => {
  await signInWithPopup(auth, providers[provider]());
};

if (useEmulator) {
  // 127.0.0.1 (not 'localhost') to match the host Playwright/the dev server use and
  // avoid an IPv6 (::1) vs IPv4 split that intermittently fails the connect.
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  const PROJECT_ID = config.firebase.projectId;

  // Deterministic uid for an email/uid so seeded Firestore docs (users/{uid},
  // items.createdBy) line up with the signed-in session. When the caller supplies an
  // explicit uid we use it verbatim; otherwise we derive a stable slug from the email.
  function uidFor(email: string, explicit?: string): string {
    if (explicit) return explicit;
    return 'e2e-' + email.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  // Sign a deterministic user into the SDK via signInWithCustomToken. The Auth
  // emulator does NOT verify the custom-token signature, so an unsigned token (alg
  // "none", empty signature) minted for the uid is accepted — no firebase-admin and
  // no service-account key needed in the browser. onAuthStateChanged then fires a
  // real signed-in user, identical to a production OAuth result for the app's purposes.
  async function emulatorSignIn(email: string, explicitUid?: string): Promise<void> {
    const uid = uidFor(email, explicitUid);
    const customToken = makeEmulatorCustomToken(uid, PROJECT_ID, email);
    await signInWithCustomToken(auth, customToken);
  }

  // Replace popup login with the deterministic emulator sign-in. The provider name
  // is mapped to a stable per-provider email so AUTH-3 (last-used GitHub) and the
  // generic AUTH flows each get a distinct, repeatable account.
  loginImpl = async (provider: ProviderName): Promise<void> => {
    const forced = (window as unknown as { __e2eAuthErrorCode?: string }).__e2eAuthErrorCode;
    if (forced) {
      (window as unknown as { __e2eAuthErrorCode?: string }).__e2eAuthErrorCode = undefined;
      const err = new Error('forced auth error') as Error & { code: string };
      err.code = forced;
      throw err;
    }
    await emulatorSignIn(`${provider}@e2e.test.local`);
  };

  // ── Dev-only test hooks (never present in prod bundles — the whole block is
  //    gated by VITE_USE_EMULATOR) ─────────────────────────────────────────────
  const w = window as unknown as {
    __e2eSignIn?: (o: { uid?: string; email?: string }) => Promise<void>;
    __e2eForceAuthError?: (code: string) => void;
    __e2eAuthErrorCode?: string;
  };
  // Sign in deterministically by email/uid (the spec's signInViaEmulator seam).
  w.__e2eSignIn = async ({ uid, email = 'e2e@test.local' } = {}) => {
    await emulatorSignIn(email, uid);
  };
  // Arm a one-shot forced error so the NEXT provider-button click rejects with `code`,
  // which useAuth surfaces into the LoginModal's login-error notice (AUTH-4).
  w.__e2eForceAuthError = (code: string) => { w.__e2eAuthErrorCode = code; };
}

// Build an unsigned (emulator-only) Firebase custom token for `uid`. A Firebase
// custom token is a JWT consumed by identitytoolkit's verifyCustomToken; the Auth
// emulator does NOT verify the signature, so a fixed empty signature is accepted.
// This avoids pulling firebase-admin (and a service-account key) into the browser
// bundle. `email` rides in as an additional claim so the resulting user profile
// carries it (the app reads displayName/email/photoURL off the auth user).
function makeEmulatorCustomToken(uid: string, projectId: string, email?: string): string {
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'none', typ: 'JWT' };
  const claims: Record<string, unknown> = {
    iss: `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`,
    sub: `firebase-adminsdk@${projectId}.iam.gserviceaccount.com`,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat,
    exp: iat + 3600,
    uid,
  };
  if (email) claims.claims = { email };
  return `${b64url(header)}.${b64url(claims)}.`;
}

const providers: Record<ProviderName, () => any> = {
  google: () => { const p = new GoogleAuthProvider(); p.addScope('https://www.googleapis.com/auth/userinfo.profile'); return p; },
  github: () => new GithubAuthProvider(),
  facebook: () => new FacebookAuthProvider(),
  twitter: () => new TwitterAuthProvider(),
};

export async function login(provider: ProviderName): Promise<void> {
  await loginImpl(provider);
}
export async function logout(): Promise<void> { await signOut(auth); }
export async function getIdToken(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not authenticated');
  return u.getIdToken(true);
}
export function onAuthChange(cb: (user: AppUser | null) => void): () => void {
  return onAuthStateChanged(auth, (u) => {
    cb(u ? { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, email: u.email } : null);
  });
}
