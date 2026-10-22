import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoot } from './AppRoot';
import { useAuthStore } from '../state/authStore';
import { useEditorStore } from '../state/editorStore';
import { useImportFeedbackStore } from '../components/library/importFeedbackStore';
import { useExportFeedbackStore } from '../components/library/exportFeedbackStore';

vi.mock('@zenuml/core/dist/zenuml?url', () => ({ default: '/zenuml-test-url.js' }));

// The dialog's own tests verify that its callback fires only after the browser
// download handoff succeeds. Here a tiny seam proves AppRoot wires that callback
// to the legacy-compatible analytics event.
vi.mock('../components/preview/ExportDialog', () => ({
  ExportDialog: ({ open, onExported }: { open: boolean; onExported?: (format: 'png' | 'svg') => void }) => open ? (
    <div>
      <button data-testid="test-export-png" onClick={() => onExported?.('png')}>PNG downloaded</button>
      <button data-testid="test-export-svg" onClick={() => onExported?.('svg')}>SVG downloaded</button>
    </div>
  ) : null,
}));

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
      view: p.get('view') ?? undefined,
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
  setItem: vi.fn(async (_id: string, _item: unknown, _opts?: { skipCloud?: boolean }): Promise<{status:'local'|'cloud'|'queued'} | undefined> => undefined),
  // Most editor tests boot through ?id=t-boot. Return a stable owned document for
  // that route; individual missing-document tests override this seam to reject.
  getItem: vi.fn(async (id: string) => ({
    id,
    title: 'Test diagram',
    js: 'A->B: test',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
    pages: [],
    currentPageId: '',
  })),
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
  // Import feedback is a module-level store: never let one test's pending import
  // swallow a later test's upload.
  useImportFeedbackStore.getState().reset();
  useExportFeedbackStore.getState().reset();
  // Hub view gating (PRs #800/#801): '/' with no ?id= now renders the HomeView
  // library grid, NOT the editor. Most tests assert editor internals, so default
  // them onto a stable owned editor URL. Home-view- and embed-specific tests
  // override the URL before render() (the file's existing convention).
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
  // The upgrade pledge may open on boot/auth-ready when a stored version is behind.
  // Seed the current version here; dedicated trigger tests set their own baselines.
  window.localStorage.clear();
  window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION));
  // Reset M04 spies + restore default subscription (free / resolved).
  itemSvc.setItem.mockReset().mockResolvedValue(undefined);
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

  it('keeps the Hi-Fi shell boundaries and visible desktop resize affordance wired', async () => {
    render(<AppRoot />);
    expect(await screen.findByTestId('editor-shell')).toHaveClass('editor-hifi-shell');
    expect(screen.getByTestId('editor-region').querySelector('.editor-source-pane')).toBeTruthy();
    expect(screen.getByTestId('preview-region').querySelector('.editor-preview-panel')).toBeTruthy();
    expect(screen.getByRole('separator', { name: 'Resize editor and preview' })).toHaveAttribute('aria-orientation', 'vertical');
  });

  it("bare '/' lands in the editor, not the hub", async () => {
    window.history.replaceState({}, '', '/');
    render(<AppRoot />);
    expect(await screen.findByTestId('editor-region')).toBeInTheDocument();
    expect(screen.queryByTestId('home-view')).toBeNull();
  });

  it("'?view=diagrams' renders the hub", async () => {
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    expect(await screen.findByTestId('home-view')).toBeInTheDocument();
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
    // The diagram DSL is rendered by @zenuml/core with no JS transpile step, so the
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
    await userEvent.keyboard('{Escape}');
    expect(useUiStore.getState().fullscreen).toBe(false);
  });

  it('exits Present on its iframe Escape message and ignores repeats after exit', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('header-present');
    const { useUiStore } = await import('../state/uiStore');
    const iframe = container.querySelector('iframe')!;
    const editor = screen.getByTestId('editor-region');
    await userEvent.click(screen.getByTestId('header-present'));
    const escape = () => act(() => window.dispatchEvent(new MessageEvent('message', {
      source: iframe.contentWindow, data: { type: 'escape' },
    })));
    expect(useUiStore.getState().fullscreen).toBe(true);
    escape();
    expect(useUiStore.getState().fullscreen).toBe(false);
    escape();
    expect(useUiStore.getState().fullscreen).toBe(false);
    expect(container.querySelector('iframe')).toBe(iframe);
    expect(screen.getByTestId('editor-region')).toBe(editor);
  });

  it('renders document controls in the app header, not inside the preview card', async () => {
    const { container } = render(<AppRoot />);
    await screen.findByTestId('header-title');
    const header = container.querySelector('header')!;
    expect(header.querySelector('[data-testid="header-title"]')).toBeTruthy();
    expect(header.querySelector('[data-testid="header-fork"]')).toBeTruthy();
    expect(header.querySelector('[data-testid="header-present"]')).toBeTruthy();
    expect(screen.queryByTestId('editor-document-chrome-slot')).toBeNull();
    expect(container.querySelectorAll('[data-testid="header-title"]')).toHaveLength(1);
    // Present lives only in the header (no duplicate renderer Present).
    expect(screen.queryByTestId('renderer-present')).toBeNull();
  });

  it('appearance toggle applies immediately and persists via the settings path', async () => {
    const syncSet = vi.spyOn(syncStore, 'set');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await userEvent.click(screen.getByTestId('header-appearance'));
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe('dark'));
    expect(syncSet).toHaveBeenCalledWith('appearance', 'dark');
    await userEvent.click(screen.getByTestId('header-appearance'));
    await waitFor(() => expect(document.documentElement.dataset.appearance).toBe('light'));
    expect(syncSet).toHaveBeenCalledWith('appearance', 'light');
    syncSet.mockRestore();
  });

  it('sidebar toggle hides and restores the code pane', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    const region = screen.getByTestId('editor-region');
    expect(region).not.toHaveAttribute('hidden');
    await userEvent.click(screen.getByTestId('header-toggle-editor'));
    expect(screen.getByTestId('editor-region')).toHaveAttribute('hidden');
    expect(screen.getByTestId('header-toggle-editor')).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByTestId('header-toggle-editor'));
    expect(screen.getByTestId('editor-region')).not.toHaveAttribute('hidden');
  });

  it('renders Report a bug inline in the code column, beside Custom CSS', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    const bug = screen.getByTestId('report-bug-fab');
    expect(screen.getByTestId('editor-region')).toContainElement(bug);
    expect(bug.closest('.editor-css-panel-strip')).toBeTruthy();
  });

  it('renders the AppHeader with title input + save-state indicator', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // The passive save-state indicator + the New toolbar button are the header's
    // persistent affordances; the logo no longer opens an app menu.
    expect(screen.getByTestId('header-savestate')).toBeInTheDocument();
    expect(screen.getByTestId('header-new')).toBeInTheDocument();
    expect(screen.queryByTestId('header-menu')).toBeNull();
  });

  // Toolbar New opens a BLANK diagram (same as the hub's New diagram): a new id in
  // the URL, empty DSL, and the previous document left untouched.
  it('header New opens a blank Untitled diagram with its own id in the URL', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    const before = useEditorStore.getState().currentItem!;
    expect(before.js).not.toBe('');
    await userEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(before.id));
    const fresh = useEditorStore.getState().currentItem!;
    expect(fresh.js).toBe('');
    expect(fresh.css).toBe('');
    expect(fresh.title).toBe('Untitled');
    expect(fresh.isReadOnly).toBeFalsy();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('id')).toBe(fresh.id));
  });

  // A brand-new document exists only in memory until it is saved. Creating it must
  // persist it right away (no edit, no 15s wait), or closing the tab loses it.
  it('header New saves the new blank diagram immediately, without an edit', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    const before = useEditorStore.getState().currentItem!;
    itemSvc.setItem.mockClear();
    await userEvent.click(screen.getByTestId('header-new'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).not.toBe(before.id));
    const fresh = useEditorStore.getState().currentItem!;
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledWith(fresh.id, expect.objectContaining({ id: fresh.id }), expect.anything()));
    await waitFor(() => expect(useEditorStore.getState().dirty).toBe(false));
  });

  it('creating a diagram from a hub template saves it immediately, without an edit', async () => {
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await userEvent.click(await screen.findByTestId('home-template-blue'));
    await waitFor(() => expect(useEditorStore.getState().currentItem?.js).not.toBe(''));
    const created = useEditorStore.getState().currentItem!;
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledWith(created.id, expect.objectContaining({ id: created.id }), expect.anything()));
  });

  // The new diagram is not the shared/seeded one: New must drop ?share-token=,
  // ?code= and ?title=, or a reload would look the new id up as a share or
  // re-seed the old code.
  it('header New drops share-token / code / title from the URL', async () => {
    window.history.replaceState({}, '', '/?code=A.b()&title=Seeded');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await userEvent.click(screen.getByTestId('header-new'));
    const confirm = screen.queryByTestId('confirm-ok');
    if (confirm) await userEvent.click(confirm);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('id')).toBe(useEditorStore.getState().currentItem?.id));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('code')).toBeNull();
    expect(params.get('title')).toBeNull();
    expect(params.get('share-token')).toBeNull();
  });

  // A metadata-only edit (rename) is dirty with unsavedCount 0. New must still ask
  // before discarding it, like the save indicator reports "Unsaved".
  it('header New asks before discarding a dirty rename; Keep editing keeps the document', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    act(() => { useEditorStore.getState().setTitle('Renamed'); });
    const before = useEditorStore.getState().currentItem!;
    expect(useEditorStore.getState().unsavedCount).toBe(0);
    await userEvent.click(screen.getByTestId('header-new'));
    await userEvent.click(await screen.findByTestId('confirm-cancel'));
    expect(useEditorStore.getState().currentItem?.id).toBe(before.id);
    expect(useEditorStore.getState().currentItem?.title).toBe('Renamed');
  });

  // Help moved from the logo menu to the code-column footer, between Custom CSS
  // and Report a bug, and opens the existing Help dialog.
  it('footer Help sits between Custom CSS and Report a bug and opens Help', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    const help = screen.getByTestId('footer-help');
    const footer = help.closest('.editor-css-panel-strip')!;
    expect(footer).toBeTruthy();
    const order = Array.from(footer.querySelectorAll('button')).map((b) => b.getAttribute('data-testid'));
    expect(order).toEqual(['css-panel-strip', 'footer-help', 'report-bug-fab']);
    expect(help).toHaveAccessibleName('Help');
    await userEvent.click(help);
    expect(await screen.findByTestId('help-modal')).toBeInTheDocument();
  });

  // ⌘S is the manual-save accelerator (auto-save covers the rest). It must
  // actually save, not fall through to the browser.
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

  // P5: after a successful sign-in the login dialog must dismiss itself — otherwise the
  // user is stranded staring at the sign-in sheet even though they're already in.
  it('closes the login modal once the user becomes authenticated', async () => {
    render(<AppRoot />); // signed-out by default
    await screen.findByTestId('header-title');
    await act(async () => { await userEvent.click(screen.getByTestId('share-button')); });
    expect(await screen.findByTestId('login-google')).toBeInTheDocument();
    // Simulate the OAuth round-trip completing: the auth store gets a user.
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e@x.com', displayName: 'U', photoURL: null },
        authReady: true,
        online: true,
      });
    });
    await waitFor(() => expect(screen.queryByTestId('login-google')).not.toBeInTheDocument());
  });

  it('renders the import/export actions on the Home view', async () => {
    // Hub (PRs #800/#801) retired the LibraryPanel side panel — the library IS the
    // Home view now ('/', no ?id=). The bulk import/export controls were re-homed
    // from the retired panel into HomeView's ALWAYS-present header row (HomeView.tsx
    // — not auth/readOnly-gated, so an empty or signed-out library can still import).
    // Route to '/?view=diagrams' via the file's existing history.replaceState URL
    // pattern instead of the retired setActivePanel('library').
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    expect(await screen.findByTestId('home-view')).toBeInTheDocument();
    expect(screen.getByTestId('lib-export-all')).toBeInTheDocument();
    expect(screen.getByTestId('lib-import')).toBeInTheDocument();
    expect(screen.getByTestId('lib-import-input')).toBeInTheDocument();
  });

  it('surfaces actionable import feedback (not the raw parser error) for a malformed file', async () => {
    // A malformed file must surface feedback instead of a swallowed rejection
    // (advisor fix #6), and that feedback is the nonmodal import panel with the real
    // filename and actionable copy — not a modal echoing the parser's raw message.
    // Import lives on the Home view (PRs #800/#801), so assert it there.
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');

    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    await userEvent.upload(input, file);

    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByRole('heading', { name: 'This file can’t be imported' })).toBeInTheDocument();
    expect(panel).toHaveTextContent('broken.json');
    expect(panel).toHaveTextContent('Choose a ZenUML JSON export file.');
    expect(screen.queryByText('Bad JSON at line 1')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Import failed' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("fires 'first_edit' once on the first DSL change", async () => {
    // Mechanism: drive the real CodeMirror DSL editor (dsl-editor) via
    // userEvent.click + userEvent.keyboard — the same pattern used by the CSS-gate
    // tests (lines ~521-529). This exercises AppRoot's handleDslChange wrapper
    // (onChange prop of the DSL CodeEditor), not a direct store call, so first_edit
    // genuinely fires from the wrapper. Non-vacuity guard: assert the store's js
    // changed (proves the keystroke reached onChange). Two letters prove once-only.
    window.history.replaceState({}, '', '/?id=t-boot');
    render(<AppRoot />);
    await screen.findByTestId('editor-region');
    const before = useEditorStore.getState().currentItem?.js;
    const cm = screen.getByTestId('dsl-editor').querySelector('.cm-content') as HTMLElement;
    await act(async () => {
      await userEvent.click(cm);
      await userEvent.keyboard('xy');
    });
    // Non-vacuity guard: the keystroke reached onChange → store updated.
    await waitFor(() => expect(useEditorStore.getState().currentItem?.js).not.toBe(before));
    // first_edit fires exactly once (not twice for two keystrokes).
    await waitFor(() => {
      const count = trackMock.mock.calls.filter(
        ([payload]) => (payload as { event?: string }).event === 'first_edit',
      ).length;
      expect(count).toBe(1);
    });
    // Verify category matches the spec.
    const env = trackMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((p) => p.event === 'first_edit');
    expect(env?.category).toBe('fn');
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
    // Manual save is the ⌘S accelerator (the logo app menu and its Save item are gone).
    await act(async () => {
      await userEvent.keyboard('{Meta>}s{/Meta}');
    });
  }

  // The id is already taken by a document another account created (a local copy that
  // outlived a sign-in switch). Firestore denies the update; the user's edits must be
  // saved under a fresh id they own instead of failing on every retry.
  it('permission-denied on a foreign-owned id saves the edits under a new id and opens it', async () => {
    await bootSignedIn();
    const originalId = useEditorStore.getState().currentItem!.id;
    itemSvc.setItem.mockReset()
      .mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }))
      .mockResolvedValue({ status: 'cloud' });
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(2));
    const [firstId] = itemSvc.setItem.mock.calls[0];
    const [secondId, secondItem] = itemSvc.setItem.mock.calls[1] as [string, { id: string; title: string }];
    expect(firstId).toBe(originalId);
    expect(secondId).not.toBe(originalId);
    expect(secondItem.id).toBe(secondId);
    await waitFor(() => expect(useEditorStore.getState().currentItem?.id).toBe(secondId));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('id')).toBe(secondId));
    await waitFor(() => expect(useEditorStore.getState().dirty).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('permission-denied again on the new id stops after one retry and shows the save error', async () => {
    await bootSignedIn();
    itemSvc.setItem.mockReset().mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(itemSvc.setItem).toHaveBeenCalledTimes(2);
  });

  it('a non-permission save failure does not fork the diagram', async () => {
    await bootSignedIn();
    const originalId = useEditorStore.getState().currentItem!.id;
    itemSvc.setItem.mockReset().mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));
    await clickSave();
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save');
    expect(itemSvc.setItem).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().currentItem?.id).toBe(originalId);
  });

  it('(a) free user at 4 owned saving a NEW item → cloud SKIPPED (skipCloud), no membership write, notice opens', async () => {
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']); // 4 owned, over free cap 3
    await bootSignedIn();
    // Wait for subscription to resolve to free (loading→false).
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await clickSave();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalled());
    const call = itemSvc.setItem.mock.calls.at(-1)!;
    expect(call[2]).toEqual(expect.objectContaining({ skipCloud: true }));
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
    expect(call[2]).toEqual(expect.objectContaining({ skipCloud: true }));
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

describe('AppRoot — import-on-login quota preflight', () => {
  const signedInUser = { uid: 'u1', email: 'u1@test.com', displayName: 'U', photoURL: null };

  async function bootWithLocalItem(id: string) {
    const localItems = await import('../services/localItems');
    await localItems.add(id);
    await localStore.set(id, { id, title: id, js: '', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', updatedOn: 1 });
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => { useAuthStore.setState({ user: signedInUser, authReady: true, online: true }); });
    await screen.findByRole('dialog', { name: 'Import local diagrams?' });
  }

  it('blocks the whole import over the exact free cap and preserves local copies for retry', async () => {
    itemSvc.saveItems.mockClear();
    userSvc.getUserItemIds.mockResolvedValue(['owned-a', 'owned-b', 'owned-c']);
    await bootWithLocalItem('new-local');
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/exceed your account diagram limit/);
    expect(itemSvc.saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('new-local', null)).not.toBeNull();
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(false);
  });

  it('allows an import containing only IDs already owned at the free cap', async () => {
    userSvc.getUserItemIds.mockResolvedValue(['owned-a', 'owned-b', 'owned-c']);
    await bootWithLocalItem('owned-a');
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(itemSvc.saveItems).toHaveBeenCalledWith(expect.objectContaining({ 'owned-a': expect.any(Object) }), expect.any(Object)));
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(true);
  });

  it('does not upload or mark the import complete when the cloud ownership count fails', async () => {
    itemSvc.saveItems.mockClear();
    userSvc.getUserItemIds.mockRejectedValue(new Error('permission-denied'));
    await bootWithLocalItem('local-retry');
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/couldn't check/i);
    expect(itemSvc.saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('local-retry', null)).not.toBeNull();
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(false);
  });

  it('shows a check error for a failed plan read, then retries the read and imports under the paid limit', async () => {
    itemSvc.saveItems.mockClear();
    subSvc.retrieveSubscription.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(
      { status: 'active', passthrough: '{"planType":"basic-monthly"}' } as never,
    );
    userSvc.getUserItemIds.mockResolvedValue(['owned-a', 'owned-b', 'owned-c']);
    await bootWithLocalItem('paid-local');
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/couldn't check/i);
    expect(screen.getByTestId('import-error')).not.toHaveTextContent(/remove cloud diagrams or upgrade/i);
    expect(itemSvc.saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('paid-local', null)).not.toBeNull();
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(false);

    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(itemSvc.saveItems).toHaveBeenCalledWith(
      expect.objectContaining({ 'paid-local': expect.any(Object) }), expect.any(Object),
    ));
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(true);
  });

  it('keeps the import local when a plan retry fails again', async () => {
    itemSvc.saveItems.mockClear();
    subSvc.retrieveSubscription.mockRejectedValue(new Error('offline'));
    await bootWithLocalItem('still-local');
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/couldn't check/i);
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/couldn't check/i);
    expect(itemSvc.saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('still-local', null)).not.toBeNull();
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(false);
  });

  it('does not upload to either account when identity changes during a plan retry', async () => {
    itemSvc.saveItems.mockClear();
    let resolveRetry!: (value: unknown) => void;
    const delayedRetry = new Promise((resolve) => { resolveRetry = resolve; });
    subSvc.retrieveSubscription.mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(delayedRetry as never).mockResolvedValueOnce(null);
    await bootWithLocalItem('switch-local');
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId('import-confirm'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(/couldn't check/i);
    await userEvent.click(screen.getByTestId('import-confirm'));
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledTimes(2));
    await act(async () => {
      useAuthStore.setState({ user: { ...signedInUser, uid: 'u2' }, authReady: true, online: true });
    });
    await act(async () => { resolveRetry({ status: 'active', passthrough: '{"planType":"plus-monthly"}' }); });
    expect(itemSvc.saveItems).not.toHaveBeenCalled();
    expect(await localStore.get('switch-local', null)).not.toBeNull();
    expect(await localStore.get(LS_KEYS.askedToImportCreations, false)).toBe(false);
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

  // While the plan is still loading the CSS gate used to fail OPEN, so a free user who
  // edited CSS (or picked SCSS) in the first moment after sign-in got the Plus-only
  // change applied and saved. It must wait instead: no change, and no pricing modal
  // (a Plus user mid-load must not be shown pricing either).
  it('subscription still LOADING → CSS edit is held back, no modal (mode change: cloud CSS-5)', async () => {
    subSvc.retrieveSubscription.mockReturnValue(new Promise(() => {}) as Promise<null>);
    const { useEditorStore: store } = await import('../state/editorStore');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null }, authReady: true, online: true });
    });
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    const before = store.getState().currentItem?.css ?? '';
    const beforeMode = store.getState().currentItem?.cssMode;
    await expandCss();
    const cmContent = screen.getByTestId('css-editor').querySelector('.cm-content') as HTMLElement;
    await act(async () => {
      await userEvent.click(cmContent);
      await userEvent.keyboard('q');
    });
    expect(store.getState().currentItem?.css).toBe(before);
    expect(cmContent.textContent).toBe(before);
    expect(useUiStore.getState().activeModal).not.toBe('pricing');
    expect(useUiStore.getState().loginModalOpen).toBe(false);
    expect(store.getState().currentItem?.cssMode).toBe(beforeMode);
  });

  it('held-back CSS edit → plan resolves FREE → pricing opens then; CSS still unchanged', async () => {
    let resolveSub: (s: null) => void = () => {};
    subSvc.retrieveSubscription.mockReturnValue(new Promise<null>((r) => { resolveSub = r; }));
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
      await userEvent.keyboard('q');
    });
    expect(useUiStore.getState().activeModal).not.toBe('pricing');
    await act(async () => { resolveSub(null); });
    await waitFor(() => expect(useUiStore.getState().activeModal).toBe('pricing'));
    expect(store.getState().currentItem?.css).toBe(before);
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
  it('does not interrupt a returning user whose version baseline is current', async () => {
    window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify(APP_VERSION)); // returning user
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    // Let the async boot effects settle; no first-run modal is shown.
    await waitFor(() => expect(screen.getByTestId('header-title')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the SupportPledge modal when lastSeenVersion is behind APP_VERSION', async () => {
    window.localStorage.setItem(LS_KEYS.lastSeenVersion, JSON.stringify('0.0.1'));
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await waitFor(() => expect(useUiStore.getState().activeModal).toBe('pledge'));
    expect(await screen.findByTestId('pledge-modal')).toBeInTheDocument();
  });

  it('does not interrupt a first visit and silently records the upgrade baseline', async () => {
    window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await waitFor(() =>
      expect(window.localStorage.getItem(LS_KEYS.lastSeenVersion)).toBe(JSON.stringify(APP_VERSION)),
    );
    expect(useUiStore.getState().activeModal).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // The pledge is for upgrades only. A missing version baseline must never be
  // interpreted as version 0.0.0 and open the pledge for a first-time visitor.
  it('does NOT open the pledge when lastSeenVersion is empty (first-timer, wrong audience)', async () => {
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
  // first visit / notification-click, NOT on pledge dismiss — app.jsx:329-331).
  // Legacy gates the pledge on `lastSeenVersion && semverCompare<0 && !pledgeModalSeen`.
  // The rewrite must honor pledgeModalSeen, or it re-shows the pledge once to a user
  // who already saw it (wrong audience, REQ-MOD-3). Reverting the !pledgeModalSeen gate
  // makes the pledge open here → fails.
  it('does NOT re-open the pledge for a legacy user who already dismissed it (pledgeModalSeen=true)', async () => {
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
  // an upgrading user as a first-time visitor → mis-targets the pledge (REQ-MOD-3).
  // Reads (176, 192) AND writes (177) must both route through syncStore;
  // reads-on-local + writes-on-sync is exactly the broken extension state, so this
  // test asserts BOTH directions.
  it('reads AND writes lastSeenVersion via syncStore (not localStore) on first visit', async () => {
    const syncSet = vi.spyOn(syncStore, 'set');
    const syncGet = vi.spyOn(syncStore, 'get');
    const localSet = vi.spyOn(localStore, 'set');
    const localGet = vi.spyOn(localStore, 'get');
    try {
      window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
      render(<AppRoot />);
      await screen.findByTestId('header-title');
      // First-visit baseline routes through syncStore.
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

  it('tracks successful PNG and SVG downloads with UI category and no invented content properties', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await userEvent.click(screen.getByTestId('renderer-download'));
    await userEvent.click(await screen.findByTestId('test-export-png'));
    await waitFor(() => expect(lastEnvelope('downloadPng')).toEqual(expect.objectContaining({ category: 'ui' })));
    expect(lastEnvelope('downloadPng')).not.toHaveProperty('diagramCode');

    await userEvent.click(screen.getByTestId('renderer-download'));
    await userEvent.click(await screen.findByTestId('test-export-svg'));
    await waitFor(() => expect(lastEnvelope('downloadSvg')).toEqual(expect.objectContaining({ category: 'ui' })));
    expect(lastEnvelope('downloadSvg')).not.toHaveProperty('diagramCode');
  });

  it("'Free Limit' (over-cap save) uses legacy category '3 diagrams limit' + label 'Save'", async () => {
    userSvc.getUserItemIds.mockResolvedValue(['a', 'b', 'c', 'd']); // over free cap
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({ user: signedInUser, authReady: true, online: true });
    });
    await waitFor(() => expect(subSvc.retrieveSubscription).toHaveBeenCalledWith('u1'));
    await act(async () => {
      await userEvent.keyboard('{Meta>}s{/Meta}');
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
    // Hub (PRs #800/#801): export-all moved from the retired LibraryPanel to the
    // Home view header row (HomeView.tsx) — route to '/?view=diagrams' to land there.
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
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
    // Hub (PRs #800/#801): import moved from the retired LibraryPanel to the Home
    // view header (HomeView.tsx) — route to '/?view=diagrams' to land there.
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
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
    // Hub (PRs #800/#801): import lives on the Home view now (LibraryPanel retired).
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null },
        authReady: true, online: true,
      });
    });
    // Wait for the seeded item to populate the live list (it renders as a card).
    await screen.findByTestId('home-grid');
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
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => {
      cb([{ id: 'dup-1', title: 'D', updatedOn: 1, pages: [] }]);
      return () => {};
    });
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'dup-1' } as never]); // all duplicates
    // Hub (PRs #800/#801): import lives on the Home view now (LibraryPanel retired).
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null },
        authReady: true, online: true,
      });
    });
    // Wait for the seeded duplicate item to populate the live list.
    await screen.findByTestId('home-grid');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'ok.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    // saveItems still runs (the write happens), but no new items → no analytics event.
    await waitFor(() => expect(itemSvc.saveItems).toHaveBeenCalled());
    expect(lastEnvelope('itemsImported')).toBeUndefined();
  });

  // DISCRIMINATING (review: cold-load misclassification): an import that runs before
  // the signed-in library snapshot has arrived must NOT classify existing ids against
  // the still-empty list. Before the fix, handleImport read useItems().items == [] →
  // "1 diagram added" + itemsImported label '1' for a diagram that already existed.
  it('cold load: import before the library snapshot arrives counts existing ids as updated', async () => {
    let deliver!: (items: unknown[]) => void;
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => { deliver = cb; return () => {}; });
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'existing-1' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null },
        authReady: true, online: true,
      });
    });
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'existing.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    // The library has not loaded yet: the snapshot now arrives with the existing id.
    await act(async () => { deliver([{ id: 'existing-1', title: 'E', updatedOn: 1, pages: [] }]); });
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'success'));
    expect(panel).toHaveTextContent('1 diagram updated.');
    expect(panel).not.toHaveTextContent('added');
    expect(lastEnvelope('itemsImported')).toBeUndefined();
  });

  it('Export all during cold load waits for the library and reports the real total', async () => {
    let deliver!: (items: unknown[]) => void;
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => { deliver = cb; return () => {}; });
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await act(async () => {
      useAuthStore.setState({
        user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null },
        authReady: true, online: true,
      });
    });
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    await act(async () => { await userEvent.click(screen.getByTestId('lib-export-all')); });
    expect(screen.queryByText('No diagrams to export')).toBeNull();
    await act(async () => {
      deliver([
        { id: 'c1', title: 'One', updatedOn: 1, pages: [] },
        { id: 'c2', title: 'Two', updatedOn: 2, pages: [] },
      ]);
    });
    const panel = await screen.findByTestId('export-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'started'));
    expect(panel).toHaveTextContent('zenuml-diagrams.json');
    expect(panel).toHaveTextContent('2 diagrams included.');
    expect(lastEnvelope('exportItems')).toBeDefined();
  });

  // DISCRIMINATING (review: identity cancellation). An import started under account A
  // while A's library is still loading must never be answered by, or saved into,
  // account B after a switch. Before the fix the waiter woke on B's snapshot and
  // saveItems (live auth) wrote A's file into B with "added" analytics.
  it('account switch while an import waits for the library: no save, cancelled, no analytics', async () => {
    itemSvc.saveItems.mockClear();
    const deliver: Record<string, (items: unknown[]) => void> = {};
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((uid, cb) => { deliver[uid] = cb; return () => {}; });
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'from-A-file' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'A', email: 'a', displayName: 'A', photoURL: null }, authReady: true, online: true });
    });
    await waitFor(() => expect(deliver.A).toBeTypeOf('function'));
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await act(async () => { await userEvent.upload(input, new File(['{"items":{}}'], 'a.json', { type: 'application/json' })); });
    // Switch to B before A's library arrives; B's library then loads.
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'B', email: 'b', displayName: 'B', photoURL: null }, authReady: true, online: true });
    });
    await waitFor(() => expect(deliver.B).toBeTypeOf('function'));
    await act(async () => { deliver.B([{ id: 'b-1', title: 'B1', updatedOn: 1, pages: [] }]); });
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'cancelled'));
    expect(itemSvc.saveItems).not.toHaveBeenCalled();
    expect(panel).toHaveTextContent('No diagrams were imported.');
    expect(lastEnvelope('itemsImported')).toBeUndefined();
  });

  it('import saves with the bound identity guard of the account that started it', async () => {
    itemSvc.saveItems.mockClear();
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'n1' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await act(async () => { await userEvent.upload(input, new File(['{"items":{}}'], 'ok.json', { type: 'application/json' })); });
    await waitFor(() => expect(itemSvc.saveItems).toHaveBeenCalled());
    // Signed out: the guard binds the save to the local library (expectedUid null).
    expect(vi.mocked(itemSvc.saveItems).mock.calls[0]).toEqual([
      expect.any(Object),
      { expectedUid: null, isCurrent: expect.any(Function) },
    ]);
  });

  it('Export all started under A never downloads B\'s library after a switch', async () => {
    const deliver: Record<string, (items: unknown[]) => void> = {};
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((uid, cb) => { deliver[uid] = cb; return () => {}; });
    const createUrl = vi.fn(() => 'blob:test');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createUrl as never;
    try {
      window.history.replaceState({}, '', '/?view=diagrams');
      render(<AppRoot />);
      await screen.findByTestId('home-view');
      await act(async () => {
        useAuthStore.setState({ user: { uid: 'A', email: 'a', displayName: 'A', photoURL: null }, authReady: true, online: true });
      });
      await waitFor(() => expect(deliver.A).toBeTypeOf('function'));
      await act(async () => { await userEvent.click(screen.getByTestId('lib-export-all')); });
      await act(async () => {
        useAuthStore.setState({ user: { uid: 'B', email: 'b', displayName: 'B', photoURL: null }, authReady: true, online: true });
      });
      await waitFor(() => expect(deliver.B).toBeTypeOf('function'));
      await act(async () => { deliver.B([{ id: 'b-1', title: 'B1', updatedOn: 1, pages: [] }]); });
      const panel = await screen.findByTestId('export-feedback');
      await waitFor(() => expect(panel).toHaveAttribute('data-state', 'cancelled'));
      expect(panel).toHaveTextContent('No file was downloaded.');
      expect(createUrl).not.toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  // IE-F2 (read provenance): itemService.subscribeAllItems used to turn a snapshot
  // error into cb([]), which the library read as an authoritative empty library.
  // These drive the REAL seam: the mocked service calls the onError channel.
  type Sub = (uid: string, cb: (items: unknown[]) => void, onError?: (e: unknown) => void) => () => void;
  const subscribeWith = (impl: Sub) =>
    (itemSvc.subscribeAllItems as unknown as { mockImplementation(fn: Sub): void }).mockImplementation(impl);
  const signInU1 = () => act(async () => {
    useAuthStore.setState({ user: { uid: 'u1', email: 'e', displayName: 'U', photoURL: null }, authReady: true, online: true });
  });

  it('subscription failure: importing a known existing id claims no exact counts and sends no added analytics', async () => {
    itemSvc.saveItems.mockClear();
    subscribeWith((_uid, _cb, onError) => { onError?.(new Error('permission-denied')); return () => {}; });
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'existing-1' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await signInU1();
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await act(async () => { await userEvent.upload(input, new File(['{"items":{}}'], 'existing.json', { type: 'application/json' })); });
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'success'));
    expect(panel).toHaveTextContent('1 diagram imported.');
    expect(panel).not.toHaveTextContent(/added|updated/);
    expect(lastEnvelope('itemsImported')).toBeUndefined();
  });

  it('subscription failure: Export all fails with Try again and downloads nothing; a successful retry downloads the real total', async () => {
    let calls = 0;
    subscribeWith((_uid, cb, onError) => {
      calls += 1;
      if (calls === 1) onError?.(new Error('unavailable'));
      else if (calls === 2) onError?.(new Error('still unavailable'));
      else cb([{ id: 'c1', title: 'One', updatedOn: 1, pages: [] }, { id: 'c2', title: 'Two', updatedOn: 2, pages: [] }]);
      return () => {};
    });
    const createUrl = vi.fn(() => 'blob:test');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createUrl as never;
    try {
      window.history.replaceState({}, '', '/?view=diagrams');
      render(<AppRoot />);
      await screen.findByTestId('home-view');
      await signInU1();
      await waitFor(() => expect(calls).toBe(1));
      // Not "No diagrams": the library is unknown, so Export all stays enabled.
      expect(screen.getByTestId('lib-export-all')).not.toHaveAttribute('aria-disabled', 'true');
      await act(async () => { await userEvent.click(screen.getByTestId('lib-export-all')); });
      const panel = await screen.findByTestId('export-feedback');
      await waitFor(() => expect(panel).toHaveAttribute('data-state', 'failed'));
      expect(screen.queryByText('No diagrams to export')).toBeNull();
      expect(createUrl).not.toHaveBeenCalled();
      await act(async () => { await userEvent.click(within(screen.getByTestId('export-feedback')).getByRole('button', { name: 'Try again' })); });
      await waitFor(() => expect(screen.getByTestId('export-feedback')).toHaveAttribute('data-state', 'started'));
      expect(screen.getByTestId('export-feedback')).toHaveTextContent('2 diagrams included.');
      expect(createUrl).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it('subscription failure then a successful retry: import reports truthful counts', async () => {
    let calls = 0;
    subscribeWith((_uid, cb, onError) => {
      calls += 1;
      if (calls === 1) onError?.(new Error('unavailable'));
      else cb([{ id: 'existing-1', title: 'E', updatedOn: 1, pages: [] }]);
      return () => {};
    });
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'existing-1' } as never, { id: 'new-1' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    await signInU1();
    await waitFor(() => expect(calls).toBe(1));
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await act(async () => { await userEvent.upload(input, new File(['{"items":{}}'], 'mix.json', { type: 'application/json' })); });
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'success'));
    expect(panel).toHaveTextContent('1 diagram added. 1 diagram updated.');
    await waitFor(() => expect(lastEnvelope('itemsImported')?.label).toBe('1'));
  });

  // IE-F3: a dangling index key (no stored record) is not an existing diagram.
  it('signed out: one valid record + one dangling key imports as 1 updated + 1 added', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ valid: true, dangling: true }));
    window.localStorage.setItem('valid', JSON.stringify({ id: 'valid', title: 'V', updatedOn: 1, pages: [] }));
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'valid' } as never, { id: 'dangling' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    await act(async () => { await userEvent.upload(input, new File(['{"items":{}}'], 'two.json', { type: 'application/json' })); });
    const panel = await screen.findByTestId('import-feedback');
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'success'));
    expect(panel).toHaveTextContent('1 diagram added. 1 diagram updated.');
    await waitFor(() => expect(lastEnvelope('itemsImported')?.label).toBe('1'));
  });

  // IE-C1: ownership is captured when the file is chosen, before File.text() resolves.
  it('file chosen under A, account switches to B while the file is read: nothing saved, cancelled', async () => {
    itemSvc.saveItems.mockClear();
    const deliver: Record<string, (items: unknown[]) => void> = {};
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((uid, cb) => { deliver[uid] = cb; return () => {}; });
    // No parseImportJson stub: a stale file never reaches parsing (if it did, the
    // default throwing mock would show "invalid", not "cancelled").
    let releaseText!: (t: string) => void;
    const originalText = File.prototype.text;
    File.prototype.text = function () { return new Promise<string>((r) => { releaseText = r; }); };
    try {
      window.history.replaceState({}, '', '/?view=diagrams');
      render(<AppRoot />);
      await screen.findByTestId('home-view');
      await act(async () => {
        useAuthStore.setState({ user: { uid: 'A', email: 'a', displayName: 'A', photoURL: null }, authReady: true, online: true });
      });
      await waitFor(() => expect(deliver.A).toBeTypeOf('function'));
      await act(async () => { deliver.A([]); });
      const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
      await act(async () => { await userEvent.upload(input, new File(['x'], 'a-choice.json', { type: 'application/json' })); });
      await act(async () => {
        useAuthStore.setState({ user: { uid: 'B', email: 'b', displayName: 'B', photoURL: null }, authReady: true, online: true });
      });
      await waitFor(() => expect(deliver.B).toBeTypeOf('function'));
      await act(async () => { deliver.B([]); });
      await act(async () => { releaseText('{"items":{}}'); });
      const panel = await screen.findByTestId('import-feedback');
      await waitFor(() => expect(panel).toHaveAttribute('data-state', 'cancelled'));
      expect(panel).toHaveTextContent('No diagrams were imported.');
      expect(itemSvc.saveItems).not.toHaveBeenCalled();
      expect(lastEnvelope('itemsImported')).toBeUndefined();
    } finally {
      File.prototype.text = originalText;
    }
  });

  // DISCRIMINATING: the label counts UNIQUE new ids. A file listing the same new id
  // twice adds one diagram; the pre-feedback handler counted parsed entries ('2').
  it("'itemsImported' label counts unique new ids, not duplicate entries", async () => {
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'dup' } as never, { id: 'dup' } as never]);
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'ok.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    const env = await waitFor(() => {
      const e = lastEnvelope('itemsImported');
      expect(e).toBeDefined();
      return e!;
    });
    expect(env.label).toBe('1');
  });

  it('shows import success only after saveItems resolves, with the real filename and count', async () => {
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'n1' } as never, { id: 'n2' } as never]);
    let release!: () => void;
    vi.mocked(itemSvc.saveItems).mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'team.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    await waitFor(() => expect(itemSvc.saveItems).toHaveBeenCalled());
    expect(screen.queryByTestId('import-feedback')).toBeNull();
    await act(async () => { release(); });
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'success');
    expect(panel).toHaveTextContent('team.json');
    expect(panel).toHaveTextContent('2 diagrams added.');
  });

  it('a rejected saveItems shows save-failed feedback and no itemsImported event', async () => {
    const { parseImportJson } = await import('../services/exportImport');
    vi.mocked(parseImportJson).mockReturnValueOnce([{ id: 'n1' } as never]);
    vi.mocked(itemSvc.saveItems).mockRejectedValueOnce(new Error('FirebaseError: unavailable'));
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const input = screen.getByTestId('lib-import-input') as HTMLInputElement;
    const file = new File(['{"items":{}}'], 'team.json', { type: 'application/json' });
    await act(async () => { await userEvent.upload(input, file); });
    const panel = await screen.findByTestId('import-feedback');
    expect(panel).toHaveAttribute('data-state', 'saveFailed');
    expect(panel).not.toHaveTextContent('FirebaseError');
    expect(lastEnvelope('itemsImported')).toBeUndefined();
  });

  it("fires 'landed_in_editor' with bootKind on a bare '/' editor landing", async () => {
    window.history.replaceState({}, '', '/');
    render(<AppRoot />);
    await screen.findByTestId('editor-region');
    const env = await waitFor(() => {
      const e = lastEnvelope('landed_in_editor');
      expect(e).toBeDefined();
      return e!;
    });
    // getItem is mocked to reject in this suite → boot resolves kind 'new'.
    expect(env.label).toBe('new');
    expect(env.category).toBe('navigation');
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

  it("fires 'hub_opened' with source 'landing-param' when arriving at ?view=diagrams", async () => {
    window.history.replaceState({}, '', '/?view=diagrams');
    render(<AppRoot />);
    await screen.findByTestId('home-view');
    const env = await waitFor(() => {
      const e = lastEnvelope('hub_opened');
      expect(e).toBeDefined();
      return e!;
    });
    expect(env.label).toBe('landing-param');
  });

  // DISCRIMINATING (controller review): clicking the breadcrumb to reach the hub
  // must emit EXACTLY ONE hub_opened, sourced 'breadcrumb' — NOT also 'landing-param'.
  // goHome navigates to ?view=diagrams, which flips isHomeMode true and re-runs the
  // landing-param effect on the still-mounted AppRoot. Without goHome marking the
  // landing ref consumed, BOTH events fire and the source dimension is corrupted.
  it("breadcrumb→hub fires exactly one hub_opened sourced 'breadcrumb' (no landing-param)", async () => {
    window.history.replaceState({}, '', '/'); // start in the editor (bare /)
    const { rerender } = render(<AppRoot />);
    await screen.findByTestId('editor-region');
    // Click the breadcrumb: goHome fires hub_opened{breadcrumb} and navigates to
    // ?view=diagrams (the mock applies replaceState but does NOT itself re-render).
    await act(async () => { await userEvent.click(screen.getByTestId('header-go-home')); });
    // Simulate the router's post-navigate re-render on the still-mounted AppRoot —
    // this is what flips isHomeMode true and re-runs the landing-param effect in prod.
    await act(async () => { rerender(<AppRoot />); });
    await screen.findByTestId('home-view');
    const hubEvents = trackMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((p) => p.event === 'hub_opened');
    expect(hubEvents).toHaveLength(1);
    expect(hubEvents[0].label).toBe('breadcrumb');
  });

  // DISCRIMINATING (controller review of final adversarial pass): leaving the hub and
  // returning (e.g. hub → open a diagram → browser Back to ?view=diagrams) must emit a
  // FRESH hub_opened{landing-param}. A permanently-consumed landing ref under-counts
  // hub demand — an ASYMMETRIC bias that makes editor-landing look better than it is,
  // skewing the pre/post decision. Leaving the hub must re-arm the landing event.
  it('returning to the hub after leaving re-fires hub_opened{landing-param}', async () => {
    window.history.replaceState({}, '', '/?view=diagrams'); // land on the hub
    const { rerender } = render(<AppRoot />);
    await screen.findByTestId('home-view');
    // Leave the hub: open a diagram (?id=) — isHomeMode flips false. The real hub→editor
    // path is handleOpenItem (a direct loadItem), so seed the item the same way; boot is
    // skipped on the hub and won't re-resolve on a same-mount re-render.
    window.history.replaceState({}, '', '/?id=t-boot');
    await act(async () => { useEditorStore.getState().newItem(); rerender(<AppRoot />); });
    await screen.findByTestId('editor-region');
    // Return to the hub (browser Back / re-navigation to ?view=diagrams).
    window.history.replaceState({}, '', '/?view=diagrams');
    await act(async () => { rerender(<AppRoot />); });
    await screen.findByTestId('home-view');
    const landingEvents = trackMock.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((p) => p.event === 'hub_opened' && p.label === 'landing-param');
    expect(landingEvents).toHaveLength(2); // once per hub arrival, not collapsed to one
  });
});

