import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.setState({ settings: DEFAULT_SETTINGS, cloudKeys: new Set() }));
  it('defaults to DEFAULT_SETTINGS', () => {
    expect(useSettingsStore.getState().settings.autoSave).toBe(false);
    expect(useSettingsStore.getState().settings.preserveLastCode).toBe(true);
  });
  it('merge applies known keys over defaults and ignores unknown keys', () => {
    useSettingsStore.getState().merge({ autoSave: true, bogusKey: 1 } as never);
    expect(useSettingsStore.getState().settings.autoSave).toBe(true);
    expect((useSettingsStore.getState().settings as unknown as Record<string, unknown>).bogusKey).toBeUndefined();
  });

  // Discriminating (adversarial review #1): cloud must win over the local-base layer
  // REGARDLESS of arrival order. The boot race (AppRoot syncStore loop vs useAuth's
  // getUserSettings) had no ordering guarantee; if cloud resolved FIRST, the old plain
  // `merge` local loop would clobber it key-by-key. Here cloud arrives FIRST, then the
  // local base — the cloud-owned key must survive while non-cloud keys still load from
  // local. Reverting mergeLocalBase to a plain key-wise merge flips theme to 'light' → fails.
  it('mergeLocalBase does NOT clobber a key the cloud layer already set (cloud wins, order-independent)', () => {
    useSettingsStore.getState().mergeCloud({ editorTheme: 'dark-cloud' });
    useSettingsStore.getState().mergeLocalBase({ editorTheme: 'light-local', fontSize: 14 });
    // Cloud-owned key survives; a key cloud did NOT claim still loads from local base.
    expect(useSettingsStore.getState().settings.editorTheme).toBe('dark-cloud');
    expect(useSettingsStore.getState().settings.fontSize).toBe(14);
  });

  // An EMPTY cloud settings doc must claim zero keys, so a user with no cloud settings
  // still gets their full local base (mergeCloud must not over-claim).
  it('mergeCloud({}) claims no keys → local base fully applies', () => {
    useSettingsStore.getState().mergeCloud({});
    useSettingsStore.getState().mergeLocalBase({ editorTheme: 'light-local' });
    expect(useSettingsStore.getState().settings.editorTheme).toBe('light-local');
  });
});
