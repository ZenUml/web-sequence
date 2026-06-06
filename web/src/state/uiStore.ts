import { create } from 'zustand';

export type LeftPanel = 'editor' | 'library';

interface UiState {
  activePanel: LeftPanel;
  consoleOpen: boolean;
  fullscreen: boolean;
  setActivePanel(p: LeftPanel): void;
  toggleConsole(): void;
  toggleFullscreen(): void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'editor',
  consoleOpen: false,
  fullscreen: false,
  setActivePanel: (activePanel) => set({ activePanel }),
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
}));
