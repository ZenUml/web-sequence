import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './AppRoot';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

// useAuth → services/firebase (initializeApp, onAuthStateChanged…) must be stubbed
// to avoid live Firebase initialisation in jsdom. Same pattern as useAuth.test.tsx.
// onAuthChange fires the callback immediately with null so authReady becomes true
// (FIX 1: boot is gated on authReady; without this, AppRoot returns null and all tests fail).
vi.mock('../services/firebase', () => ({
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  onAuthChange: vi.fn((cb: (u: unknown) => void) => { cb(null); return () => {}; }),
  auth: {},
  db: {},
}));

// userService and cloudFunctions hit Firestore — stub them out for AppRoot tests.
vi.mock('../services/cloudFunctions', () => ({
  getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
  createShare: vi.fn(async () => ({ url: 'http://x?id=1&v=abc', md5: 'abc' })),
}));

// itemService.setItem / getItem / saveLastCode — prevent real Firestore calls.
// M03 adds moveToFolder/stopSharing/removeItem/subscribeAllItems — stub them too so
// AppRoot's useShare + library handlers can be constructed without hitting Firestore.
vi.mock('../services/itemService', () => ({
  makeItemService: () => ({
    setItem: vi.fn(async () => {}),
    getItem: vi.fn(async () => { throw new Error('not found'); }),
    saveLastCode: vi.fn(),
    saveItems: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
    moveToFolder: vi.fn(async () => {}),
    stopSharing: vi.fn(async () => {}),
    subscribeAllItems: vi.fn(() => () => {}),
  }),
}));

// userService — M02 mock lacks unsetItemForUser (M03 delete handler uses it).
vi.mock('../services/userService', () => ({
  ensureUser: vi.fn(async () => ({})),
  getUserSettings: vi.fn(async () => ({})),
  setItemForUser: vi.fn(async () => {}),
  unsetItemForUser: vi.fn(async () => {}),
}));

beforeEach(() => {
  useAuthStore.setState({ user: null, online: true, authReady: false });
  useEditorStore.getState().reset();
});

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

  it('renders the ShareButton in the header (M03 wiring)', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('share button is disabled when signed out (createShare needs a signed-in user)', async () => {
    // Boot lands on a fresh `new` item; the firebase mock signs the user out.
    // Either the `!user` clause OR the membership clause keeps Share disabled — this
    // asserts the signed-out gate (the membership clause is covered in isolation by
    // the share-disabled unit logic; see useShare/ShareButton specs).
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    expect(screen.getByTestId('share-button')).toBeDisabled();
  });

  it('renders the LibraryPanel (not the old stub) when the library panel is active', async () => {
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    useUiStore.getState().setActivePanel('library');
    expect(await screen.findByTestId('library-panel')).toBeInTheDocument();
  });
});
