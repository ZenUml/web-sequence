import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Subscription } from '../domain/types';

// Read-only — written only by the Paddle webhook (admin SDK). Contract §3.3.
// Returns null when absent OR on any read error (legacy subscription.js swallows
// errors to null so a permission/transient failure never blocks the app).
export async function retrieveSubscription(uid: string): Promise<Subscription | null> {
  try {
    const snap = await getDoc(doc(db, `user_subscriptions/user-${uid}`));
    return snap.exists() ? (snap.data() as Subscription) : null;
  } catch {
    return null;
  }
}
