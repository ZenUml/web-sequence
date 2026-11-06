import { afterEach, describe, expect, it } from 'vitest';
import { captureReturnFocus, transferSlot } from './transferSlot';
import { useExportFeedbackStore } from './exportFeedbackStore';
import { useImportFeedbackStore } from './importFeedbackStore';

const exportStore = useExportFeedbackStore;
const importStore = useImportFeedbackStore;

afterEach(() => {
  exportStore.getState().reset();
  importStore.getState().dismiss();
  document.body.innerHTML = '';
});

// The one arbitration rule for the shared Import/Export feedback slot (#897):
// a new attempt replaces the other panel's finished result, never a busy one.
describe('transferSlot.claim', () => {
  it.each([
    ['import', 'started', 'idle'],
    ['import', 'failed', 'idle'],
    ['import', 'preparing', 'preparing'],
  ] as const)('claim(%s) with export %s leaves export %s', (kind, before, after) => {
    exportStore.setState({ phase: before });
    transferSlot.claim(kind);
    expect(exportStore.getState().phase).toBe(after);
  });

  it.each([
    ['export', 'success', 'idle'],
    ['export', 'invalid', 'idle'],
    ['export', 'reading', 'reading'],
    ['export', 'saving', 'saving'],
  ] as const)('claim(%s) with import %s leaves import %s', (kind, before, after) => {
    importStore.setState({ phase: before });
    transferSlot.claim(kind);
    expect(importStore.getState().phase).toBe(after);
  });

  it('never releases the claimant itself', () => {
    exportStore.setState({ phase: 'started' });
    transferSlot.claim('export');
    expect(exportStore.getState().phase).toBe('started');
  });
});

describe('transferSlot.identityChanged', () => {
  it('clears both finished results', () => {
    exportStore.setState({ phase: 'started' });
    importStore.setState({ phase: 'success' });
    transferSlot.identityChanged();
    expect(exportStore.getState().phase).toBe('idle');
    expect(importStore.getState().phase).toBe('idle');
  });
});

describe('captureReturnFocus', () => {
  it('returns the focused trigger outside the panel', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    expect(captureReturnFocus('[data-export-feedback]', null)).toBe(trigger);
  });

  it('keeps the previous trigger when focus is inside the panel', () => {
    const original = document.createElement('button');
    const panel = document.createElement('div');
    panel.setAttribute('data-export-feedback', '');
    const retry = document.createElement('button');
    panel.append(retry);
    document.body.append(original, panel);
    retry.focus();
    expect(captureReturnFocus('[data-export-feedback]', original)).toBe(original);
  });

  it('returns null when nothing is focused', () => {
    expect(captureReturnFocus('[data-import-feedback]', null)).toBeNull();
  });
});
