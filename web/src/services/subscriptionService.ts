import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Subscription } from '../domain/types';

// Read-only — written only by the Paddle webhook (admin SDK). Contract §3.3.
// An absent document is a confirmed free account. Let read failures reject so
// callers can distinguish an unknown plan from that confirmed result.
export async function retrieveSubscription(uid: string): Promise<Subscription | null> {
  const snap = await getDoc(doc(db, `user_subscriptions/user-${uid}`));
  return snap.exists() ? (snap.data() as Subscription) : null;
}
