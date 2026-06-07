import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
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
// trackEvent (M04) is mocked so useAnalytics→emit→cloudTrackEvent doesn't crash/POST.
vi.mock('../services/cloudFunctions', () => ({
  getSharedItem: vi.fn(async () => { throw new Error('not found'); }),
  createShare: vi.fn(async () => ({ url: 'http://x?id=1&v=abc', md5: 'abc' })),
  trackEvent: vi.fn(async () => {}),
}));

// itemService.setItem / getItem / saveLastCode — prevent real Firestore calls.
// Stable hoisted spies (makeItemService returns the SAME object every call) so the
// save-seam tests can assert setItem's 3rd-arg ({ skipCloud }) decision (M04 Task 16).
const itemSvc = vi.hoisted(() => ({
  setItem: vi.fn(async (_id: string, _item: unknown, _opts?: { skipCloud?: boolean }) => {}),
  getItem: vi.fn(async () => { throw new Error('not found'); }),
  saveLastCode: vi.fn(),
  saveItems: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
  moveToFolder: vi.fn(async () => {}),
  stopSharing: vi.fn(async () => {}),
  subscribeAllItems: vi.fn(() => () => {}),
}));
vi.mock('../services/itemService', () => ({ makeItemService: () => itemSvc }));

// userService — M03 unsetItemForUser; M04 adds getUserItemIds (pre-insert owned-id
// sample for the plan-limit seam) + setUserSetting (settings cloud persist).
const userSvc = vi.hoisted(() => ({
  ensureUser: vi.fn(async () => ({})),
  getUserSettings: vi.fn(async () => ({})),
  setItemForUser: vi.fn(async () => {}),
  unsetItemForUser: vi.fn(async () => {}),
  getUserItemIds: vi.fn(async () => [] as string[]),
  setUserSetting: vi.fn(async () => {}),
}));
vi.mock('../services/userService', () => userSvc);

// folderService hits Firestore (getFolders → collection()). Signed-in M04 tests
// would trigger a real Firestore call against the stub db; mock it out.
vi.mock('../services/folderService', () => ({
  getFolders: vi.fn(async () => []),
  createFolder: vi.fn(async () => ({})),
  renameFolder: vi.fn(async () => ({})),
  deleteFolder: vi.fn(async () => {}),
}));

// subscriptionService — M04. Default: no subscription (free). Tests override
// retrieveSubscription per-case (incl. a never-resolving deferred for the race guard).
const subSvc = vi.hoisted(() => ({ retrieveSubscription: vi.fn(async () => null) }));
vi.mock('../services/subscriptionService', () => subSvc);

// usePaddle — M04. Avoid the CDN <script> inject on mount; capture openCheckout.
const paddle = vi.hoisted(() => ({ openCheckout: vi.fn() }));
vi.mock('../hooks/usePaddle', () => ({ usePaddle: () => paddle }));

// exportImport — parseImportJson throws on malformed JSON; the real one is exercised
// in its own spec. Here we force the throw to assert AppRoot surfaces it (advisor fix #6).
vi.mock('../services/exportImport', async (orig) => {
  const actual = await orig<typeof import('../services/exportImport')>();
  return {
    ...actual,
    parseImportJson: vi.fn(() => { throw new Error('Bad JSON at line 1'); }),
  };
});

import { LS_KEYS, APP_VERSION } from '../config/constants';

