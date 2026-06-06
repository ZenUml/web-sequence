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