// ───────────────────────────────────────────────────────────────────────────
// M05 — embed mode (RM-2 / REQ-EMB-1).
//
// DISCRIMINATING-TESTID CONTRACT (verified against the code): AppHeader exposes
// `header-title`/`header-new`/`header-savestate` and Layout exposes `editor-region`
// — these are PRESENT in normal editor mode (the CONTROL test pins them), so their
// ABSENCE in embed is a genuine revert→fail signal (there is no `app-header` /
// bare `editor` id that would pass vacuously). The Sidebar icon rail this contract
// previously leaned on (`sidebar-editor`/`sidebar-library`) was deliberately removed
// app-wide by f023f89 ("feat(hub): no-rail layout…") — Sidebar.tsx is unreferenced —
// so `sidebar-*` ids no longer exist in ANY mode and cannot ground the contrast.
// The URL is driven via history.replaceState (NOT location.search =, which triggers
// jsdom navigation), and the top-level afterEach restores it to '/'.
// ───────────────────────────────────────────────────────────────────────────
describe('AppRoot — embed mode (RM-2 / REQ-EMB-1)', () => {
  it('CONTROL: normal (non-embed) mode renders the real header + the editor work surface', async () => {
    // Hub (PRs #800/#801): bare '/' is now the HomeView library, so "normal
    // (non-embed) mode" — this control's subject — lives at an editor URL.
    window.history.replaceState({}, '', '/?id=t-boot');
    render(<AppRoot />);
    expect(await screen.findByTestId('header-title')).toBeInTheDocument();
    expect(screen.getByTestId('header-new')).toBeInTheDocument();
    // f023f89 ("feat(hub): no-rail layout…") removed the Sidebar icon rail app-wide,
    // so the old `sidebar-*` presence check could only fail. The normal-vs-embed
    // chrome contrast is re-grounded on `editor-region` (Layout.tsx): the split-pane
    // editor surface renders in normal mode and the embed branch returns before
    // Layout ever mounts, so its absence under ?embed (asserted below) discriminates.
    expect(screen.getByTestId('editor-region')).toBeInTheDocument();
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
    expect(screen.queryByTestId('header-new')).toBeNull();
    // f023f89 removed the Sidebar rail app-wide, making the old `sidebar-*` absence
    // check vacuously true; `editor-region` (pinned present by the control) is the
    // current chrome element the embed branch genuinely suppresses.
    expect(screen.queryByTestId('editor-region')).toBeNull();
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

  it('?embed does not open the pledge or initialize the version baseline', async () => {
    // Embed mode skips one-time prompts and leaves the normal-app baseline alone.
    window.localStorage.removeItem(LS_KEYS.lastSeenVersion);
    window.history.replaceState({}, '', '/?embed&code=A.b');
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />);
    await screen.findByTestId('embed-header');
    await waitFor(() => expect(screen.getByTestId('embed-header')).toBeInTheDocument());
    expect(useUiStore.getState().activeModal).toBeNull();
    expect(screen.queryByTestId('pledge-modal')).toBeNull();
    expect(window.localStorage.getItem(LS_KEYS.lastSeenVersion)).toBeNull();
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

describe('AppRoot — pricing upgrade → Paddle checkout', () => {
  async function openPricing() {
    const { useUiStore } = await import('../state/uiStore');
    await act(async () => { useUiStore.getState().openModal('pricing'); });
    return screen.findByTestId('pricing-modal');
  }

  // Signed-in: Upgrade opens Paddle checkout for the chosen plan (regression guard).
  it('signed-in user clicking Upgrade opens Paddle checkout for the chosen plan', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'u1', email: 'e@x.com', displayName: 'U', photoURL: null }, authReady: true, online: true });
    });
    await openPricing();
    await act(async () => { await userEvent.click(screen.getByTestId('pricing-upgrade-plus')); });
    expect(paddle.openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ planType: 'plus-monthly', userId: 'u1' }),
    );
  });

  // Anonymous: Upgrade must NOT silently close — it opens sign-in and defers checkout.
  it('anonymous user clicking Upgrade opens sign-in (not a silent close) and defers checkout', async () => {
    const { useUiStore } = await import('../state/uiStore');
    render(<AppRoot />); // signed-out by default
    await screen.findByTestId('header-title');
    await openPricing();
    await act(async () => { await userEvent.click(screen.getByTestId('pricing-upgrade-plus')); });
    expect(useUiStore.getState().loginModalOpen).toBe(true);
    expect(paddle.openCheckout).not.toHaveBeenCalled();
  });

  // Anonymous → after sign-in, the deferred Paddle checkout fires for the chosen plan.
  it('resumes the deferred Paddle checkout once the anonymous user signs in', async () => {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    await openPricing();
    await act(async () => { await userEvent.click(screen.getByTestId('pricing-upgrade-plus')); });
    expect(paddle.openCheckout).not.toHaveBeenCalled();
    await act(async () => {
      useAuthStore.setState({ user: { uid: 'u2', email: 'z@x.com', displayName: 'Z', photoURL: null }, authReady: true, online: true });
    });
    await waitFor(() => expect(paddle.openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ planType: 'plus-monthly', userId: 'u2' }),
    ));
  });
});