beforeEach(async () => {
  useAuthStore.setState({ user: null, online: true, authReady: false });
  useEditorStore.getState().reset();
  // uiStore is a module singleton — reset modal/panel state so a modal opened in a
  // prior test (e.g. pricing) doesn't leak (the pledge one-time-trigger no-ops when
  // a modal is already open).
  const { useUiStore } = await import('../state/uiStore');
  useUiStore.setState({ activeModal: null, activePanel: 'editor', consoleOpen: false, fullscreen: false, loginModalOpen: false });
  // M04 one-time triggers fire on boot/auth-ready. jsdom localStorage starts empty,
  // so Onboarding + SupportPledge would auto-open in EVERY AppRoot test and perturb
  // queries. Pre-mark them seen here; dedicated trigger tests clear them explicitly.
  window.localStorage.clear();
  window.localStorage.setItem(LS_KEYS.onboarded, JSON.stringify(true));
  window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION));
  // Reset M04 spies + restore default subscription (free / resolved).
  itemSvc.setItem.mockClear();
  userSvc.setItemForUser.mockClear();
  userSvc.getUserItemIds.mockClear();
  userSvc.getUserItemIds.mockResolvedValue([]);
  userSvc.setUserSetting.mockClear();
  subSvc.retrieveSubscription.mockReset();
  subSvc.retrieveSubscription.mockResolvedValue(null);
  paddle.openCheckout.mockClear();
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

  it('surfaces an "Import failed" notice when the imported file is malformed (advisor fix #6)', async () => {
    // parseImportJson is mocked to throw. Before the fix handleImport had no
    // try/catch, so the throw became a swallowed unhandled rejection with no UI.
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    useUiStore.getState().setActivePanel('library');
    await screen.findByTestId('library-panel');

    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    await userEvent.upload(input, file);

    // The error notice appears, showing the parser's message (queried by the unique
    // message text, not the shared confirm-ok testid). The title also renders as a
    // dialog heading.
    expect(await screen.findByText('Bad JSON at line 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Import failed' })).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// M04 Task 16 — save-seam plan limit + race guard + custom-CSS Plus gate.
//
// itemService is fully mocked here, so we assert the SEAM DECISION (setItem's 3rd
// arg { skipCloud } + whether setItemForUser ran + whether LimitReachedNotice is
// open), NOT the Firestore setDoc — the setDoc-level proof lives in
// itemService.test.ts (the skipCloud test). This is the honest layered split.
// ───────────────────────────────────────────────────────────────────────────
describe('AppRoot — M04 save-seam plan limit', () => {
  const signedInUser = { uid: 'u1', email: 'u1@test.com', displayName: 'U', photoURL: null };

  async function bootSignedIn() {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Sign in AFTER boot so useSubscription's uid-effect runs (null → 'u1').
    await act(async () => {
      useAuthStore.setState({ user: signedInUser, authReady: true, online: true });
    });
  }

  async function clickSave() {
    await act(async () => {
      await userEvent.click(screen.getByTestId('header-save'));
    });
  }

  it('(a) free user at 4 owned saving a NEW item → cloud SKIPPED (skipCloud), no membership write, notice opens', async () => {
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']); // 4 owned, over free cap 3
    await bootSignedIn();
    // Wait for subscription to resolve to free (loading→false).
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]).toEqual({ skipCloud: true });
    expect(userSvc.setItemForUser).not.toHaveBeenCalled();
    expect(await screen.findByTestId('limit-notice')).toBeInTheDocument();
  });

  it('(b) free user at EXACTLY 3 owned saving the 4th NEW item → cloud write proceeds (legacy admits limit+1)', async () => {
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c']); // 3 owned, == cap
    await bootSignedIn();
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]?.skipCloud).toBeFalsy();
    expect(userSvc.setItemForUser).toHaveBeenCalled();
    expect(screen.queryByTestId('limit-notice')).not.toBeInTheDocument();
  });

  it('(c) free user at 4 owned RE-SAVING an already-owned item → cloud SKIPPED (no includes exemption)', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Owned set INCLUDES the current item's id → this is a re-save of an owned item.
    const currentId = store.getState().currentItem!.id;
    userSvc.getUserItemIds.mockResolvedValue([currentId, 'b', 'c', 'd']); // 4 owned (over cap)
    await act(async () => {
      useAuthStore.setState({ user: signedInUser, authReady: true, online: true });
    });
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]).toEqual({ skipCloud: true });
    expect(userSvc.setItemForUser).not.toHaveBeenCalled();
    expect(await screen.findByTestId('limit-notice')).toBeInTheDocument();
  });

  it('(d) RACE GUARD — saving while subscription is STILL LOADING → cloud proceeds, NO notice', async () => {
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']); // would be over-cap if free
    // Never-resolving deferred so useSubscription.loading stays true at save time.
    subSvc.retrieveSubscription.mockReturnValue(new Promise(() => {}) as Promise<null>);
    await bootSignedIn();
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    // loading===true → enforcement skipped → cloud write proceeds (not skipped).
    expect(call[2]?.skipCloud).toBeFalsy();
    expect(userSvc.setItemForUser).toHaveBeenCalled();
    expect(screen.queryByTestId('limit-notice')).not.toBeInTheDocument();
  });

  // Discriminating (adversarial review #1): the over-limit branch must NOT clear the
  // editor's dirty/unsaved state. The cloud write was withheld (skipCloud), so the
  // diagram is NOT synced — calling markSaved() would falsely present it as a clean
  // cloud save (silent data-loss risk). Reverting to the unconditional markSaved()
  // makes dirty=false / unsavedCount=0 here → fails.
  it('(e) over-limit save does NOT clear dirty/unsaved state (no false clean-save signal)', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']); // over free cap
    await bootSignedIn();
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    // Make a real content edit so dirty=true / unsavedCount>0 going into the save.
    act(() => { store.getState().setDsl('A.x'); });
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().unsavedCount).toBeGreaterThan(0);
    await clickSave();
    await waitFor(() => expect(screen.queryByTestId('limit-notice')).toBeInTheDocument());
    // Cloud was withheld → state must remain dirty/unsaved (user keeps being prompted).
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().unsavedCount).toBeGreaterThan(0);
  });

  // Discriminating (adversarial review #2): a transient getUserItemIds error must
  // FAIL CLOSED for a non-Plus user — withhold the cloud write rather than admit a
  // cap-bypassing write. The old code swallowed the error to [] (length 0 > cap =
  // false) and proceeded with the full cloud write. CRUCIALLY, a read FAILURE is NOT
  // a confirmed limit hit: it must NOT show the "you hit your limit, upgrade" notice
  // (false claim to a possibly-under-cap user) and must NOT fire the 'Free Limit'
  // analytics (metric inflation on a non-limit condition). So: cloud skipped, no
  // membership write, but NO limit-notice. Reverting the fail-closed write makes
  // skipCloud falsy / setItemForUser called → fails; coupling the notice to the
  // read-error case makes limit-notice appear → also fails.
  it('(f) FAIL CLOSED — getUserItemIds throws for a free user → cloud SKIPPED, NO limit notice', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    userSvc.getUserItemIds.mockRejectedValue(new Error('Firestore offline'));
    await bootSignedIn();
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    // Edit so we can assert dirty stays true (no false clean-save) after withholding.
    act(() => { store.getState().setDsl('A.x'); });
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]).toEqual({ skipCloud: true }); // write withheld → no cap bypass
    expect(userSvc.setItemForUser).not.toHaveBeenCalled();
    // A read FAILURE is not a confirmed limit hit → no misleading limit notice.
    expect(screen.queryByTestId('limit-notice')).not.toBeInTheDocument();
    // Dirty state preserved (the write did not land) so the user retries honestly.
    expect(store.getState().dirty).toBe(true);
  });

  // Discriminating (adversarial review #2 complement): a Plus user is unaffected by
  // the read error — isOverFileLimit is false for Plus regardless of count, so the
  // fail-closed branch must NOT withhold their cloud write.
  it('(g) FAIL CLOSED does not penalize a PLUS user when getUserItemIds throws', async () => {
    subSvc.retrieveSubscription.mockResolvedValue(
      { status: 'active', passthrough: '{"planType":"plus-monthly"}' } as never,
    );
    userSvc.getUserItemIds.mockRejectedValue(new Error('Firestore offline'));
    await bootSignedIn();
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]?.skipCloud).toBeFalsy();
    expect(userSvc.setItemForUser).toHaveBeenCalled();
    expect(screen.queryByTestId('limit-notice')).not.toBeInTheDocument();
  });
});

