import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';
import { useSettingsStore } from '../state/settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';
import { LS_KEYS, APP_VERSION } from '../config/constants';

// ─── CodeEditor capture mock ──────────────────────────────────────────────────
// Mirrors AppRoot.editorWiring.test.tsx: CodeEditor is mocked to record the props
// each instance receives (DSL/CSS distinguished by `language`) and its mounts.
const captured: Record<string, Record<string, unknown>> = {};
const mounts: Record<string, number> = {};
vi.mock('../editor/CodeEditor', async () => {
  const { useEffect } = await import('react');
  return {
    CodeEditor: (props: Record<string, unknown>) => {
      captured[String(props.language)] = props;
      const lang = String(props.language);
      // Counts mounts: a theme/font change must reconfigure, never remount.
      useEffect(() => { mounts[lang] = (mounts[lang] ?? 0) + 1; }, [lang]);
      return <div data-testid={String(props.testId)} />;
    },
  };
});

// ─── Boot harness (mirrors AppRoot.test.tsx) ──────────────────────────────────
vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

// Router harness (hub PRs #800/#801) — same partial mock as AppRoot.test.tsx:
// AppRoot reads the URL via useSearch/useNavigate, which crash without a
// RouterProvider. useSearch parses window.location.search in the shape of
// router.tsx's indexRoute validateSearch; useNavigate is exercised nowhere here
// but must exist. See AppRoot.test.tsx for the full rationale.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useSearch: () => {
      const p = new URLSearchParams(window.location.search);
      return {
        id: p.get('id') ?? undefined,
        'share-token': p.get('share-token') ?? undefined,
        embed: p.has('embed') ? true : undefined,
        code: p.get('code') ?? undefined,
        title: p.get('title') ?? undefined,
        stickyOffset: p.has('stickyOffset') ? Number(p.get('stickyOffset')) : undefined,
      };
    },
    useNavigate: () => () => Promise.resolve(),
  };
});

vi.mock('../services/firebase', () => ({
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  onAuthChange: vi.fn((cb: (u: unknown) => void) => { cb(null); return () => {}; }),
  auth: {},
  db: {},
}));

vi.mock('../services/cloudFunctions', () => ({
  getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
  createShare: vi.fn(async () => ({ url: 'http://x?id=1&v=abc', md5: 'abc' })),
  trackEvent: vi.fn(async () => {}),
}));

const itemSvc = vi.hoisted(() => ({
  setItem: vi.fn(async () => {}),
  getItem: vi.fn(async () => { throw new Error('not found'); }),
  saveLastCode: vi.fn(),
  saveItems: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
  moveToFolder: vi.fn(async () => {}),
  stopSharing: vi.fn(async () => {}),
  subscribeAllItems: vi.fn(() => () => {}),
}));
vi.mock('../services/itemService', () => ({ makeItemService: () => itemSvc }));

const userSvc = vi.hoisted(() => ({
  ensureUser: vi.fn(async () => ({})),
  getUserSettings: vi.fn(async () => ({})),
  setItemForUser: vi.fn(async () => {}),
  unsetItemForUser: vi.fn(async () => {}),
  getUserItemIds: vi.fn(async () => [] as string[]),
  setUserSetting: vi.fn(async () => {}),
}));
vi.mock('../services/userService', () => userSvc);

vi.mock('../services/folderService', () => ({
  getFolders: vi.fn(async () => []),
  createFolder: vi.fn(async () => ({})),
  renameFolder: vi.fn(async () => ({})),
  deleteFolder: vi.fn(async () => {}),
}));

const subSvc = vi.hoisted(() => ({ retrieveSubscription: vi.fn(async () => null) }));
vi.mock('../services/subscriptionService', () => subSvc);

const paddle = vi.hoisted(() => ({ openCheckout: vi.fn() }));
vi.mock('../hooks/usePaddle', () => ({ usePaddle: () => paddle }));

