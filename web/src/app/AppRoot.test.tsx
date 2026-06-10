import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './AppRoot';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

// ─── Router harness (hub PRs #800/#801: HomeView + reactive ?id= routing) ─────
// The Hub-navigation PRs (#800 "Approach A Hub navigation — HomeView, no-rail
// editor, breadcrumb", #801 mobile follow-up) made AppRoot read the URL through
// TanStack Router (`useSearch({ from: indexRoute.id })`, AppRoot.tsx) and navigate
// imperatively (`useNavigate`). Rendering <AppRoot /> without a RouterProvider now
// crashes inside useMatch ("Cannot read properties of null (reading 'stores')").
// Rather than booting a real router — a createMemoryHistory router would SPLIT the
// URL source of truth, because detectFromEnv() and this file's embed tests already
// drive window.location via history.replaceState — we partial-mock JUST the two
// hooks against window.location:
//  - useSearch parses location.search in the same shape as router.tsx's
//    indexRoute validateSearch (id, share-token, embed-presence flag, code, title,
//    stickyOffset coerced to Number);
//  - useNavigate applies the functional search updater back onto location via
//    history.replaceState (the store updates that accompany every navigate() call
//    in AppRoot re-render, and useSearch re-parses the fresh URL on that render).
// All other exports (createRoute/createRouter/… used by ./router) stay real.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  const parse = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      id: p.get('id') ?? undefined,
      'share-token': p.get('share-token') ?? undefined,
      embed: p.has('embed') ? true : undefined,
      code: p.get('code') ?? undefined,
      title: p.get('title') ?? undefined,
      stickyOffset: p.has('stickyOffset') ? Number(p.get('stickyOffset')) : undefined,
    };
  };
  return {
    ...actual,
    useSearch: () => parse(),
    useNavigate: () => (opts?: { search?: unknown }) => {
      const next = typeof opts?.search === 'function'
        ? (opts.search as (prev: Record<string, unknown>) => Record<string, unknown>)(parse())
        : ((opts?.search ?? {}) as Record<string, unknown>);
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === null || v === false) continue;
        q.set(k, v === true ? '' : String(v));
      }
      const qs = q.toString();
      window.history.replaceState({}, '', qs ? `/?${qs}` : '/');
      return Promise.resolve();
    },
  };
});

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
import { localStore, syncStore } from '../services/storage';
// The mocked cloud-function sink (vi.mock above). useAnalytics → emit → cloudTrackEvent
// POSTs {event, userId, ...props} here, so asserting its calls verifies the exact
// Mixpanel envelope (event name + category + label) the rewrite emits (REQ-ANL-1).
import { trackEvent as mockTrackEvent } from '../services/cloudFunctions';
const trackMock = vi.mocked(mockTrackEvent);

// Radix Select (used by the Settings modal) drives pointer interaction through APIs
// jsdom doesn't implement — same polyfill as SettingsModal.test.tsx.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(async () => {
  // Hub view gating (PRs #800/#801): '/' with no ?id= now renders the HomeView
  // library grid, NOT the editor. Almost every test in this file asserts editor
  // internals (editor-region, dsl-editor, header-title, console…), so default every
  // test onto an editor URL. The mocked itemService.getItem rejects ('not found'),
  // so useBootItem resolves kind:'new' and seeds the SAME fresh editable item the
  // pre-hub '/' boot produced — each test's original intent is preserved. Home-view-
  // and embed-specific tests override the URL per-test via history.replaceState
  // before render() (the file's existing convention; afterEach restores '/').
  window.history.replaceState({}, '', '/?id=t-boot');
  // The default editor URL makes every boot call getItem('t-boot'); clear the call
  // log so per-test assertions (e.g. the by-value embed's "getItem NOT called")
  // observe only their own test's calls, not leakage from prior boots.
  itemSvc.getItem.mockClear();
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
  // Restore default no-op subscription (a per-test override must not leak).
  itemSvc.subscribeAllItems.mockReset();
  itemSvc.subscribeAllItems.mockImplementation(() => () => {});
  userSvc.setItemForUser.mockClear();
  userSvc.getUserItemIds.mockClear();
  userSvc.getUserItemIds.mockResolvedValue([]);
  userSvc.setUserSetting.mockClear();
  subSvc.retrieveSubscription.mockReset();
  subSvc.retrieveSubscription.mockResolvedValue(null);
  paddle.openCheckout.mockClear();
  trackMock.mockClear();
  // Analytics must take the SERVER path (POST /track) — not the debug short-circuit —
  // so the envelope assertions below observe real cloudTrackEvent calls.
  (window as { DEBUG?: boolean }).DEBUG = false;
  document.cookie = 'wmdebug=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