describe('AppRoot — M04 custom-CSS Plus gate', () => {
  it('signed-in FREE user editing CSS → pricing modal opens + CSS unchanged', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null }, authReady: true, online: true });
    });
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    const before = store.getState().currentItem?.css ?? '';
    const cmContent = screen.getByTestId('css-editor').querySelector('.cm-content') as HTMLElement;
    await act(async () => {
      await userEvent.click(cmContent);
      await userEvent.keyboard('x');
    });
    // Gated: CSS unchanged AND pricing modal opened.
    expect(store.getState().currentItem?.css).toBe(before);
    expect(useUiStore.getState().activeModal).toBe('pricing');
  });

  it('anonymous user editing CSS → login modal opens + CSS unchanged', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />); // signed-out by default
    await screen.findByTestId('header-title');
    const before = store.getState().currentItem?.css ?? '';
    const cmContent = screen.getByTestId('css-editor').querySelector('.cm-content') as HTMLElement;
    await act(async () => {
      await userEvent.click(cmContent);
      await userEvent.keyboard('x');
    });
    expect(store.getState().currentItem?.css).toBe(before);
    expect(useUiStore.getState().loginModalOpen).toBe(true);
    expect(useUiStore.getState().activeModal).not.toBe('pricing');
  });

  // DISCRIMINATING: a Plus user edits CSS freely (no gate). retrieveSubscription
  // resolves an active plus sub so isPlus(subscription) is true.
  it('Plus user editing CSS → change applies, no pricing/login modal', async () => {
    subSvc.retrieveSubscription.mockResolvedValue(
      { status: 'active', passthrough: '{"planType":"plus-monthly"}' } as never,
    );
    const { useEditorStore: store } = await import('../state/editorStore');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null }, authReady: true, online: true });
    });
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    const before = store.getState().currentItem?.css ?? '';
    const cmContent = screen.getByTestId('css-editor').querySelector('.cm-content') as HTMLElement;
    await act(async () => {
      await userEvent.click(cmContent);
      await userEvent.keyboard('z');
    });
    // CSS changed (gate did not fire); no billing/login modal opened.
    expect(store.getState().currentItem?.css).not.toBe(before);
    expect(useUiStore.getState().activeModal).not.toBe('pricing');
    expect(useUiStore.getState().loginModalOpen).toBe(false);
  });
});

