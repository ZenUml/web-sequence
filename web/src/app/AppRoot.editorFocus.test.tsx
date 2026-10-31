import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';
import { useSettingsStore } from '../state/settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';
import { LS_KEYS, APP_VERSION } from '../config/constants';

// Issues #941 / #942: keyboard focus must land in the DSL editor after New and
// after a code edit that originates in the preview (the "add your first
// participant" placeholder), and the one-time "Saved on this device" notice must
// not fire for a diagram with no content.

// CodeEditor is mocked as a forwardRef whose handle mirrors the one AppRoot uses
// (@uiw ReactCodeMirrorRef: `.view.focus()`), so a focus call is observable.
const focus = vi.hoisted(() => ({ dsl: vi.fn(), css: vi.fn() }));
const dispatch = vi.hoisted(() => ({ dsl: vi.fn(), css: vi.fn() }));
const captured: Record<string, Record<string, unknown>> = {};
vi.mock('../editor/CodeEditor', () => ({
  CodeEditor: forwardRef<unknown, Record<string, unknown>>(function MockEditor(props, ref) {
    const lang = String(props.language);
    captured[lang] = props;
    useImperativeHandle(ref, () => ({
      view: {
        focus: focus[lang as 'dsl' | 'css'],
        dispatch: dispatch[lang as 'dsl' | 'css'],
        // Doc length stands in for the real CodeMirror state: the current value's length.
        state: { doc: { length: String(props.value ?? '').length } },
      },
    }), [lang, props.value]);
    return <div data-testid={String(props.testId)} />;
  }),
}));

// PreviewFrame is mocked so the test can replay a renderer-originated code edit
// (the placeholder click) through the same `onCodeChange` prop AppRoot wires.
const preview: { props?: Record<string, unknown> } = {};
vi.mock('../preview/PreviewFrame', () => ({
  PreviewFrame: forwardRef<unknown, Record<string, unknown>>(function MockPreview(props, ref) {
    preview.props = props;
    useImperativeHandle(ref, () => ({}), []);
    return <div data-testid="preview-frame" />;
  }),
}));

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

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
  setItem: vi.fn(async () => ({ status: 'local' })),
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

import { AppRoot } from './AppRoot';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  window.history.replaceState({}, '', '/?code=A%3AB');
  for (const k of Object.keys(captured)) delete captured[k];
  preview.props = undefined;
  focus.dsl.mockClear();
  focus.css.mockClear();
  dispatch.dsl.mockClear();
  dispatch.css.mockClear();
  useAuthStore.setState({ user: null, online: true, authReady: false });
  useEditorStore.getState().reset();
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  window.localStorage.clear();
  window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION));
});

const saveShortcut = () =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));

describe('AppRoot — editor focus after New and after a preview-originated edit (#941, #942)', () => {
  it('header New moves keyboard focus into the DSL editor', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    focus.dsl.mockClear();
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(focus.dsl).toHaveBeenCalled());
    expect(focus.css).not.toHaveBeenCalled();
  });

  it('a code edit coming from the preview focuses the DSL editor', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    await waitFor(() => expect(preview.props?.onCodeChange).toBeTypeOf('function'));
    focus.dsl.mockClear();
    (preview.props!.onCodeChange as (code: string) => void)('A');
    await waitFor(() => expect(focus.dsl).toHaveBeenCalled());
    expect(useEditorStore.getState().currentItem?.js).toBe('A');
    // The caret goes to the END of the inserted text, so typing continues after it.
    expect(dispatch.dsl).toHaveBeenCalledWith({ selection: { anchor: 1 } });
  });

  it('an ordinary keystroke in the editor does not re-request focus', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    await waitFor(() => expect(captured.dsl?.onChange).toBeTypeOf('function'));
    focus.dsl.mockClear();
    (captured.dsl.onChange as (v: string) => void)('A:B\nB:C');
    await waitFor(() => expect(useEditorStore.getState().currentItem?.js).toBe('A:B\nB:C'));
    expect(focus.dsl).not.toHaveBeenCalled();
  });
});

describe('AppRoot — signed-out "Saved on this device" notice needs content (#941)', () => {
  it('does not open the notice (nor mark it seen) for an empty New diagram', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    itemSvc.setItem.mockClear();
    fireEvent.click(screen.getByTestId('header-new'));
    // #943: a blank New is not persisted at all; give any stray save a turn to run.
    await new Promise((r) => setTimeout(r, 50));
    expect(itemSvc.setItem).not.toHaveBeenCalled();
    expect(screen.queryAllByText('Saved on this device')).toHaveLength(0);
    expect(window.localStorage.getItem(LS_KEYS.loginAndSaveMessageSeen)).toBeNull();
  });

  it('the first-content persist of a New diagram is silent; the next ordinary save opens the notice (#951)', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(captured.dsl?.onChange).toBeTypeOf('function'));
    itemSvc.setItem.mockClear();
    (captured.dsl.onChange as (v: string) => void)('A');
    // The first keystroke persists the new diagram (#943) ...
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    // ... and give the post-save notice logic a turn to (wrongly) run.
    await new Promise((r) => setTimeout(r, 50));
    // ... without the modal that would steal focus mid-typing.
    expect(screen.queryAllByText('Saved on this device')).toHaveLength(0);
    expect(window.localStorage.getItem(LS_KEYS.loginAndSaveMessageSeen)).toBeNull();
    // Keep typing, then an explicit Ctrl+S is the quiet moment for the one-time notice.
    (captured.dsl.onChange as (v: string) => void)('A->B: hi');
    await waitFor(() => expect(useEditorStore.getState().currentItem?.js).toBe('A->B: hi'));
    saveShortcut();
    expect((await screen.findAllByText('Saved on this device')).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(LS_KEYS.loginAndSaveMessageSeen)).not.toBeNull();
  });

  it('opens the notice once the diagram has content and is saved', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(captured.dsl?.onChange).toBeTypeOf('function'));
    (captured.dsl.onChange as (v: string) => void)('A->B: hi');
    await waitFor(() => expect(useEditorStore.getState().currentItem?.js).toBe('A->B: hi'));
    saveShortcut();
    expect((await screen.findAllByText('Saved on this device')).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(LS_KEYS.loginAndSaveMessageSeen)).not.toBeNull();
  });
});
