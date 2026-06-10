import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';
import { useSettingsStore } from '../state/settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';
import { LS_KEYS, APP_VERSION } from '../config/constants';

// ─── CodeEditor capture mock ──────────────────────────────────────────────────
// This file (separate from AppRoot.test.tsx, whose CSS-gate tests type into the
// REAL CodeMirror) mocks CodeEditor purely to record the props each instance
// receives. The DSL/CSS panes are distinguished by their `language` prop.
const captured: Record<string, Record<string, unknown>> = {};
vi.mock('../editor/CodeEditor', () => ({
  CodeEditor: (props: Record<string, unknown>) => {
    captured[String(props.language)] = props;
    return <div data-testid={String(props.testId)} />;
  },
}));

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
  // Hub view gating (PRs #800/#801): '/' now renders HomeView, not the editor.
  // Land on an editor URL; the mocked getItem rejects → useBootItem seeds a fresh
  // 'new' item, same as the pre-hub boot (see AppRoot.test.tsx).
  window.history.replaceState({}, '', '/?id=t-boot');
  for (const k of Object.keys(captured)) delete captured[k];
  useAuthStore.setState({ user: null, online: true, authReady: false });
  useEditorStore.getState().reset();
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  window.localStorage.clear();
  // Suppress the one-time onboarding/pledge triggers (they'd perturb boot).
  window.localStorage.setItem(LS_KEYS.onboarded, JSON.stringify(true));
  window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION));
});

describe('AppRoot — editor settings wiring (editor-wiring fix)', () => {
  // DISCRIMINATING: CodeEditor's component defaults (fontSize 16, keymap 'sublime')
  // are IDENTICAL to DEFAULT_SETTINGS, so asserting against defaults would pass even
  // with the controls dead. We set NON-default settings; reverting the prop wiring in
  // AppRoot makes the editors fall back to component defaults → these assertions fail.
  it('threads settings-driven themeId/fontSize/keymap/fontFamily into BOTH editors', async () => {
    useSettingsStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        editorTheme: 'dracula',  // ≠ DEFAULT_SETTINGS 'monokai' and ≠ CodeEditor DEFAULT_THEME 'ink'
        fontSize: 13,            // ≠ 16
        keymap: 'vim',           // ≠ 'sublime'
        editorFont: 'Inconsolata',
      },
    });
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    // CSS pane is a collapsible CssPanel, collapsed when CSS is empty — expand it so
    // its (mocked) CodeEditor mounts and records props.
    fireEvent.click(await screen.findByTestId('css-panel-strip'));
    await waitFor(() => expect(captured.dsl).toBeDefined());
    await waitFor(() => expect(captured.css).toBeDefined());

    for (const pane of ['dsl', 'css'] as const) {
      expect(captured[pane].themeId).toBe('dracula');
      expect(captured[pane].fontSize).toBe(13);
      expect(captured[pane].keymap).toBe('vim');
      expect(captured[pane].fontFamily).toBe('Inconsolata');
    }
  });

  // DISCRIMINATING: the 'other' sentinel must resolve to editorCustomFont, not pass
  // the literal 'other' through (which is not a real CSS font family).
  it("resolves editorFont 'other' to editorCustomFont", async () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, editorFont: 'other', editorCustomFont: 'Comic Mono' },
    });
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    fireEvent.click(await screen.findByTestId('css-panel-strip'));
    await waitFor(() => expect(captured.dsl).toBeDefined());
    await waitFor(() => expect(captured.css).toBeDefined());
    expect(captured.dsl.fontFamily).toBe('Comic Mono');
    expect(captured.css.fontFamily).toBe('Comic Mono');
  });
});