describe('AppRoot — M04 modal reachability', () => {
  it('Ctrl/Cmd+Shift+? opens the Keyboard-Shortcuts modal (REQ-KB-1)', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      // '?' is Shift+'/'; dispatch the key with the modifier combo.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', ctrlKey: true, shiftKey: true }));
    });
    expect(await screen.findByTestId('shortcuts-modal')).toBeInTheDocument();
  });

  it('ACSS-config button appears in acss mode and opens the AtomicCss modal (REQ-ED-2)', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Switch the current item to acss mode (signed-out → CSS-gate does not apply to
    // setCssMode via the store directly; we drive the store to set up the affordance).
    await act(async () => {
      store.setState((s) => (s.currentItem ? { currentItem: { ...s.currentItem, cssMode: 'acss' } } : s));
    });
    const openBtn = await screen.findByTestId('acss-settings-open');
    await act(async () => { await userEvent.click(openBtn); });
    expect(await screen.findByTestId('acss-modal')).toBeInTheDocument();
  });
});

describe('AppRoot — M04 one-time triggers', () => {
  it('opens the Onboarding modal on boot when not yet onboarded', async () => {
    window.localStorage.removeItem(LS_KEYS.onboarded);
    render(<AppRoot />);
    expect(await screen.findByTestId('onboarding-modal')).toBeInTheDocument();
  });

  it('opens the SupportPledge modal when lastSeenVersion is behind APP_VERSION', async () => {
    window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify('0.0.1'));
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await waitFor(() => expect(useUiStore.getState().activeModal).toBe('pledge'));
    expect(await screen.findByTestId('pledge-modal')).toBeInTheDocument();
  });

  // Discriminating (adversarial review #4): a brand-new user (no lastSeenVersion,
  // not onboarded) must see Onboarding — NEVER the version-upgrade pledge. And the
  // moment onboarding is shown, lastSeenVersion is stamped so their NEXT boot does
  // not mistake them for an upgrade. Reverting either part (no stamp, or no
  // truthiness gate) makes the pledge open for a first-time user → fails.
  it('brand-new user sees Onboarding and is stamped — never the upgrade pledge', async () => {
    window.localStorage.removeItem(LS_KEYS.onboarded);
    window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    // Onboarding opens (not pledge).
    expect(await screen.findByTestId('onboarding-modal')).toBeInTheDocument();
    expect(useUiStore.getState().activeModal).toBe('onboarding');
    // lastSeenVersion is stamped to APP_VERSION (so the 2nd boot suppresses the pledge).
    await waitFor(() =>
      expect(window.localStorage.getItem(LS_KEYS.lastSeenVersion)).toBe(JSON.stringify(APP_VERSION)),
    );
  });

  // Discriminating (adversarial review #4, the actual reported symptom): simulate the
  // SECOND visit of a brand-new user — onboarded already true (they dismissed it) but
  // suppose the stamp never happened (lastSeenVersion still ''). The pledge MUST NOT
  // open (truthiness gate). The old gate computed semverCompare('0.0.0', APP_VERSION)
  // < 0 → true and opened the pledge for a first-timer.
  it('does NOT open the pledge when lastSeenVersion is empty (first-timer, wrong audience)', async () => {
    window.localStorage.setItem(LS_KEYS.onboarded, JSON.stringify(true));
    window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Give the async boot effects time to run; the pledge must stay closed.
    await waitFor(() => expect(screen.getByTestId('header-title')).toBeInTheDocument());
    expect(useUiStore.getState().activeModal).not.toBe('pledge');
    expect(screen.queryByTestId('pledge-modal')).not.toBeInTheDocument();
  });
});

