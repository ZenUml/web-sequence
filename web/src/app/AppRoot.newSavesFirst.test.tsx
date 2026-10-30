import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';
import { useSettingsStore } from '../state/settingsStore';
import { DEFAULT_SETTINGS } from '../domain/types';
import { LS_KEYS, APP_VERSION } from '../config/constants';

// Issue #952: header New must SAVE the current diagram first and only then create
// the new one. The "Discard unsaved changes?" dialog is the fallback for a save that
// really failed. Mock harness mirrors AppRoot.editorFocus.test.tsx.

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
  itemSvc.setItem.mockReset();
  itemSvc.setItem.mockImplementation(async () => ({ status: 'local' }));
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

type Outcome = { status: string };
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function typeDiagram(code = 'A->B: hi') {
  render(<AppRoot />);
  await screen.findByTestId('dsl-editor');
  await waitFor(() => expect(captured.dsl?.onChange).toBeTypeOf('function'));
  (captured.dsl.onChange as (v: string) => void)(code);
  await waitFor(() => expect(useEditorStore.getState().currentItem?.js).toBe(code));
  return useEditorStore.getState().currentItem!.id;
}

describe('AppRoot — New saves the current diagram first (#952)', () => {
  it('saves the edit, then opens a blank diagram, without the discard dialog', async () => {
    const firstId = await typeDiagram();
    itemSvc.setItem.mockClear();
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
    // The first diagram reached storage with its edit, under its own id.
    expect(itemSvc.setItem).toHaveBeenCalledTimes(1);
    const [savedId, savedItem] = itemSvc.setItem.mock.calls[0] as unknown as [string, { js: string }];
    expect(savedId).toBe(firstId);
    expect(savedItem.js).toBe('A->B: hi');
    expect(useEditorStore.getState().currentItem?.js).toBe('');
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('does not create the new diagram until the save has settled', async () => {
    const firstId = await typeDiagram();
    const gate = deferred<Outcome>();
    itemSvc.setItem.mockClear();
    itemSvc.setItem.mockImplementationOnce(() => gate.promise);
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    expect(useEditorStore.getState().currentItem?.id).toBe(firstId);
    gate.resolve({ status: 'local' });
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
  });

  it('a failed save keeps the diagram and shows the discard dialog; confirm then discards', async () => {
    const firstId = await typeDiagram();
    itemSvc.setItem.mockClear();
    itemSvc.setItem.mockRejectedValueOnce(new Error('quota'));
    fireEvent.click(screen.getByTestId('header-new'));
    expect(await screen.findByRole('heading', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    expect(useEditorStore.getState().currentItem?.id).toBe(firstId);
    expect(useEditorStore.getState().currentItem?.js).toBe('A->B: hi');
    fireEvent.click(screen.getByTestId('confirm-ok'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
  });

  it('waits for an auto-save already in flight instead of showing the dialog', async () => {
    const firstId = await typeDiagram();
    const gate = deferred<Outcome>();
    itemSvc.setItem.mockClear();
    itemSvc.setItem.mockImplementationOnce(() => gate.promise);
    saveShortcut(); // stands in for the 15 s auto-save tick: a save is now in flight
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('header-new'));
    // New must wait for that attempt, not bail out and not open the dialog.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(useEditorStore.getState().currentItem?.id).toBe(firstId);
    gate.resolve({ status: 'local' });
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
    // The in-flight save covered the edit, so New did not write a second time.
    expect(itemSvc.setItem).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('saves again after an in-flight save when the user typed while it ran', async () => {
    const firstId = await typeDiagram('A->B: hi');
    const gate = deferred<Outcome>();
    itemSvc.setItem.mockClear();
    itemSvc.setItem.mockImplementationOnce(() => gate.promise);
    saveShortcut();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    (captured.dsl.onChange as (v: string) => void)('A->B: hi\nB->C: more');
    fireEvent.click(screen.getByTestId('header-new'));
    gate.resolve({ status: 'local' });
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
    expect(itemSvc.setItem).toHaveBeenCalledTimes(2);
    const last = itemSvc.setItem.mock.calls[1] as unknown as [string, { js: string }];
    expect(last[0]).toBe(firstId);
    expect(last[1].js).toBe('A->B: hi\nB->C: more');
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('a queued (offline, retained locally) save lets New proceed without the dialog', async () => {
    const firstId = await typeDiagram();
    itemSvc.setItem.mockClear();
    itemSvc.setItem.mockResolvedValueOnce({ status: 'queued' });
    useAuthStore.setState({ user: { uid: 'u1', email: 'a@b.c', displayName: 'U', photoURL: null }, online: false, authReady: true });
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('a clean diagram still creates the new one immediately, without saving', async () => {
    render(<AppRoot />);
    await screen.findByTestId('dsl-editor');
    const firstId = useEditorStore.getState().currentItem!.id;
    itemSvc.setItem.mockClear();
    fireEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(firstId));
    expect(itemSvc.setItem).not.toHaveBeenCalled();
  });
});
