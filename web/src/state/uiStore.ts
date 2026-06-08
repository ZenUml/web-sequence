import { create } from 'zustand';

export type LeftPanel = 'editor' | 'library';

export type ModalName =
  | 'settings'
  | 'pricing'
  | 'help'
  | 'shortcuts'
  | 'cheatsheet'
  | 'createNew'
  | 'onboarding'
  | 'pledge'
  | 'acss';

interface UiState {
  activePanel: LeftPanel;
  consoleOpen: boolean;
  fullscreen: boolean;
  // Single-modal state: only one modal is open at a time. Opening a second
  // replaces the first; closeModal() clears it.
  activeModal: ModalName | null;
  // The LoginModal is rendered by AppHeader but lives in shared state so other
  // surfaces (e.g. the anonymous custom-CSS gate) can request sign-in. Kept
  // separate from `activeModal` because login can overlay any modal flow.
  loginModalOpen: boolean;
  setActivePanel(p: LeftPanel): void;
  toggleConsole(): void;
  toggleFullscreen(): void;
  openModal(name: ModalName): void;
  closeModal(): void;
  setLoginModalOpen(open: boolean): void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'editor',
  consoleOpen: false,
  fullscreen: false,
  activeModal: null,
  loginModalOpen: false,
  setActivePanel: (activePanel) => set({ activePanel }),
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),
  setLoginModalOpen: (loginModalOpen) => set({ loginModalOpen }),
}));