afterEach(() => {
  // M05: embed tests drive the URL via history.replaceState. A leaked ?embed= would
  // boot the NEXT test in embed mode (suppressing the header) and fail it. Restore to /.
  window.history.replaceState({}, '', '/');
});

// The CSS pane is now a collapsible CssPanel (redesign §02·7) that defaults COLLAPSED
// when the CSS source is empty — so `css-editor` / `css-mode-select` / `acss-settings-open`
// only render once expanded. Tests that drive CSS first expand the strip. Toggling the
// strip is pure UI (it does NOT call onCssChange) so it never trips the custom-CSS gate.
async function expandCss() {
  const strip = screen.queryByTestId('css-panel-strip');
  if (strip) await userEvent.click(strip);
}


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

  it('renders the css mode select and no js mode select (the JS pre-processor has no render effect)', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    await expandCss();
    expect(container.querySelector('[data-testid="css-mode-select"]')).toBeTruthy();
    // The diagram DSL is rendered by @zenuml/core; computeJs is never called, so the
    // JS pre-processor Select was dead UI and has been removed.
    expect(container.querySelector('[data-testid="js-mode-select"]')).toBeNull();
  });

  it('does NOT render the slash-command hint bar (panel removed 2026-06-10)', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    // The HintBar strip above the DSL editor was REMOVED at the product owner's
    // request ("remove the command panel and related code"). Slash commands stay
    // available via the in-editor "/" popup (zenumlAutocomplete). This guards
    // against the panel quietly returning.
    expect(container.querySelector('[aria-label="Insert slash command"]')).toBeNull();
  });

  it('renders the console panel', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    expect(container.querySelector('[data-testid="console"]')).toBeTruthy();
  });

  it('Present enters fullscreen (Present is the header entry point now)', async () => {
    const { getByTestId } = render(<AppRoot />);
    await screen.findByTestId('header-present');
    const { useUiStore } = await import('../state/uiStore');
    await userEvent.click(getByTestId('header-present'));
    expect(useUiStore.getState().fullscreen).toBe(true);
  });

  it('renders the AppHeader with title input + save-state indicator', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Save retired into the app menu; the passive save-state indicator + the app
    // menu trigger are the header's new persistent affordances.
    expect(screen.getByTestId('header-savestate')).toBeInTheDocument();
    expect(screen.getByTestId('header-menu')).toBeInTheDocument();
  });

  // The Save button is gone; ⌘S is the advertised manual-save accelerator (app menu
  // shows the ⌘S hint). It must actually save, not fall through to the browser.
  it('Cmd/Ctrl+S triggers a save', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      await userEvent.keyboard('{Meta>}s{/Meta}');
    });
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
  });

  it('renders the ShareButton in the header (M03 wiring)', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  // #4: Share is no longer a silently-disabled dead control when signed out. Boot
  // lands on a fresh editable `new` item (not read-only), so the button is ENABLED;
  // clicking it routes the signed-out user to the login modal instead of opening an
  // empty popover behind a sign-in wall. (Reverting #4 — disabling when signed out —
  // makes the click a no-op and login-google never appears → this fails.)
  it('share button (signed out) is enabled and opens the login modal on click', async () => {
    render(<AppRoot />); // signed-out by default
    await screen.findByTestId('header-title');
    const shareBtn = screen.getByTestId('share-button');
    expect(shareBtn).not.toBeDisabled();
    await act(async () => { await userEvent.click(shareBtn); });
    // The login modal (not the share popover) appears.
    expect(await screen.findByTestId('login-google')).toBeInTheDocument();
    expect(screen.queryByTestId('share-create')).not.toBeInTheDocument();
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
    // Save retired from a top-level button into the app menu (logo ▾). Manual save
    // now: open the app menu, click its Save item.
    await act(async () => {
      await userEvent.click(screen.getByTestId('header-menu'));
      await userEvent.click(await screen.findByTestId('header-save'));
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

  // Discriminating (adversarial review, finding 1): a transient getUserItemIds error
  // must FAIL OPEN for a non-Plus user — the cloud write PROCEEDS, membership IS
  // written, and the editor's clean-save state is set, exactly as a normal under-cap
  // save. Legacy checkItemsLimit (app.jsx:467-482) does NO I/O read at save (it reads
  // the in-memory state.user.items), so a read error NEVER blocks a save there; the
  // firestore rules do not enforce the count (C-RULES-1) so proceeding bypasses no
  // real enforcement. Failing CLOSED here silently stranded a confirmed-under-cap
  // user's data in localStorage with no signal — the worse outcome. Reverting to the
  // fail-closed write (skipCloud:true / no membership write) makes this test fail.
  it('(f) FAIL OPEN — getUserItemIds throws for a free user → cloud write PROCEEDS, membership written, NO notice', async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    userSvc.getUserItemIds.mockRejectedValue(new Error('Firestore offline'));
    await bootSignedIn();
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    // Edit so we can assert the clean-save state IS set after the write proceeds.
    act(() => { store.getState().setDsl('A.x'); });
    expect(store.getState().dirty).toBe(true);
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]?.skipCloud).toBeFalsy(); // write NOT withheld → user's data synced
    expect(userSvc.setItemForUser).toHaveBeenCalled(); // ownership-membership written
    // A read FAILURE is not a confirmed limit hit → no misleading limit notice.
    expect(screen.queryByTestId('limit-notice')).not.toBeInTheDocument();
    // Write landed → clean-save state set (no silent local-only stranding).
    await waitFor(() => expect(store.getState().dirty).toBe(false));
  });

  // Complement: a Plus user is likewise unaffected by the read error — the write
  // proceeds (isOverFileLimit is false for Plus regardless of count anyway).
  it('(g) FAIL OPEN does not penalize a PLUS user when getUserItemIds throws', async () => {
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
    await expandCss();
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
    await expandCss();
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
    await expandCss();
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
    await expandCss();
    const openBtn = await screen.findByTestId('acss-settings-open');
    await act(async () => { await userEvent.click(openBtn); });
    expect(await screen.findByTestId('acss-modal')).toBeInTheDocument();
  });
});

