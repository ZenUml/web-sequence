import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '../domain/types';

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

interface SettingsState {
  settings: Settings;
  // Keys the authoritative cloud layer has set this session. Used so a later-arriving
  // local-base merge cannot clobber a cloud value regardless of effect/promise ordering.
  cloudKeys: Set<keyof Settings>;
  // Plain key-wise merge (post-boot live changes — always wins).
  merge(partial: Partial<Settings>): void;
  // Authoritative cloud layer (useAuth's getUserSettings). Applies values AND records
  // which keys cloud owns, so the local-base merge below defers to them.
  mergeCloud(partial: Partial<Settings>): void;
  // Local base layer (boot syncStore loop). Applies ONLY keys cloud has not claimed,
  // so the cloud copy wins even if it resolved FIRST (adversarial review: the boot
  // race had no ordering guarantee — this makes "cloud wins" order-independent).
  mergeLocalBase(partial: Partial<Settings>): void;
}

function applyKeys(base: Settings, partial: Partial<Settings>, skip?: Set<keyof Settings>): Settings {
  const next = { ...base };
  for (const k of SETTINGS_KEYS) {
    if (skip?.has(k)) continue;
    if (partial[k] !== undefined) (next as Record<string, unknown>)[k] = partial[k];
  }
  return next;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  cloudKeys: new Set<keyof Settings>(),
  merge: (partial) => set((s) => ({ settings: applyKeys(s.settings, partial) })),
  mergeCloud: (partial) => set((s) => {
    const cloudKeys = new Set(s.cloudKeys);
    // Record only keys the cloud actually provides (an empty cloud settings doc marks
    // zero keys, so a user with no cloud settings still gets their full local base).
    for (const k of SETTINGS_KEYS) {
      if (partial[k] !== undefined) cloudKeys.add(k);
    }
    return { settings: applyKeys(s.settings, partial), cloudKeys };
  }),
  mergeLocalBase: (partial) => set((s) => ({ settings: applyKeys(s.settings, partial, s.cloudKeys) })),
}));