// Import AFTER the mocks so AppRoot picks up the mocked CodeEditor.
import { AppRoot } from './AppRoot';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  // The hub owns '/', so use an inline editor payload. It reaches the editor without
  // pretending that a missing owned item should fall back to a blank document.
  window.history.replaceState({}, '', '/?code=A%3AB');
  for (const k of Object.keys(captured)) delete captured[k];
  for (const k of Object.keys(mounts)) delete mounts[k];
  useAuthStore.setState({ user: null, online: true, authReady: false });
  useEditorStore.getState().reset();
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  window.localStorage.clear();
  window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION));
});

async function bootWithCssOpen() {
  render(<AppRoot />);
  await screen.findByTestId('dsl-editor');
  fireEvent.click(await screen.findByTestId('css-panel-strip'));
  await waitFor(() => expect(captured.dsl).toBeDefined());
  await waitFor(() => expect(captured.css).toBeDefined());
}

const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null');

describe('AppRoot — inline code appearance bar', () => {
  it('renders one bar inside the code area, reflecting stored settings', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, editorTheme: 'monokai', fontSize: 13 } });
    await bootWithCssOpen();
    expect(screen.getAllByTestId('code-appearance-bar')).toHaveLength(1);
    expect(screen.getByTestId('code-theme-select')).toHaveTextContent('Monokai');
    expect(screen.getByTestId('code-font-size-value')).toHaveTextContent('13');
  });

  it('+/- updates BOTH editors immediately and persists via the settings path, without remounting', async () => {
    await bootWithCssOpen();
    const before = { ...mounts };
    const initialSize = DEFAULT_SETTINGS.fontSize;
    expect(captured.dsl.fontSize).toBe(initialSize);

    fireEvent.click(screen.getByTestId('code-font-increase'));
    await waitFor(() => expect(captured.dsl.fontSize).toBe(initialSize + 1));
    expect(captured.css.fontSize).toBe(initialSize + 1);
    expect(useSettingsStore.getState().settings.fontSize).toBe(initialSize + 1);
    await waitFor(() => expect(stored('fontSize')).toBe(initialSize + 1));

    fireEvent.click(screen.getByTestId('code-font-decrease'));
    fireEvent.click(screen.getByTestId('code-font-decrease'));
    await waitFor(() => expect(captured.css.fontSize).toBe(initialSize - 1));
    expect(captured.dsl.fontSize).toBe(initialSize - 1);
    await waitFor(() => expect(stored('fontSize')).toBe(initialSize - 1));

    expect(mounts).toEqual(before);
  });

  it('explicit theme persists, survives a global appearance toggle, and Follow app restores ink', async () => {
    const user = userEvent.setup();
    await bootWithCssOpen();
    const before = { ...mounts };
    expect(captured.dsl.themeId).toBe('ink');

    await user.click(screen.getByTestId('code-theme-select'));
    await user.click(await screen.findByTestId('code-theme-option-dracula'));
    await waitFor(() => expect(captured.dsl.themeId).toBe('dracula'));
    expect(captured.css.themeId).toBe('dracula');
    await waitFor(() => expect(stored('editorTheme')).toBe('dracula'));

    // Global appearance change leaves the explicit code theme alone.
    fireEvent.click(screen.getByTestId('header-appearance'));
    await waitFor(() => expect(useSettingsStore.getState().settings.appearance).toBe('dark'));
    expect(captured.dsl.themeId).toBe('dracula');
    expect(captured.css.themeId).toBe('dracula');
    expect(stored('editorTheme')).toBe('dracula');

    await user.click(screen.getByTestId('code-theme-select'));
    await user.click(await screen.findByTestId('code-theme-option-ink'));
    await waitFor(() => expect(captured.dsl.themeId).toBe('ink'));
    expect(captured.css.themeId).toBe('ink');
    await waitFor(() => expect(stored('editorTheme')).toBe('ink'));

    expect(mounts).toEqual(before);
  });

  it('does not touch the DSL or CSS content', async () => {
    await bootWithCssOpen();
    const dsl = captured.dsl.value;
    const css = captured.css.value;
    expect(typeof dsl).toBe('string');
    fireEvent.click(screen.getByTestId('code-font-increase'));
    await waitFor(() => expect(captured.dsl.fontSize).toBe(DEFAULT_SETTINGS.fontSize + 1));
    expect(captured.dsl.value).toBe(dsl);
    expect(captured.css.value).toBe(css);
  });
});
