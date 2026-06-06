import { localStore } from './storage';
import { LS_KEYS } from '../config/constants';

// The signed-out local items index — mirrors users/{uid}.items ({<id>:true}).
// Maintained by itemService signed-out setItem/saveItems/removeItem; read by
// useItems (signed-out) and import-on-login.
type ItemIndex = Record<string, true>;

export async function list(): Promise<string[]> {
  const map = await localStore.get<ItemIndex>(LS_KEYS.items, {});
  return Object.keys(map);
}

export async function add(id: string): Promise<void> {
  const map = await localStore.get<ItemIndex>(LS_KEYS.items, {});
  if (!map[id]) { map[id] = true; await localStore.set(LS_KEYS.items, map); }
}

export async function remove(id: string): Promise<void> {
  const map = await localStore.get<ItemIndex>(LS_KEYS.items, {});
  if (map[id]) { delete map[id]; await localStore.set(LS_KEYS.items, map); }
}

// Same-tab change signal for the signed-out library list. The browser `storage`
// event only fires CROSS-tab, so it cannot drive a same-tab create/delete/move
// refresh. Move-to-folder also never mutates the index (add() is a no-op for an
// existing id), so the signal must be emitted by the itemService write paths
// directly rather than inferred from the index changing (adversarial review).
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notifyChange(): void {
  for (const fn of listeners) fn();
}