// ─── Shared-link visitor loading / retryable failure (Figma 36:8669…36:8870) ───
describe('AppRoot — shared-link visitor status', () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((res) => { resolve = res; });
    return { promise, resolve };
  }
  const sharedItem = () => ({
    id: 'shared-1', title: 'Checkout flow', js: 'Alice->Bob: pay', css: '', html: '',
    htmlMode: 'html', cssMode: 'css', jsMode: 'js',
    pages: [{ id: 'p1', title: 'Main', js: 'Alice->Bob: pay', css: '' }], currentPageId: 'p1',
    isReadOnly: true,
  });
  async function mockedGetSharedItem() {
    const { getSharedItem } = await import('../services/cloudFunctions');
    return vi.mocked(getSharedItem);
  }
  const authReady = () => act(async () => {
    useAuthStore.setState({ user: null, authReady: true, online: true });
  });

  it('shows the loading view (not a blank screen) while the shared read is pending', async () => {
    // (Pre-auth loading is covered in useBootItem.test; this harness's auth mock
    // reports ready on mount.)
    const getSharedItem = await mockedGetSharedItem();
    getSharedItem.mockImplementationOnce(() => new Promise(() => {}));
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    const view = await screen.findByTestId('share-visitor-status');
    expect(view).toHaveAttribute('data-status', 'loading');
    expect(screen.getByTestId('share-status-title')).toHaveTextContent('Loading diagram…');
  });

  it('loading → success: no invented document while pending, then the original read-only diagram', async () => {
    const getSharedItem = await mockedGetSharedItem();
    const pending = deferred<never>();
    getSharedItem.mockImplementationOnce(() => pending.promise);
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    await authReady();

    expect(screen.getByTestId('share-visitor-status')).toHaveAttribute('data-status', 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading diagram…');
    expect(screen.queryByTestId('dsl-editor')).toBeNull();
    expect(screen.queryByTestId('header-fork')).toBeNull();
    expect(screen.queryByTestId('header-present')).toBeNull();
    expect(screen.queryByTestId('header-title')).toBeNull();
    expect(useEditorStore.getState().currentItem).toBeNull();

    await act(async () => { pending.resolve(sharedItem() as never); });

    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow');
    expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'readonly');
    expect(screen.queryByTestId('share-visitor-status')).toBeNull();
    expect(useEditorStore.getState().currentItem?.isReadOnly).toBe(true);
    expect(getSharedItem).toHaveBeenCalledWith('shared-1', 'tok');
  });

  it('transient failure → Try again → fresh request with the same id/token → read-only diagram', async () => {
    const getSharedItem = await mockedGetSharedItem();
    const { SharedItemError } = await import('../services/sharedItemError');
    getSharedItem.mockClear();
    getSharedItem
      .mockRejectedValueOnce(new SharedItemError('Failed to get shared item', 500))
      .mockResolvedValueOnce(sharedItem() as never);
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    await authReady();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load this diagram');
    expect(screen.getByTestId('share-status-title')).toHaveTextContent('Shared link');
    expect(screen.queryByTestId('share-error')).toBeNull(); // not the dead-link notice
    expect(useEditorStore.getState().currentItem).toBeNull(); // no blank editable diagram

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow');
    expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'readonly');
    expect(getSharedItem).toHaveBeenCalledTimes(2);
    expect(getSharedItem).toHaveBeenNthCalledWith(2, 'shared-1', 'tok');
  });

  it('an untyped failure offers retry, never claims the link is invalid', async () => {
    // The file-level mock rejects with a plain Error (no backend provenance).
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    await authReady();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByTestId('share-error')).toBeNull();
  });

  it('an explicit 404/403 keeps the existing unavailable-link notice (no retry view)', async () => {
    const getSharedItem = await mockedGetSharedItem();
    const { SharedItemError } = await import('../services/sharedItemError');
    getSharedItem.mockRejectedValueOnce(new SharedItemError('Invalid share token or item not shared', 403));
    window.history.replaceState({}, '', '/?id=shared-1&share-token=revoked');
    render(<AppRoot />);
    await authReady();
    expect(await screen.findByTestId('share-error')).toBeInTheDocument();
    expect(screen.queryByTestId('share-visitor-status')).toBeNull();
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it.each(['button', 'dismiss'])('unavailable link %s returns to Diagrams without creating a document', async (action) => {
    const getSharedItem = await mockedGetSharedItem();
    const { SharedItemError } = await import('../services/sharedItemError');
    getSharedItem.mockRejectedValueOnce(new SharedItemError('Unavailable', 403));
    window.history.replaceState({}, '', '/?id=dead-id&share-token=dead');
    render(<AppRoot />);
    await authReady();
    await screen.findByTestId('share-error');
    const create = vi.spyOn(useEditorStore.getState(), 'newItem');
    if (action === 'button') await userEvent.click(screen.getByRole('button', { name: 'Go to Diagrams' }));
    else await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(new URLSearchParams(location.search).get('view')).toBe('diagrams'));
    expect(new URLSearchParams(location.search).has('id')).toBe(false);
    expect(new URLSearchParams(location.search).has('share-token')).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(useEditorStore.getState().currentItem).toBeNull();
  });

  it('revoked between attempts: retry that gets 403 fails closed to the unavailable notice', async () => {
    const getSharedItem = await mockedGetSharedItem();
    const { SharedItemError } = await import('../services/sharedItemError');
    getSharedItem
      .mockRejectedValueOnce(new SharedItemError('Failed', 503))
      .mockRejectedValueOnce(new SharedItemError('Invalid share token or item not shared', 403));
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    await authReady();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('share-error')).toBeInTheDocument();
    expect(useEditorStore.getState().currentItem).toBeNull();
    expect(screen.queryByTestId('dsl-editor')).toBeNull();
  });

  it('the status view follows the global appearance (toggle writes <html data-appearance>)', async () => {
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    await screen.findByTestId('share-visitor-status');
    const before = document.documentElement.dataset.appearance;
    await userEvent.click(screen.getByTestId('header-appearance'));
    const after = document.documentElement.dataset.appearance;
    expect(after).not.toBe(before);
    expect(after === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance')
      .toBe(screen.getByTestId('header-appearance').getAttribute('aria-label'));
    // Restore so later tests start from the same appearance.
    await userEvent.click(screen.getByTestId('header-appearance'));
  });

  it('ordinary ?id= boot never shows the visitor status view', async () => {
    render(<AppRoot />); // default '/?id=t-boot'
    await authReady();
    await screen.findByTestId('header-title');
    expect(screen.queryByTestId('share-visitor-status')).toBeNull();
  });
});

