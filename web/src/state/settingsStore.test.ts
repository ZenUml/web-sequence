import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.setState({ settings: DEFAULT_SETTINGS }));
  it('defaults to DEFAULT_SETTINGS', () => {
    expect(useSettingsStore.getState().settings.autoSave).toBe(false);
    expect(useSettingsStore.getState().settings.preserveLastCode).toBe(true);
  });
  it('merge applies known keys over defaults and ignores unknown keys', () => {
    useSettingsStore.getState().merge({ autoSave: true, bogusKey: 1 } as never);
    expect(useSettingsStore.getState().settings.autoSave).toBe(true);
    expect((useSettingsStore.getState().settings as unknown as Record<string, unknown>).bogusKey).toBeUndefined();
  });
});