describe('AppRoot — signed-out settings persistence (adversarial review #3)', () => {
  // Discriminating: a signed-out user's prefs written to syncStore must be LOADED on
  // boot. handleSettingChange writes syncStore.set(key, value); before the fix nothing
  // read it back, so settingsStore re-init to DEFAULT_SETTINGS discarded the value on
  // reload. We pre-seed syncStore (= localStorage on web) with a NON-default value and
  // assert settingsStore reflects it after boot. Reverting the boot-load effect leaves
  // the store at DEFAULT_SETTINGS → fails.
  it('loads synced prefs into settingsStore on boot (signed-out)', async () => {
    const { useSettingsStore } = await import('../state/settingsStore');
    const { DEFAULT_SETTINGS } = await import('../domain/types');
    // Distinctive non-default values (default fontSize 16, editorTheme 'monokai',
    // preserveLastCode true).
    window.localStorage.setItem('fontSize', JSON.stringify(13));
    window.localStorage.setItem('editorTheme', JSON.stringify('dracula'));
    window.localStorage.setItem('preserveLastCode', JSON.stringify(false));
    expect(DEFAULT_SETTINGS.fontSize).not.toBe(13); // guard: the test value IS non-default
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await waitFor(() => expect(useSettingsStore.getState().settings.fontSize).toBe(13));
    expect(useSettingsStore.getState().settings.editorTheme).toBe('dracula');
    expect(useSettingsStore.getState().settings.preserveLastCode).toBe(false);
  });
});