// ─── Browser Back onto a shared URL (route re-entry regression) ───────────────
describe('AppRoot — shared URL re-entry via browser Back', () => {
  afterEach(async () => {
    // mockReset below drops the file-level default; restore it for later suites.
    const { getSharedItem } = await import('../services/cloudFunctions');
    vi.mocked(getSharedItem).mockReset();
    vi.mocked(getSharedItem).mockImplementation(async () => { throw new Error('not found'); });
  });
  const sharedItem = (title = 'Checkout flow') => ({
    id: 'shared-1', title, js: 'Alice->Bob: pay', css: '', html: '',
    htmlMode: 'html', cssMode: 'css', jsMode: 'js',
    pages: [{ id: 'p1', title: 'Main', js: 'Alice->Bob: pay', css: '' }], currentPageId: 'p1',
    isReadOnly: true,
  });
  const ownerItem = {
    id: 'own-x', title: 'My private diagram', js: 'Me->Me: secret', css: '', html: '',
    htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', isReadOnly: false,
  };
  async function mockedGetSharedItem() {
    const { getSharedItem } = await import('../services/cloudFunctions');
    const m = vi.mocked(getSharedItem);
    m.mockReset();
    return m;
  }
  // The router mock reads window.location on render; Back = replaceState + re-render.
  async function goBackTo(url: string, rerender: (ui: React.ReactElement) => void) {
    await act(async () => {
      window.history.replaceState({}, '', url);
      rerender(<AppRoot />);
    });
  }

  async function openShareThenOwnItem(getSharedItem: Awaited<ReturnType<typeof mockedGetSharedItem>>) {
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    const view = render(<AppRoot />);
    await act(async () => { useAuthStore.setState({ user: null, authReady: true, online: true }); });
    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow');
    // Diagrams breadcrumb → hub, then open an own/library diagram (handleOpenItem shape).
    await userEvent.click(screen.getByTestId('header-go-home'));
    await act(async () => { view.rerender(<AppRoot />); }); // router re-render on navigate
    await act(async () => {
      useEditorStore.getState().loadItem(ownerItem as never);
      window.history.replaceState({}, '', '/?id=own-x');
      view.rerender(<AppRoot />);
    });
    expect(await screen.findByTestId('header-title')).toHaveValue('My private diagram');
    expect(getSharedItem).toHaveBeenCalledTimes(1);
    return view;
  }

  it('Back to the shared URL reloads the same id/token: status view first (no owner doc), then the shared diagram', async () => {
    const getSharedItem = await mockedGetSharedItem();
    let release!: (v: unknown) => void;
    getSharedItem
      .mockResolvedValueOnce(sharedItem() as never)
      .mockImplementationOnce(() => new Promise((r) => { release = r; }) as never);
    const view = await openShareThenOwnItem(getSharedItem);

    await goBackTo('/?id=shared-1&share-token=tok', view.rerender);
    expect(screen.getByTestId('share-visitor-status')).toHaveAttribute('data-status', 'loading');
    expect(screen.queryByDisplayValue('My private diagram')).toBeNull();
    expect(screen.queryByText(/My private diagram/)).toBeNull();
    expect(getSharedItem).toHaveBeenCalledTimes(2);
    expect(getSharedItem).toHaveBeenNthCalledWith(2, 'shared-1', 'tok');

    await act(async () => { release(sharedItem('Checkout flow v2')); });
    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow v2');
    expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'readonly');
  });

  it('Back to a link revoked meanwhile shows the unavailable notice and never the owner document', async () => {
    const getSharedItem = await mockedGetSharedItem();
    const { SharedItemError } = await import('../services/sharedItemError');
    getSharedItem
      .mockResolvedValueOnce(sharedItem() as never)
      .mockRejectedValueOnce(new SharedItemError('Invalid share token or item not shared', 403));
    const view = await openShareThenOwnItem(getSharedItem);

    await goBackTo('/?id=shared-1&share-token=tok', view.rerender);
    expect(await screen.findByTestId('share-error')).toBeInTheDocument();
    expect(screen.queryByTestId('dsl-editor')).toBeNull();
    expect(screen.queryByDisplayValue('My private diagram')).toBeNull();
  });

  it('Back while the network is down offers Try again (same id/token), not the invalid-link notice', async () => {
    const getSharedItem = await mockedGetSharedItem();
    const { SharedItemError } = await import('../services/sharedItemError');
    getSharedItem
      .mockResolvedValueOnce(sharedItem() as never)
      .mockRejectedValueOnce(new SharedItemError('Failed to load shared item', null))
      .mockResolvedValueOnce(sharedItem() as never);
    const view = await openShareThenOwnItem(getSharedItem);

    await goBackTo('/?id=shared-1&share-token=tok', view.rerender);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow');
    expect(getSharedItem).toHaveBeenNthCalledWith(3, 'shared-1', 'tok');
    expect(screen.queryByTestId('share-error')).toBeNull();
  });

  it('pending share → Diagrams → Back is not blank: it reads again and shows the diagram', async () => {
    const getSharedItem = await mockedGetSharedItem();
    getSharedItem
      .mockImplementationOnce(() => new Promise(() => {}) as never) // abandoned first read
      .mockResolvedValueOnce(sharedItem() as never);
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    const view = render(<AppRoot />);
    await act(async () => { useAuthStore.setState({ user: null, authReady: true, online: true }); });
    await userEvent.click(await screen.findByTestId('header-go-home'));
    // The real router re-renders on navigate(); the mock only rewrites the URL.
    await act(async () => { view.rerender(<AppRoot />); });
    expect(window.location.search).toContain('view=diagrams');
    expect(screen.queryByTestId('share-visitor-status')).toBeNull(); // hub, not the status view
    await goBackTo('/?id=shared-1&share-token=tok', view.rerender);
    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow');
    expect(getSharedItem).toHaveBeenCalledTimes(2);
  });
});