describe('AppRoot — M04 one-time triggers', () => {
  it('opens the Onboarding modal on boot when not yet onboarded', async () => {
    // A genuine first-run user has NEITHER flag (the beforeEach pre-seeds both).
    window.localStorage.removeItem(LS_KEYS.onboarded);
    window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
    render(<AppRoot />);
    expect(await screen.findByTestId('onboarding-modal')).toBeInTheDocument();
  });

  // Discriminating (adversarial review #2): a user MIGRATING from the legacy app has
  // lastSeenVersion set (via chrome.storage.sync → syncStore) but NO localStorage
  // `onboarded` key — legacy never wrote that key (it was a COOKIE, app.jsx:318-320),
  // and there is no backfill. Legacy gated onboarding on `!lastSeenVersion` ONLY
  // (app.jsx:314), so it would NOT re-onboard such a user. The rewrite must do the
  // same: presence of lastSeenVersion suppresses onboarding. Reverting the fix (gating
  // on `onboarded` alone) re-opens the onboarding modal here → fails.
  it('does NOT re-onboard a migrating legacy user (lastSeenVersion set, no `onboarded` key)', async () => {
    const { useUiStore } = await import('../state/uiStore');
    window.localStorage.removeItem(LS_KEYS.onboarded); // legacy never set this key
    window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION)); // returning user
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Let the async boot effects settle; onboarding must stay closed.
    await waitFor(() => expect(screen.getByTestId('header-title')).toBeInTheDocument());
    expect(useUiStore.getState().activeModal).not.toBe('onboarding');
    expect(screen.queryByTestId('onboarding-modal')).not.toBeInTheDocument();
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

  // Discriminating (adversarial review #2): a user MIGRATING from legacy who already
  // dismissed the pledge has pledgeModalSeen=true in the SAME localStorage the rewrite
  // reads, but a still-behind lastSeenVersion (legacy bumps lastSeenVersion only on
  // new-user onboarding / notification-click, NOT on pledge dismiss — app.jsx:329-331).
  // Legacy gates the pledge on `lastSeenVersion && semverCompare<0 && !pledgeModalSeen`.
  // The rewrite must honor pledgeModalSeen, or it re-shows the pledge once to a user
  // who already saw it (wrong audience, REQ-MOD-3). Reverting the !pledgeModalSeen gate
  // makes the pledge open here → fails.
  it('does NOT re-open the pledge for a legacy user who already dismissed it (pledgeModalSeen=true)', async () => {
    window.localStorage.setItem(LS_KEYS.onboarded, JSON.stringify(true));
    window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify('0.0.1')); // behind APP_VERSION
    window.localStorage.setItem(LS_KEYS.pledgeModalSeen, JSON.stringify(true)); // already saw it (legacy)
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await waitFor(() => expect(screen.getByTestId('header-title')).toBeInTheDocument());
    expect(useUiStore.getState().activeModal).not.toBe('pledge');
    expect(screen.queryByTestId('pledge-modal')).not.toBeInTheDocument();
  });
});

