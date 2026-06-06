import type { Item } from '../domain/types';

// Hosting-rewritten endpoints are same-origin paths (dev: Vite proxy → emulator;
// prod: Firebase Hosting rewrites). See contract spec §5.

// GET /get-shared-item?id=&share-token= → Item (isReadOnly:true). Public read.
export async function getSharedItem(id: string, shareToken: string): Promise<Item> {
  const res = await fetch(`/get-shared-item?id=${encodeURIComponent(id)}&share-token=${encodeURIComponent(shareToken)}`);
  if (!res.ok) {
    let msg = 'Failed to load shared item';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as Item;
}