// ─── Share panel journey through AppRoot (owner, signed in) ────────────────────
describe('AppRoot — share panel journey', () => {
  const signedInUser = { uid: 'u1', email: 'u1@test.com', displayName: 'U', photoURL: null };

  async function openPanel() {
    const { useEditorStore: store } = await import('../state/editorStore');
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    const current = store.getState().currentItem!;
    (itemSvc.subscribeAllItems as unknown as {
      mockImplementation(fn: (uid: string, cb: (items: unknown[]) => void) => () => void): void;
    }).mockImplementation((_uid, cb) => { cb([current]); return () => {}; });
    await act(async () => {
      useAuthStore.setState({ user: signedInUser, authReady: true, online: true });
    });
    const shareBtn = await screen.findByTestId('share-button');
    await waitFor(() => expect(shareBtn).not.toBeDisabled());
    await act(async () => { await userEvent.click(shareBtn); });
    return screen.findByTestId('share-panel');
  }

  afterEach(async () => {
    const { createShare } = await import('../services/cloudFunctions');
    vi.mocked(createShare).mockReset();
    vi.mocked(createShare).mockImplementation(async () => ({ url: 'http://x?id=1&v=abc', md5: 'abc' }));
    itemSvc.stopSharing.mockReset();
    itemSvc.stopSharing.mockImplementation(async () => {});
  });

  it('create failure → Try again → link; copy failure → manual guidance; stop failure keeps link; stop → create', async () => {
    const { createShare } = await import('../services/cloudFunctions');
    vi.mocked(createShare)
      .mockRejectedValueOnce(new Error('Failed to create share link'))
      .mockResolvedValueOnce({ url: 'https://app.zenuml.com/?id=1&share-token=t&v=abc', md5: 'abc' });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('NotAllowedError'); }) },
      configurable: true,
    });
    itemSvc.stopSharing
      .mockRejectedValueOnce(new Error('stop failed'))
      .mockResolvedValueOnce(undefined);

    const panel = await openPanel();
    expect(panel).toHaveTextContent('Anyone with the link can view this diagram.');
    await act(async () => { await userEvent.click(screen.getByTestId('share-create')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t create a link.');
    expect(screen.queryByTestId('share-url')).toBeNull(); // nothing claimed before confirmation

    await act(async () => { await userEvent.click(screen.getByRole('button', { name: /try again/i })); });
    expect(await screen.findByTestId('share-url')).toHaveValue('https://app.zenuml.com/?id=1&share-token=t&v=abc');

    await act(async () => { await userEvent.click(screen.getByTestId('share-copy')); });
    expect(await screen.findByTestId('share-copy-error')).toHaveTextContent('Couldn’t copy.');
    expect(screen.getByTestId('share-copy')).not.toHaveTextContent('Copied');

    await act(async () => { await userEvent.click(screen.getByTestId('share-stop')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t stop sharing. Your link is still active.');
    expect(screen.getByTestId('share-url')).toBeInTheDocument();

    await act(async () => { await userEvent.click(screen.getByTestId('share-stop')); });
    expect(await screen.findByTestId('share-create')).toHaveTextContent('Create share link');
    expect(screen.queryByTestId('share-url')).toBeNull();
    expect(itemSvc.stopSharing).toHaveBeenCalledTimes(2);
  });

  it('a visitor (read-only shared copy) cannot open the share panel; the original title stays in the header', async () => {
    const { getSharedItem } = await import('../services/cloudFunctions');
    vi.mocked(getSharedItem).mockResolvedValueOnce({
      id: 'shared-1', title: 'Checkout flow', js: 'A->B: x', css: '', html: '',
      htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', isReadOnly: true,
    } as never);
    window.history.replaceState({}, '', '/?id=shared-1&share-token=tok');
    render(<AppRoot />);
    await act(async () => { useAuthStore.setState({ user: null, authReady: true, online: true }); });
    expect(await screen.findByTestId('header-title')).toHaveValue('Checkout flow');
    expect(screen.queryByTestId('share-button')).toBeNull();
    expect(screen.queryByTestId('header-new')).toBeNull();
    expect(screen.queryByTestId('code-appearance-bar')).toBeNull();
    expect(screen.queryByTestId('css-mode-select')).toBeNull();
    expect(screen.getByTestId('header-fork')).toBeInTheDocument();
    expect(screen.getByTestId('header-present')).toBeInTheDocument();
    const original = useEditorStore.getState().currentItem?.js;
    const content = screen.getByTestId('dsl-editor').querySelector('.cm-content') as HTMLElement;
    content.focus();
    await userEvent.keyboard('visitor edit');
    expect(content.textContent).not.toContain('visitor edit');
    expect(useEditorStore.getState().currentItem?.js).toBe(original);
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});

it('opens a fork from Diagrams in the editor and clears the library route', async () => {
  const source = { id: 'fork-source', title: 'Source', js: 'A->B: preserved', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '' };
  await localStore.set(LS_KEYS.items, { 'fork-source': true });
  await localStore.set('fork-source', source);
  window.history.replaceState({}, '', '/?view=diagrams');
  render(<AppRoot />);
  await userEvent.click(await screen.findByTestId('home-action-fork-fork-source'));
  expect(await screen.findByTestId('editor-shell')).toBeInTheDocument();
  expect(useEditorStore.getState().currentItem?.js).toBe(source.js);
  expect(useEditorStore.getState().currentItem?.title).toBe('(Forked) Source');
  expect(new URLSearchParams(window.location.search).get('view')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('id')).toBe(useEditorStore.getState().currentItem?.id);
});

it('opens a shared visitor fork as an editable copy under its own route', async () => {
  const { getSharedItem } = await import('../services/cloudFunctions');
  vi.mocked(getSharedItem).mockResolvedValueOnce({ id: 'shared-fork', title: 'Public source', js: 'A->B: preserved', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '' } as never);
  window.history.replaceState({}, '', '/?id=shared-fork&share-token=tok');
  render(<AppRoot />);
  await userEvent.click(await screen.findByTestId('header-fork'));
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('share-token')).toBeNull());
  expect(new URLSearchParams(window.location.search).get('id')).toBe(useEditorStore.getState().currentItem?.id);
  expect(useEditorStore.getState().currentItem?.title).toBe('(Forked) Public source');
  expect(useEditorStore.getState().currentItem?.js).toBe('A->B: preserved');
  expect(useEditorStore.getState().currentItem?.isReadOnly).toBeUndefined();
});

it('hides the previous account library while the current account read is pending', async () => {
  let deliver!: (items: unknown[]) => void;
  itemSvc.subscribeAllItems.mockImplementation((...args: unknown[]) => { deliver = args[1] as (items: unknown[]) => void; return () => {}; });
  const local = { id: 'local-private', title: 'Previous local private diagram', js: 'A->B: local', pages: [] };
  await localStore.set(LS_KEYS.items, { 'local-private': true }); await localStore.set('local-private', local);
  window.history.replaceState({}, '', '/?view=diagrams');
  render(<AppRoot />);
  expect(await screen.findByRole('button', { name: 'Open Previous local private diagram' })).toBeInTheDocument();
  act(() => useAuthStore.setState({ user: { uid: 'new-owner' }, authReady: true }));
  expect(screen.queryByRole('button', { name: 'Open Previous local private diagram' })).toBeNull();
  expect(screen.getByTestId('home-library-loading')).toBeInTheDocument();
  await act(async () => { deliver([]); });
  expect(screen.getByText('No diagrams yet')).toBeInTheDocument();
});

it.each(['editor', 'hub', 'share-status'] as const)('owns OAuth pending/cancellation in the %s host', async (host) => {
  const firebase = await import('../services/firebase');
  let reject!: (error: unknown) => void;
  vi.mocked(firebase.login).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  if (host === 'hub') window.history.replaceState({}, '', '/?view=diagrams');
  if (host === 'share-status') {
    const { getSharedItem } = await import('../services/cloudFunctions');
    vi.mocked(getSharedItem).mockImplementationOnce(() => new Promise(() => {}));
    window.history.replaceState({}, '', '/?id=oauth-status&share-token=tok');
  }
  render(<AppRoot />);
  const trigger = await screen.findByTestId(host === 'hub' ? 'home-signin' : 'header-login');
  await userEvent.click(trigger); await userEvent.click(screen.getByTestId('login-google'));
  expect(screen.getByTestId('login-pending')).toHaveTextContent('Google window');
  expect(screen.getByTestId('login-github')).toBeDisabled();
  await userEvent.keyboard('{Escape}'); await userEvent.click(trigger);
  expect(screen.queryByTestId('login-pending')).toBeNull();
  await act(async () => { reject({ code: 'auth/popup-blocked' }); });
  expect(screen.queryByTestId('login-error')).toBeNull();
  expect(screen.getByTestId('login-google')).toBeEnabled();
});

it('adapts account-import ownership to the guarded service and invalidates it on account change', async () => {
  await localStore.set(LS_KEYS.items, { 'account-local': true });
  await localStore.set('account-local', { id: 'account-local', title: 'Local', js: 'A->B: local', pages: [] });
  window.history.replaceState({}, '', '/?view=diagrams');
  render(<AppRoot />); await screen.findByTestId('home-view');
  act(() => useAuthStore.setState({ user: { uid: 'account-a' }, authReady: true }));
  await userEvent.click(await screen.findByRole('button', { name: 'Import 1 diagram' }));
  const calls = itemSvc.saveItems.mock.calls as unknown as [unknown, { expectedUid: string; isCurrent(): boolean }][];
  const guard = calls.at(-1)![1];
  expect(guard.expectedUid).toBe('account-a'); expect(guard.isCurrent()).toBe(true);
  act(() => useAuthStore.setState({ user: { uid: 'account-b' }, authReady: true }));
  expect(guard.isCurrent()).toBe(false);
});


describe('AppRoot save recovery and ownership', () => {
  async function boot() {
    render(<AppRoot />);
    await screen.findByTestId('header-title');
    act(() => useEditorStore.getState().setDsl('A -> B: retained'));
  }
  async function saveShortcut() { await userEvent.keyboard('{Meta>}s{/Meta}'); }
  it('keeps content on rejected local save, exposes retry, and saves it once on retry', async () => {
    await boot();
    itemSvc.setItem.mockRejectedValueOnce(new Error('device full'));
    await saveShortcut();
    expect(await screen.findByRole('button', {name:'Retry save'})).toBeInTheDocument();
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().currentItem?.js).toBe('A -> B: retained');
    expect(screen.queryByRole('dialog', {name:'Saved on this device'})).toBeNull();
    await userEvent.click(screen.getByRole('button', {name:'Retry save'}));
    await waitFor(() => expect(useEditorStore.getState().dirty).toBe(false));
    expect(itemSvc.setItem).toHaveBeenCalledTimes(2);
  });
  it('shows the device notice once after successful local persistence', async () => {
    await boot();
    await saveShortcut();
    expect(await screen.findByRole('dialog', {name:'Saved on this device'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name:'Not now'}));
    act(() => useEditorStore.getState().setDsl('A -> B: second'));
    await saveShortcut();
    await waitFor(() => expect(useEditorStore.getState().saving).toBe(false));
    expect(screen.queryByRole('dialog', {name:'Saved on this device'})).toBeNull();
    expect(itemSvc.setItem).toHaveBeenCalledTimes(2);
  });
  it('does not create a share link when its required save failed', async () => {
    await boot();
    act(() => useAuthStore.setState({user:{uid:'u1',displayName:'Ada',email:null,photoURL:null}}));
    const {createShare} = await import('../services/cloudFunctions');
    vi.mocked(createShare).mockClear();
    await userEvent.click(screen.getByTestId('share-button'));
    itemSvc.setItem.mockRejectedValueOnce(new Error('cloud denied'));
    await userEvent.click(await screen.findByTestId('share-create'));
    await waitFor(() => expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'error'));
    expect(createShare).not.toHaveBeenCalled();
    expect(screen.queryByTestId('share-url')).toBeNull();
    expect(await screen.findByTestId('share-error-text')).toHaveTextContent('Couldn’t create a link');
  });
  it('shows retry after cloud rejection without reporting Saved', async () => {
    await boot();
    act(() => useAuthStore.setState({user:{uid:'u1',displayName:'Ada',email:null,photoURL:null}}));
    itemSvc.setItem.mockRejectedValueOnce(new Error('cloud denied'));
    await saveShortcut();
    expect(await screen.findByRole('button', {name:'Retry save'})).toBeInTheDocument();
    expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'error');
    expect(useEditorStore.getState().dirty).toBe(true);
    await userEvent.click(screen.getByRole('button', {name:'Retry save'}));
    await waitFor(() => expect(useEditorStore.getState().dirty).toBe(false));
  });
  it('reports offline sync pending and retains the local revision without waiting for cloud setup', async () => {
    await boot();
    act(() => useAuthStore.setState({user:{uid:'u1',displayName:'Ada',email:null,photoURL:null},online:false}));
    userSvc.ensureUser.mockImplementationOnce(() => new Promise(() => {}));
    itemSvc.setItem.mockResolvedValueOnce({status:'queued'});
    await saveShortcut();
    await waitFor(() => expect(screen.getByTestId('header-savestate')).toHaveTextContent('Saved locally · Sync pending'));
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(useEditorStore.getState().saving).toBe(false);
    userSvc.ensureUser.mockReset().mockResolvedValue({});
  });
  it.each(['get','set'] as const)('does not report a failed document save when only notice-preference %s rejects', async (operation) => {
    await boot();
    const id = useEditorStore.getState().currentItem!.id;
    const spy = operation === 'get'
      ? vi.spyOn(localStore,'get').mockRejectedValueOnce(new Error('preference read failed'))
      : vi.spyOn(localStore,'set').mockRejectedValueOnce(new Error('preference write failed'));
    await saveShortcut();
    await waitFor(() => expect(useEditorStore.getState().saving).toBe(false));
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(screen.getByTestId('header-savestate')).not.toHaveAttribute('data-state','error');
    expect(screen.queryByRole('button', {name:'Retry save'})).toBeNull();
    expect(screen.queryByRole('dialog', {name:'Saved on this device'})).toBeNull();
    spy.mockRestore();
    await saveShortcut();
    expect(await screen.findByRole('dialog', {name:'Saved on this device'})).toBeInTheDocument();
    expect(itemSvc.setItem.mock.calls.map(call=>call[0])).toEqual([id,id]);
  });
  it('reports Saved only after a confirmed cloud write for the current owner', async () => {
    await boot();
    act(() => useAuthStore.setState({user:{uid:'u1',displayName:'Ada',email:null,photoURL:null}}));
    itemSvc.setItem.mockResolvedValueOnce({status:'cloud'});
    await saveShortcut();
    await waitFor(() => expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state','saved'));
    act(() => useAuthStore.setState({user:{uid:'u2',displayName:'Other',email:null,photoURL:null}}));
    expect(screen.getByTestId('header-savestate')).not.toHaveAttribute('data-state','saved');
    expect(itemSvc.setItem).toHaveBeenCalledTimes(1);
  });
  it('does not turn a successful local save into cloud-confirmed Saved on sign-in', async () => {
    await boot();
    itemSvc.setItem.mockImplementationOnce(async (id, it) => {await localStore.set(id,it);return {status:'local'};});
    await saveShortcut();
    await userEvent.click(await screen.findByRole('button', {name:'Not now'}));
    expect(useEditorStore.getState().dirty).toBe(false);
    const calls = itemSvc.setItem.mock.calls.length;
    act(() => useAuthStore.setState({user:{uid:'u1',displayName:'Ada',email:null,photoURL:null}}));
    expect(screen.getByTestId('header-savestate')).not.toHaveAttribute('data-state','saved');
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(itemSvc.setItem).toHaveBeenCalledTimes(calls);
  });
  it('does not turn a clean queued revision into cloud-confirmed Saved after account A→B→A', async () => {
    await boot();
    const ada = {uid:'u1',displayName:'Ada',email:null,photoURL:null};
    act(() => useAuthStore.setState({user:ada,online:false}));
    itemSvc.setItem.mockImplementationOnce(async (id,it) => {await localStore.set(id,it);return {status:'queued'};});
    await saveShortcut();
    await screen.findByRole('button', {name:'Retry sync'});
    expect(useEditorStore.getState().dirty).toBe(false);
    act(() => {
      useAuthStore.setState({user:{...ada,uid:'u2'}});
      useAuthStore.setState({user:ada});
    });
    expect(screen.getByTestId('header-savestate')).not.toHaveAttribute('data-state','saved');
    expect(useEditorStore.getState().dirty).toBe(false);
    expect(itemSvc.setItem).toHaveBeenCalledTimes(1);
  });
  it('keeps queued local work truthful when online retry hits the cloud plan limit', async () => {
    await boot();
    act(() => useAuthStore.setState({user:{uid:'u1',displayName:'Ada',email:null,photoURL:null},online:false}));
    itemSvc.setItem.mockResolvedValueOnce({status:'queued'});
    await saveShortcut();
    await screen.findByRole('button', {name:'Retry sync'});
    expect(useEditorStore.getState().dirty).toBe(false);
    userSvc.getUserItemIds.mockResolvedValue(['owned-a','owned-b','owned-c','owned-d']);
    act(() => useAuthStore.setState({online:true}));
    await userEvent.click(screen.getByRole('button', {name:'Retry sync'}));
    await screen.findByTestId('limit-notice');
    expect(itemSvc.setItem.mock.calls.at(-1)?.[2]).toEqual(expect.objectContaining({skipCloud:true}));
    expect(screen.getByTestId('header-savestate')).not.toHaveAttribute('data-state','saved');
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(screen.getByText('Saved locally. Cloud save is paused at your plan limit.')).toBeInTheDocument();
    expect(useEditorStore.getState().currentItem?.js).toBe('A -> B: retained');
    await userEvent.click(screen.getByTestId('limit-dismiss'));
    const {createShare} = await import('../services/cloudFunctions');
    vi.mocked(createShare).mockClear();
    await userEvent.click(screen.getByTestId('share-button'));
    await userEvent.click(await screen.findByTestId('share-create'));
    await waitFor(() => expect(screen.getByTestId('share-panel')).toHaveAttribute('data-state','create-failed'));
    expect(createShare).not.toHaveBeenCalled();
  });
  it('does not clear a later edit when a held save succeeds, and ignores duplicate saves', async () => {
    await boot();
    let finish!: () => void;
    itemSvc.setItem.mockImplementationOnce(() => new Promise<undefined>(resolve => {finish=() => resolve(undefined);}));
    await saveShortcut();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    await saveShortcut();
    act(() => useEditorStore.getState().setDsl('A -> B: later'));
    await act(async () => {finish();});
    expect(itemSvc.setItem).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().currentItem?.js).toBe('A -> B: later');
  });
  it.each(['item', 'account', 'account round trip'])('does not clean a new owner revision after held success and %s change', async (kind) => {
    await boot();
    let finish!: () => void;
    itemSvc.setItem.mockImplementationOnce(() => new Promise<undefined>(resolve => {finish=() => resolve(undefined);}));
    await saveShortcut();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    act(() => {
      if (kind === 'item') useEditorStore.getState().newItem();
      else {
        useAuthStore.setState({user:{uid:'another',displayName:'Other',email:null,photoURL:null}});
        if(kind === 'account round trip') useAuthStore.setState({user:null});
      }
      useEditorStore.getState().setDsl('New owner revision');
    });
    await act(async () => finish());
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().currentItem?.js).toBe('New owner revision');
    expect(useEditorStore.getState().saving).toBe(false);
    expect(screen.queryByRole('button', {name:'Retry save'})).toBeNull();
  });
  it.each(['item', 'account'])('ignores stale save failure after %s changes', async (kind) => {
    await boot();
    let reject!: (e: Error) => void;
    itemSvc.setItem.mockImplementationOnce(() => new Promise<undefined>((_, no) => {reject=no;}));
    await saveShortcut();
    await waitFor(() => expect(itemSvc.setItem).toHaveBeenCalledTimes(1));
    act(() => {if(kind==='item') useEditorStore.getState().newItem();
      else useAuthStore.setState({user:{uid:'another',displayName:'Other',email:null,photoURL:null}});});
    await act(async () => {reject(new Error('stale'));});
    expect(screen.queryByRole('button', {name:'Retry save'})).toBeNull();
    expect(useEditorStore.getState().saving).toBe(false);
  });
});
