import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.setState({ settings: DEFAULT_SETTINGS, cloudKeys: new Set(), userKeys: new Set() }));
  it('defaults to DEFAULT_SETTINGS', () => {
    expect(useSettingsStore.getState().settings.autoSave).toBe(true);
    expect(useSettingsStore.getState().settings.preserveLastCode).toBe(true);
  });
  it('merge applies known keys over defaults and ignores unknown keys', () => {
    // Merge the OPPOSITE of the default (autoSave now defaults true) so this proves
    // merge overrides the base layer rather than coinciding with it.
    useSettingsStore.getState().merge({ autoSave: false, bogusKey: 1 } as never);
    expect(useSettingsStore.getState().settings.autoSave).toBe(false);
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

  // Discriminating (adversarial review, finding 3): a LIVE user change (merge) must NOT
  // be reverted by a LATER-arriving cloud read (mergeCloud). Real timeline: a signed-in
  // user opens Settings and toggles a control BEFORE useAuth's getUserSettings network
  // round-trip resolves; if mergeCloud then applied the stale cloud value, the user's
  // just-made change would visibly flip back. The user's value must survive. Reverting
  // mergeCloud to apply user-owned keys (dropping the userKeys skip) flips this → fails.
  it('mergeCloud does NOT revert a key the user just changed live (live change wins)', () => {
    useSettingsStore.getState().merge({ editorTheme: 'user-pick' }); // live change first
    useSettingsStore.getState().mergeCloud({ editorTheme: 'stale-cloud', fontSize: 18 });
    // User's live change survives the later cloud read…
    expect(useSettingsStore.getState().settings.editorTheme).toBe('user-pick');
    // …while a key the user did NOT touch still takes the cloud value.
    expect(useSettingsStore.getState().settings.fontSize).toBe(18);
  });
});