describe('AppRoot — lastSeenVersion storage backend (adversarial review #1)', () => {
  // On WEB, syncStore and localStore both fall back to window.localStorage
  // (storage.ts:20-22) — so asserting on window.localStorage CANNOT discriminate
  // which backend was used. But they are two DISTINCT objects (storage.ts:32-33),
  // so we spy each independently and assert lastSeenVersion routes through syncStore
  // (= chrome.storage.sync in the extension; legacy db.sync, db.js:131-140 + contract
  // §7.2), NOT localStore. This is the only honest seam; revert→fail proves it.
  //
  // Why it matters: a user migrating from the legacy extension has lastSeenVersion in
  // chrome.storage.sync. If the rewrite reads it via localStore it sees '' → treats
  // an upgrading user as brand-new → re-fires onboarding / mis-targets the pledge
  // (REQ-MOD-3). Reads (176, 192) AND writes (177) must both route through syncStore;
  // reads-on-local + writes-on-sync is exactly the broken extension state, so this
  // test asserts BOTH directions.
  it('reads AND writes lastSeenVersion via syncStore (not localStore) on new-user boot', async () => {
    const syncSet = vi.spyOn(syncStore, 'set');
    const syncGet = vi.spyOn(syncStore, 'get');
    const localSet = vi.spyOn(localStore, 'set');
    const localGet = vi.spyOn(localStore, 'get');
    try {
      window.localStorage.removeItem(LS_KEYS.onboarded);
      window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
      render(<AppRoot />);
      await screen.findByTestId('onboarding-modal');
      // WRITE (177): new-user stamp routes through syncStore.
      await waitFor(() =>
        expect(syncSet).toHaveBeenCalledWith(LS_KEYS.lastSeenVersion, APP_VERSION),
      );
      // READ (176 + 192): the version probe reads from syncStore.
      expect(syncGet).toHaveBeenCalledWith(LS_KEYS.lastSeenVersion, '');
      // localStore must NOT carry lastSeenVersion in either direction.
      expect(localSet).not.toHaveBeenCalledWith(LS_KEYS.lastSeenVersion, expect.anything());
      expect(localGet).not.toHaveBeenCalledWith(LS_KEYS.lastSeenVersion, expect.anything());
    } finally {
      syncSet.mockRestore();
      syncGet.mockRestore();
      localSet.mockRestore();
      localGet.mockRestore();
    }
  });
});

