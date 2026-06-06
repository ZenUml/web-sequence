import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './AppRoot';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

// useAuth → services/firebase (initializeApp, onAuthStateChanged…) must be stubbed
// to avoid live Firebase initialisation in jsdom. Same pattern as useAuth.test.tsx.
vi.mock('../services/firebase', () => ({
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  onAuthChange: vi.fn(() => () => {}),
  auth: {},
  db: {},
}));

// userService and cloudFunctions hit Firestore — stub them out for AppRoot tests.
vi.mock('../services/userService', () => ({
  ensureUser: vi.fn(async () => ({})),
  getUserSettings: vi.fn(async () => ({})),
  setItemForUser: vi.fn(async () => {}),
}));

vi.mock('../services/cloudFunctions', () => ({
  getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
}));

// itemService.setItem / getItem / saveLastCode — prevent real Firestore calls
vi.mock('../services/itemService', () => ({
  makeItemService: () => ({
    setItem: vi.fn(async () => {}),
    getItem: vi.fn(async () => { throw new Error('not found'); }),
    saveLastCode: vi.fn(),
  }),
}));

describe('AppRoot', () => {
  it('renders editor and preview regions', async () => {
    render(<AppRoot />);
    // Boot is async — wait for the item to load and the tree to appear
    expect(await screen.findByTestId('editor-region')).toBeInTheDocument();
    expect(screen.getByTestId('preview-region')).toBeInTheDocument();
  });

  it('seeds the DSL editor and mounts the preview iframe', async () => {
    const { container } = render(<AppRoot />);
    expect(await screen.findByTestId('editor-region')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="dsl-editor"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="preview-iframe"]')).toBeTruthy();
  });

  it('renders js and css mode selects', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    expect(container.querySelector('[data-testid="js-mode-select"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="css-mode-select"]')).toBeTruthy();
  });

  it('renders the snippet toolbox', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    expect(container.querySelector('[data-testid="snippet-participant"]')).toBeTruthy();
  });

  it('renders the console panel', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    expect(container.querySelector('[data-testid="console"]')).toBeTruthy();
  });

  it('fullscreen button toggles the fullscreen ui state', async () => {
    const { getByTestId } = render(<AppRoot />);
    await screen.findByTestId('preview-fullscreen');
    const { useUiStore } = await import('../state/uiStore');
    await userEvent.click(getByTestId('preview-fullscreen'));
    expect(useUiStore.getState().fullscreen).toBe(true);
  });

  it('renders the AppHeader with title input', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    expect(screen.getByTestId('header-save')).toBeInTheDocument();
    expect(screen.getByTestId('header-new')).toBeInTheDocument();
  });
});
