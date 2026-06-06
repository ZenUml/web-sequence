import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '../domain/types';

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

interface SettingsState {
  settings: Settings;
  merge(partial: Partial<Settings>): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  merge: (partial) => set((s) => {
    const next = { ...s.settings };
    for (const k of SETTINGS_KEYS) {
      if (partial[k] !== undefined) (next as Record<string, unknown>)[k] = partial[k];
    }
    return { settings: next };
  }),
}));