describe('AppRoot — pledge latch + dismiss persistence (adversarial review #1 + #2)', () => {
  // #2: the pledge latch (pledgeModalSeen) must be stamped at OPEN, not only on
  // dismiss (legacy app.jsx:334 sets it right after opening). Otherwise a reload while
  // the pledge is open (no dismiss) re-shows it next boot. pledgeModalSeen stays on
  // localStore (legacy window.localStorage, NOT sync — not in contract §7.2). #1: the
  // dismiss handler's lastSeenVersion write goes to syncStore; pledgeModalSeen to
  // localStore (the split).
  const behind = JSON.stringify('0.0.1');

  // Discriminating (#2): legacy latches pledgeModalSeen at OPEN (app.jsx:334), so a
  // reload while the pledge is open — without dismissing — must not re-show it. This
  // asserts the localStore stamp happens on open with NO dismiss interaction.
  // Reverting to the bare `openModal('pledge')` (no stamp) makes this fail.
  it('stamps pledgeModalSeen (localStore) the moment the pledge OPENS', async () => {
    const localSet = vi.spyOn(localStore, 'set');
    const syncSet = vi.spyOn(syncStore, 'set');
    try {
      window.localStorage.setItem(LS_KEYS.onboarded, JSON.stringify(true));
      window.localStorage.setItem(LS_KEYS.lastSeenVersion, behind);
      window.localStorage.removeItem(LS_KEYS.pledgeModalSeen);
      render(<AppRoot />);
      // Pledge opens (lastSeenVersion behind).
      expect(await screen.findByTestId('pledge-modal')).toBeInTheDocument();
      // Latched on open via localStore — WITHOUT any dismiss interaction.
      await waitFor(() =>
        expect(localSet).toHaveBeenCalledWith(LS_KEYS.pledgeModalSeen, true),
      );
      // The latch is NOT swept into syncStore (legacy keeps it in window.localStorage).
      expect(syncSet).not.toHaveBeenCalledWith(LS_KEYS.pledgeModalSeen, expect.anything());
    } finally {
      localSet.mockRestore();
      syncSet.mockRestore();
    }
  });

  it('on dismiss: pledgeModalSeen→localStore, lastSeenVersion→syncStore (the split)', async () => {
    const localSet = vi.spyOn(localStore, 'set');
    const syncSet = vi.spyOn(syncStore, 'set');
    try {
      window.localStorage.setItem(LS_KEYS.onboarded, JSON.stringify(true));
      window.localStorage.setItem(LS_KEYS.lastSeenVersion, behind);
      window.localStorage.removeItem(LS_KEYS.pledgeModalSeen);
      render(<AppRoot />);
      const dismiss = await screen.findByTestId('pledge-dismiss');
      localSet.mockClear();
      syncSet.mockClear();
      await act(async () => { await userEvent.click(dismiss); });
      // Dismiss advances lastSeenVersion via syncStore (#1) ...
      await waitFor(() =>
        expect(syncSet).toHaveBeenCalledWith(LS_KEYS.lastSeenVersion, APP_VERSION),
      );
      // ... and keeps the latch on localStore (#2 split).
      expect(localSet).toHaveBeenCalledWith(LS_KEYS.pledgeModalSeen, true);
      // lastSeenVersion is never written through localStore.
      expect(localSet).not.toHaveBeenCalledWith(LS_KEYS.lastSeenVersion, expect.anything());
    } finally {
      localSet.mockRestore();
      syncSet.mockRestore();
    }
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

// ───────────────────────────────────────────────────────────────────────────
// Analytics-envelope parity (adversarial review #3 + #4 — REQ-ANL-1).
//
// Legacy emitted each event with a SPECIFIC {category, label} envelope; the legacy
// Mixpanel backend forwards `category` as a real property (contract §5.5), and saved
// reports/funnels filter by it. Re-implementing an event with a different category/
// label silently routes it to a different segment, so the existing report goes to
// zero after cutover. These tests pin the exact envelope per legacy ground truth.
// Each finds the LAST cloudTrackEvent call for the named event and asserts its
// {category,label}. Reverting any category/label fix in AppRoot.tsx → fails.
// ───────────────────────────────────────────────────────────────────────────
describe('AppRoot — analytics envelope parity (REQ-ANL-1, adversarial review)', () => {
  const signedInUser = { uid: 'u1', email: 'u1@test.com', displayName: 'U', photoURL: null };

  // The payload POSTed to /track is {event, userId, ...props}. Return the props of
  // the most-recent call for `event`, or undefined if it never fired.
  function lastEnvelope(event: string): Record<string, unknown> | undefined {
    const calls = trackMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((p) => p && p.event === event);
    return calls.at(-1);
  }

  it("'Free Limit' (over-cap save) uses legacy category '3 diagrams limit' + label 'Save'", async () => {
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']); // over free cap
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({ user: signedInUser, authReady: true, online: true });
    });
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await act(async () => {
      await userEvent.click(screen.getByTestId('header-menu'));
      await userEvent.click(await screen.findByTestId('header-save'));
    });
    await waitFor(() => expect(screen.queryByTestId('limit-notice')).toBeInTheDocument());
    const env = lastEnvelope('Free Limit');
    expect(env).toBeDefined();
    // Legacy app.jsx:496-500 — the exact envelope the save-path funnel filters on.
    expect(env!.category).toBe('3 diagrams limit');
    expect(env!.label).toBe('Save');
    // And it must NOT carry the divergent 'storage' category the bug emitted.
    expect(env!.category).not.toBe('storage');
  });

  it("custom-CSS gate emits NO 'Free Limit' event (no legacy analog)", async () => {
    // Signed-out user editing CSS → login modal opens, but NO analytics event:
    // legacy has no event on the custom-CSS gate, so inventing 'Free Limit' here
    // pollutes the storage-cap segment. Reverting the fix re-adds the call → fails.
    render(<AppRoot />); // signed-out by default
    await screen.findByTestId('header-title');
    await expandCss();
    const cmContent = screen.getByTestId('css-editor').querySelector('.cm-content') as HTMLElement;
    await act(async () => {
      await userEvent.click(cmContent);
      await userEvent.keyboard('x');
    });
    expect(lastEnvelope('Free Limit')).toBeUndefined();
  });

  it("'shareLink' uses legacy category 'ui'", async () => {
    const { useEditorStore: store } = await import('../state/editorStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Share is enabled only when the current item is in the items list (cloud
    // membership). Drive subscribeAllItems to emit the current item so the gate opens.
    const current = store.getState().currentItem!;
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => { cb([current]); return () => {}; });
    await act(async () => {
      useAuthStore.setState({ user: signedInUser, authReady: true, online: true });
    });
    const shareBtn = await screen.findByTestId('share-button');
    await waitFor(() => expect(shareBtn).not.toBeDisabled());
    // share-button is the Popover TRIGGER; the onShare action lives in the popover
    // body (share-create). Open the popover (portal), then click Create.
    await act(async () => { await userEvent.click(shareBtn); });
    const createBtn = await screen.findByTestId('share-create');
    await act(async () => { await userEvent.click(createBtn); });
    const env = lastEnvelope('shareLink');
    expect(env).toBeDefined();
    expect(env!.category).toBe('ui'); // legacy app.jsx:1041 trackEvent('ui','shareLink')
    expect(env!.category).not.toBe('share');
  });

  it("'exportItems' uses legacy category 'fn'", async () => {
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    useUiStore.getState().setActivePanel('library');
    const exportBtn = await screen.findByTestId('lib-export-all');
    await act(async () => { await userEvent.click(exportBtn); });
    const env = lastEnvelope('exportItems');
    expect(env).toBeDefined();
    expect(env!.category).toBe('fn'); // legacy app.jsx:1211 trackEvent('fn','exportItems')
    expect(env!.category).not.toBe('library');
  });

  it("'itemsImported' uses legacy category 'fn' + count label", async () => {
    // parseImportJson is module-mocked to throw; override it to succeed for this case
    // so handleImport reaches the itemsImported track call.
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([
      { id: 'i1' } as never,
      { id: 'i2' } as never,
    ]);
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    useUiStore.getState().setActivePanel('library');
    await screen.findByTestId('library-panel');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'ok.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    const env = await waitFor(() => {
      const e = lastEnvelope('itemsImported');
      expect(e).toBeDefined();
      return e!;
    });
    expect(env.category).toBe('fn'); // legacy app.jsx:1300 trackEvent('fn','itemsImported',count)
    expect(env.category).not.toBe('library');
    expect(env.label).toBe('2'); // legacy sends the imported count as the label
  });

  // DISCRIMINATING (adversarial review, finding 4): the label must be the NEWLY-ADDED
  // count (parsed minus already-existing ids), NOT the full parsed count. With one of
  // two parsed ids already in the list, legacy app.jsx:1280 sends mergedItemCount=1.
  // The bug sent String(parsed.length)=2. Reverting to parsed.length → label '2' → fails.
  it("'itemsImported' label is the newly-added count, not the total parsed count", async () => {
    const { parseImportJson } = await import('../services/exportImport');
    const { useUiStore } = await import('../state/uiStore');
    // Seed the items list with an item whose id overlaps one of the parsed ids.
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => {
      cb([{ id: 'existing-1', title: 'E', updatedOn: 1, pages: [] }]);
      return () => {};
    });
    vi.mocked(parseImportJson).mockReturnValueOnce([
      { id: 'existing-1' } as never, // already owned → not newly added
      { id: 'brand-new' } as never,  // newly added
    ]);
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null },
        authReady: true, online: true,
      });
    });
    // Wait for the seeded item to populate the live list.
    useUiStore.getState().setActivePanel('library');
    await screen.findByTestId('library-panel');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'ok.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    const env = await waitFor(() => {
      const e = lastEnvelope('itemsImported');
      expect(e).toBeDefined();
      return e!;
    });
    expect(env.label).toBe('1'); // 2 parsed − 1 already existing = 1 newly added
  });

  // DISCRIMINATING (adversarial review, finding 4): legacy fires the event ONLY when
  // mergedItemCount > 0 (app.jsx:1294). An import where every parsed id already exists
  // adds nothing new → NO itemsImported event. The bug fired unconditionally. Reverting
  // to an unconditional track makes an event appear here → fails.
  it("'itemsImported' is NOT fired when the import adds no new items", async () => {
    const { parseImportJson } = await import('../services/exportImport');
    const { useUiStore } = await import('../state/uiStore');
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => {
      cb([{ id: 'dup-1', title: 'D', updatedOn: 1, pages: [] }]);
      return () => {};
    });
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'dup-1' } as never]); // all duplicates
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null },
        authReady: true, online: true,
      });
    });
    useUiStore.getState().setActivePanel('library');
    await screen.findByTestId('library-panel');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'ok.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    // saveItems still runs (the write happens), but no new items → no analytics event.
    await waitFor(() => expect(itemSvc.saveItems).toHaveBeenCalled());
    expect(lastEnvelope('itemsImported')).toBeUndefined();
  });

  it("'loggedIn' uses legacy category 'fn' + provider label", async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Open the login menu/affordance and click a provider. The header exposes login
    // controls; drive the documented onLogin path via the Google sign-in button.
    const loginBtn = await screen.findByTestId('header-login');
    await act(async () => { await userEvent.click(loginBtn); });
    const googleBtn = await screen.findByTestId('login-google');
    await act(async () => { await userEvent.click(googleBtn); });
    const env = lastEnvelope('loggedIn');
    expect(env).toBeDefined();
    expect(env!.category).toBe('fn'); // legacy auth.js:26 trackEvent('fn','loggedIn',provider)
    expect(env!.category).not.toBe('auth');
  });

  it("'updatePref-*' uses legacy category 'ui' + value label", async () => {
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    useUiStore.getState().openModal('settings');
    // Wait for the Settings dialog (portal) to be present before interacting.
    await screen.findByTestId('settings-modal');
    // Toggle the lineWrap boolean switch (role=switch button) — a reliable control
    // that fires handleSettingChange → track('updatePref-lineWrap', ...). (We use the
    // switch rather than a Radix Select to avoid the Select-in-Dialog jsdom flake;
    // handleSettingChange is the SAME code path for every setting, so the envelope it
    // emits is identical regardless of which control triggers it.)
    await act(async () => { await userEvent.click(screen.getByTestId('setting-lineWrap')); });
    const env = trackMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((p) => p && typeof p.event === 'string' && (p.event as string).startsWith('updatePref-'))
      .at(-1);
    expect(env).toBeDefined();
    expect(env!.event).toBe('updatePref-lineWrap');
    expect(env!.category).toBe('ui'); // legacy app.jsx:989 trackEvent('ui','updatePref-'+name,value)
    expect(env!.category).not.toBe('settings');
    // Legacy passes the new VALUE as the label (prefs[settingName]); lineWrap
    // defaults to true, so toggling it sends false.
    expect(env!.label).toBe('false');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// M05 — embed mode (RM-2 / REQ-EMB-1).
//
// DISCRIMINATING-TESTID CONTRACT (verified against the code): AppHeader exposes
// `header-title`/`header-menu`/`header-savestate` and Sidebar exposes `sidebar-editor`/
// `sidebar-library` — these are PRESENT in normal mode (the CONTROL test pins them),
// so their ABSENCE in embed is a genuine revert→fail signal (there is no `app-header`
// / bare `sidebar` id that would pass vacuously). The URL is driven via
// history.replaceState (NOT location.search =, which triggers jsdom navigation), and
// the top-level afterEach restores it to '/'.
// ───────────────────────────────────────────────────────────────────────────
describe('AppRoot — embed mode (RM-2 / REQ-EMB-1)', () => {
  it('CONTROL: normal (non-embed) mode renders the real header + a sidebar panel', async () => {
    // Hub (PRs #800/#801): bare '/' is now the HomeView library, so "normal
    // (non-embed) mode" — this control's subject — lives at an editor URL.
    window.history.replaceState({}, '', '/?id=t-boot');
    render(<AppRoot />);
    expect(await screen.findByTestId('header-title')).toBeInTheDocument();
    expect(screen.getByTestId('header-menu')).toBeInTheDocument();
    // At least one sidebar-<panel> node renders in normal mode.
    expect(screen.getAllByTestId(/^sidebar-/).length).toBeGreaterThan(0);
    // The embed shell is NOT present in normal mode.
    expect(screen.queryByTestId('embed-header')).toBeNull();
  });

  it('?embed hides the real header + sidebar and shows the embed header', async () => {
    window.history.replaceState({}, '', '/?embed&code=A.b&title=Demo');
    render(<AppRoot />);
    // Embed shell present.
    expect(await screen.findByTestId('embed-header')).toBeInTheDocument();
    // DISCRIMINATING absence (these ids EXIST in normal mode per the control above):
    expect(screen.queryByTestId('header-title')).toBeNull();
    expect(screen.queryByTestId('header-menu')).toBeNull();
    expect(screen.queryAllByTestId(/^sidebar-/)).toHaveLength(0);
    // No save/auth controls in embed.
    expect(screen.queryByTestId('header-savestate')).toBeNull();
    expect(screen.queryByTestId('header-login')).toBeNull();
    // The open-in-app link points at the canonical app origin.
    const link = screen.getByTestId('embed-open-link');
    expect(link.getAttribute('href') ?? '').toMatch(/^https:\/\/app\.zenuml\.com\//);
  });

  it('?embed&code= renders by value without a Firestore read', async () => {
    window.history.replaceState({}, '', '/?embed&code=A.method()&title=Demo');
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    // No id/share-token in the URL → getItem/getSharedItem must NOT be called for a
    // by-value embed. (itemService.getItem is the Firestore read seam.)
    expect(itemSvc.getItem).not.toHaveBeenCalled();
    // The seeded item carries the inline DSL.
    await waitFor(() =>
      expect(useEditorStore.getState().currentItem?.js).toBe('A.method()'),
    );
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
    // The open link reproduces the diagram by value at the canonical origin.
    const href = screen.getByTestId('embed-open-link').getAttribute('href') ?? '';
    expect(href).toContain('code=A.method');
    expect(href).toContain('title=Demo');
  });

  it('?embed&code=<legacy JSON item> renders the item.js (backward compat, finding 3)', async () => {
    // Legacy ZenUML minted embed links as ?code=${JSON.stringify(currentItem)}.
    // After cutover those in-the-wild links must still render the diagram, not the
    // raw JSON blob. Reverting the parseEmbedCode call → js becomes the JSON string.
    const legacy = encodeURIComponent(JSON.stringify({ id: 'old', js: 'Alice.greet()', title: 'Legacy' }));
    window.history.replaceState({}, '', `/?embed&code=${legacy}`);
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    await waitFor(() =>
      expect(useEditorStore.getState().currentItem?.js).toBe('Alice.greet()'),
    );
    expect(useEditorStore.getState().currentItem?.title).toBe('Legacy');
  });

  it('?embed&code=<legacy scss item> seeds the real cssMode so the preview transpiles (finding 1)', async () => {
    // Legacy embed links carried the full item, including a pre-processor cssMode.
    // Hardcoding cssMode:'css' in the seed rendered scss/less source verbatim.
    // DISCRIMINATING: revert AppRoot's seed back to `cssMode:'css'` → currentItem.cssMode
    // becomes 'css' → this assertion fails. The seed is the bug site, so the assertion
    // targets the seeded item (not just parseEmbedCode).
    const legacy = encodeURIComponent(
      JSON.stringify({ js: 'A.b()', css: '$c: red;\n.x { color: $c; }', cssMode: 'scss', title: 'Styled' }),
    );
    window.history.replaceState({}, '', `/?embed&code=${legacy}`);
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    await waitFor(() =>
      expect(useEditorStore.getState().currentItem?.cssMode).toBe('scss'),
    );
    // The preview branch (item.cssMode === 'css' ? item.css : transpiledCss) now takes
    // the transpiled path because the mode is no longer forced to 'css'.
    expect(useEditorStore.getState().currentItem?.css).toContain('$c');
  });

  it('?embed applies the inline title to the embed header', async () => {
    window.history.replaceState({}, '', '/?embed&code=A.b&title=My%20Flow');
    render(<AppRoot />);
    expect(await screen.findByTestId('embed-title')).toHaveTextContent('My Flow');
  });

  it('?embed disables global keyboard shortcuts (no modal opens)', async () => {
    window.history.replaceState({}, '', '/?embed&code=A.b');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', ctrlKey: true, shiftKey: true }));
    });
    // Store-state check (discriminating): embed registers no listener, so activeModal
    // stays null. (A DOM-absence check alone would pass vacuously — embed renders no
    // modal components.) Reverting the `if (isEmbed) return` gate → activeModal='shortcuts'.
    expect(useUiStore.getState().activeModal).toBeNull();
    expect(screen.queryByTestId('shortcuts-modal')).toBeNull();
  });

  it('?embed does NOT open the onboarding/pledge one-time modals', async () => {
    // A genuine first-run user (neither flag set) would normally trigger onboarding —
    // embed must suppress it.
    window.localStorage.removeItem(LS_KEYS.onboarded);
    window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
    window.history.replaceState({}, '', '/?embed&code=A.b');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    await waitFor(() => expect(screen.getByTestId('embed-header')).toBeInTheDocument());
    expect(useUiStore.getState().activeModal).toBeNull();
    expect(screen.queryByTestId('onboarding-modal')).toBeNull();
  });

  it('?embed&id=&share-token= composes embed + shared read-only (no by-value seed)', async () => {
    // Shared embed: getSharedItem returns a read-only item, rendered inside the embed
    // shell. The default cloudFunctions mock throws 'not found' → use a per-test resolve.
    const { getSharedItem } = await import('../services/cloudFunctions');
    vi.mocked(getSharedItem).mockResolvedValueOnce({
      id: 'shared-1', title: 'Shared Diagram', js: 'S.a', css: '', html: '', isReadOnly: true,
    } as never);
    window.history.replaceState({}, '', '/?embed&id=shared-1&share-token=tok');
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    await act(async () => {
      useAuthStore.setState({ user: null, authReady: true, online: true });
    });
    // Shared item loads read-only inside the embed shell; no save/auth UI.
    await waitFor(() =>
      expect(useEditorStore.getState().currentItem?.id).toBe('shared-1'),
    );
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
    expect(screen.queryByTestId('header-savestate')).toBeNull();
    // The open link carries id + share-token (reproduces the shared diagram).
    const href = screen.getByTestId('embed-open-link').getAttribute('href') ?? '';
    expect(href).toContain('id=shared-1');
    expect(href).toContain('share-token=tok');
  });

  it('?embed with a dead share-link (item null) shows an on-paper empty state, not blank', async () => {
    // A bad ?id (or ?code that fails to resolve) leaves currentItem null. The embed
    // branch renders BEFORE the `if (!item)` guard, so without this state the user
    // sees blank cream. The default cloudFunctions mock rejects getSharedItem, so an
    // ?id embed with no per-test resolve never seeds an item.
    // DISCRIMINATING: reverting the embed-branch `: <empty state>` back to `: null`
    // → `embed-empty` is never rendered → findByTestId rejects → this test fails.
    window.history.replaceState({}, '', '/?embed&id=does-not-exist&share-token=bad');
    render(<AppRoot />);
    // The embed shell (header) still renders — only the diagram body is replaced.
    await screen.findByTestId('embed-header');
    // currentItem stays null on the rejected shared read.
    await waitFor(() =>
      expect(useEditorStore.getState().currentItem).toBeNull(),
    );
    expect(await screen.findByTestId('embed-empty')).toBeInTheDocument();
  });
});
