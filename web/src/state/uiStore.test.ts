import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState({ activePanel: 'editor', consoleOpen: false, fullscreen: false, activeModal: null }));
  it('toggles the active left panel', () => {
    useUiStore.getState().setActivePanel('library');
    expect(useUiStore.getState().activePanel).toBe('library');
  });
  it('toggles console and fullscreen', () => {
    useUiStore.getState().toggleConsole();
    expect(useUiStore.getState().consoleOpen).toBe(true);
    useUiStore.getState().toggleFullscreen();
    expect(useUiStore.getState().fullscreen).toBe(true);
  });
  it('openModal sets the active modal', () => {
    useUiStore.getState().openModal('settings');
    expect(useUiStore.getState().activeModal).toBe('settings');
  });
  it('closeModal clears the active modal', () => {
    useUiStore.getState().openModal('settings');
    useUiStore.getState().closeModal();
    expect(useUiStore.getState().activeModal).toBeNull();
  });
  it('opening a second modal replaces the first (only one at a time)', () => {
    useUiStore.getState().openModal('settings');
    useUiStore.getState().openModal('pricing');
    expect(useUiStore.getState().activeModal).toBe('pricing');
  });
});
