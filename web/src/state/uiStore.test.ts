import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState({ activePanel: 'editor', consoleOpen: false, fullscreen: false }));
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
});
