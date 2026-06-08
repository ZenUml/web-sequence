import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider,
  TwitterAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { config } from '../config/firebaseConfig';
import type { AppUser } from '../domain/types';
import type { ProviderName } from './types';

const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const providers: Record<ProviderName, () => any> = {
  google: () => { const p = new GoogleAuthProvider(); p.addScope('https://www.googleapis.com/auth/userinfo.profile'); return p; },
  github: () => new GithubAuthProvider(),
  facebook: () => new FacebookAuthProvider(),
  twitter: () => new TwitterAuthProvider(),
};

export async function login(provider: ProviderName): Promise<void> {
  await signInWithPopup(auth, providers[provider]());
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
