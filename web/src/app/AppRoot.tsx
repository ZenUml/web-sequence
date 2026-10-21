import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { indexRoute } from './router';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle, type PreviewExportSnapshot } from '../preview/PreviewFrame';
import { ACTUAL_SIZE, formatZoom, zoomIn, zoomOut, type PreviewZoom } from '../preview/previewZoom';
import { applyAppearance, previewThemeFor } from './appearance';
import { Console, type ConsoleEntry } from '../preview/Console';
import { filterStarterNoise } from '../preview/consoleFilter';
import { useEditorStore } from '../state/editorStore';
import { useAuthStore } from '../state/authStore';
import { useSettingsStore } from '../state/settingsStore';
import { useUiStore } from '../state/uiStore';
import type { Item, CssMode } from '../domain/types';
import { computeCss } from '../preview/transpilers';
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../ui';
// Sidebar removed — Hub (Approach A) uses no icon rail; see "no rail" comment below.
import { Layout } from '../components/Layout';
import { PageTabs } from '../components/pages/PageTabs';
import { RendererHeader } from '../components/preview/RendererHeader';
import { ExportDialog } from '../components/preview/ExportDialog';
import { CssPanel } from '../components/editor/CssPanel';
import { CodeAppearanceBar } from '../components/editor/CodeAppearanceBar';
import { AppHeader } from '../components/header/AppHeader';
import { SavedOnDeviceModal } from '../components/modals/SavedOnDeviceModal';
import { AskToImportModal } from '../components/modals/AskToImportModal';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useBootItem } from '../hooks/useBootItem';
import { useAutoSave } from '../hooks/useAutoSave';
import { ImportPreflightError, useImportOnLogin } from '../hooks/useImportOnLogin';
import { makeItemService } from '../services/itemService';
import { getSharedItem, createShare } from '../services/cloudFunctions';
import { ensureUser, setItemForUser, unsetItemForUser, getUserItemIds, setUserSetting } from '../services/userService';
import { localStore, syncStore } from '../services/storage';
import { LS_KEYS, APP_VERSION } from '../config/constants';
import { useItems } from '../hooks/useItems';
import { useFolders } from '../hooks/useFolders';
import { useShare } from '../hooks/useShare';
import { migrateToPages } from '../domain/item';
// LibraryPanel removed — Library is now the Home page (isHomeMode), not a side panel.
import { ShareButton } from '../components/share/ShareButton';
import { ShareErrorNotice } from '../components/modals/ShareErrorNotice';
import { ShareVisitorStatus } from '../components/share/ShareVisitorStatus';
import { buildStandaloneHtml } from '../services/exportImport';
import { downloadText } from '../services/download';
import { runImport, readImportFile, useImportBusy, type ImportFileContext } from '../components/library/importFeedbackStore';
import { runExportAll } from '../components/library/exportFeedbackStore';
import { LibraryFeedback } from '../components/library/LibraryFeedback';
import { useLibraryReader } from '../components/library/useLibraryReader';
// M04 — subscription / settings / modals / analytics
import { useSubscription } from '../hooks/useSubscription';
import { useAnalytics } from '../hooks/useAnalytics';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePaddle, type CheckoutPlanType } from '../hooks/usePaddle';
import { isImportOverFileLimit, isOverFileLimit, limitFor } from '../domain/planLimit';
import { isPlus } from '../domain/plan';
import { detectFromEnv, parseEmbedCode } from './runtimeMode';
import { CANONICAL_APP_ORIGIN } from '../config/shareOrigin';
import { EmbedHeader } from '../components/embed/EmbedHeader';
import { semverCompare } from '../domain/semver';
import { config as appConfig } from '../config/firebaseConfig';
import type { Settings, PlanType } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import { SettingsModal } from '../components/modals/SettingsModal';
import { CreateNewModal } from '../components/modals/CreateNewModal';
import { HelpModal } from '../components/modals/HelpModal';
import { KeyboardShortcutsModal } from '../components/modals/KeyboardShortcutsModal';
import { SupportPledgeModal } from '../components/modals/SupportPledgeModal';
import { AtomicCssSettingsModal, type CssSettings } from '../components/modals/AtomicCssSettingsModal';
import { PricingModal, type BillingPeriod } from '../components/subscription/PricingModal';
import { LimitReachedNotice } from '../components/subscription/LimitReachedNotice';
import { LoginModal } from '../components/auth/LoginModal';
import { HomeView } from '../components/home/HomeView';
import { ReportBugButton } from '../components/feedback/ReportBugButton';

const CSS_MODES: { value: CssMode; label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'sass', label: 'Sass' },
  { value: 'less', label: 'Less' },
  { value: 'stylus', label: 'Stylus' },
  { value: 'acss', label: 'Atomic CSS' },
];

export function AppRoot() {
  // M05 (RM-2 / REQ-EMB-1): runtime mode drives the embed branch. Resolved ONCE here
  // (not per-effect) so every effect + the render read the same value. detectFromEnv
  // reads window.location.search/protocol + window.IS_EXTENSION/zenumlDesktop.
  const runtime = detectFromEnv();
  const isEmbed = runtime.isEmbed;

  // Hub (Approach A): imperative navigation between home (library grid) and editor.
  const navigate = useNavigate();

  // Auth + online status side-effects (no return value needed from useOnlineStatus)
  const { login, logout, loginError, pendingProvider, cancelLogin, lastProvider } = useAuth();
  useOnlineStatus();

  const item = useEditorStore((s) => s.currentItem);
  const setDsl = useEditorStore((s) => s.setDsl);
  const setCss = useEditorStore((s) => s.setCss);
  const setCssMode = useEditorStore((s) => s.setCssMode);
  const setTitle = useEditorStore((s) => s.setTitle);
  const addPageAction = useEditorStore((s) => s.addPage);
  const deletePageAction = useEditorStore((s) => s.deletePage);
  const switchPageAction = useEditorStore((s) => s.switchPage);
  const renamePageAction = useEditorStore((s) => s.renamePage);
  const unsavedCount = useEditorStore((s) => s.unsavedCount);
  // `dirty` is the union of content edits (unsavedCount) AND metadata edits (title /
  // page add/delete/switch/rename) which do NOT bump unsavedCount. With the Save button
  // retired for a passive indicator, BOTH the indicator and auto-save key off `dirty` so
  // a rename/page-op is reflected as "Unsaved" and actually gets persisted.
  const dirty = useEditorStore((s) => s.dirty);
  // Drives the header's "Saving…" auto-save indicator (set around save()'s cloud write).
  const saving = useEditorStore((s) => s.saving);

  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);

  const preserveLastCode = useSettingsStore((s) => s.settings.preserveLastCode);
  const autoSave = useSettingsStore((s) => s.settings.autoSave);

  // REQ-PST-2: auto-save loop — fires every AUTO_SAVE_INTERVAL when enabled + unsaved edits exist.
  // `save` is defined later in this function; useAutoSave reads it via ref so no stale closure
  // (same pattern as PreviewFrame's cbRef — interval keyed only on `enabled`).
  useAutoSave({ enabled: autoSave, hasUnsaved: dirty, onSave: () => void save() });

  // ⌘S / Ctrl+S manual save. `save` is defined later and re-created each render, so the
  // keydown listener (registered once, keyed on [isEmbed]) calls it through a ref kept
  // fresh every render — no stale closure, and the accelerator advertised by the app
  // menu (Save ⌘S) actually works now that the explicit Save button is gone.
  const saveRef = useRef(save);
  saveRef.current = save;

  const [saveFeedback, setSaveFeedback] = useState<{error: boolean; queued: boolean; withheld?: boolean}>({error:false, queued:false});
  const [cloudConfirmed, setCloudConfirmed] = useState(false);
  const saveGeneration = useRef(0);
  const saveAttempt = useRef<object | null>(null);
  useEffect(() => {
    const invalidate = () => {
      saveGeneration.current += 1;
      saveAttempt.current = null;
      setSaveFeedback({error:false, queued:false});
      setCloudConfirmed(false);
      useEditorStore.getState().setSaving(false);
    };
    const offAuth = useAuthStore.subscribe((next, prev) => {
      if (next.user?.uid !== prev.user?.uid) invalidate();
    });
    const offItem = useEditorStore.subscribe((next, prev) => {
      if (next.currentItem?.id !== prev.currentItem?.id ||
          (next.currentItem !== prev.currentItem && !next.dirty)) invalidate();
    });
    return () => { offAuth(); offItem(); saveGeneration.current += 1; saveAttempt.current = null; };
  }, []);

  const previewRef = useRef<PreviewHandle>(null);
  const [exportRequest, setExportRequest] = useState<{ snapshot: PreviewExportSnapshot | null; title: string } | null>(null);
  function openExport() {
    const snapshot = previewRef.current?.getExportSnapshot();
    const current = useEditorStore.getState().currentItem;
    if (current) setExportRequest({ snapshot: snapshot ?? null, title: current.title || 'diagram' });
  }
  const consoleOpen = useUiStore((s) => s.consoleOpen);
  const toggleConsole = useUiStore((s) => s.toggleConsole);
  const fullscreen = useUiStore((s) => s.fullscreen);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const editorCollapsed = useUiStore((s) => s.editorCollapsed);
  const toggleEditorCollapsed = useUiStore((s) => s.toggleEditorCollapsed);
  // Editor preview zoom (app-side; see previewZoom.ts). `zoomScale` is the
  // effective scale reported back by PreviewFrame, shown as the zoom label.
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>(ACTUAL_SIZE);
  const [zoomScale, setZoomScale] = useState(1);
  // Mobile (≤767px) renders the preview as the native vector SVG (fit-to-width) instead
  // of the fixed-px HTML diagram, which overflows a phone viewport. Present/fullscreen
  // keeps the HTML scale-to-fit-both-axes path (a deliberate "show it big" view), so SVG
  // mode is the non-fullscreen mobile editor preview only.
  const isMobile = useIsMobile();
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  // M04: single-modal state + open/close. Login modal is separate shared state so
  // the anonymous custom-CSS gate can open sign-in.
  const activeModal = useUiStore((s) => s.activeModal);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const loginModalOpen = useUiStore((s) => s.loginModalOpen);
  const setLoginModalOpen = useUiStore((s) => s.setLoginModalOpen);

  // Account flows: closing the sign-in modal (✕, Escape, outside click, or the
  // auto-close below) abandons the current attempt so a late popup result cannot
  // leak pending/error state into the next opening.
  const handleLoginOpenChange = useCallback(
    (open: boolean) => {
      setLoginModalOpen(open);
      if (!open) cancelLogin();
    },
    [setLoginModalOpen, cancelLogin],
  );

  // P5: dismiss the sign-in sheet once auth succeeds. The OAuth round-trip resolves
  // asynchronously (popup → authStore.user), and nothing else closes the modal — so a
  // signed-in user would otherwise stay stranded on the login dialog. Closing on the
  // null→user transition covers every entry point (share-gate, save-gate, header).
  useEffect(() => {
    if (user && loginModalOpen) handleLoginOpenChange(false);
  }, [user, loginModalOpen, handleLoginOpenChange]);

  // M04: subscription (load + derive plan on auth) — `loading` gates the plan-limit
  // race guard (§1). analytics.track binds the current userId. paddle = checkout.
  const { subscription, planType, subscribed, loading: subLoading, loadFailed: subLoadFailed, reload: reloadSubscription, retryFailedLoad: retrySubscriptionLoad } =
    useSubscription();
  const { track } = useAnalytics();
  const { openCheckout } = usePaddle();
  const paymentEnabled = appConfig.features.payment;

  // Anonymous upgrade → sign-in → resume checkout. Paddle checkout needs an account
  // (the webhook links the subscription by userId), so an anonymous Upgrade click can't
  // go straight to Paddle. handleUpgrade stashes the chosen plan here and opens sign-in;
  // once the user authenticates we fire the deferred checkout for that plan. Previously
  // the anonymous branch just closed the modal silently — the Upgrade buttons appeared
  // dead (never reached Paddle).
  const pendingCheckoutRef = useRef<CheckoutPlanType | null>(null);
  useEffect(() => {
    if (user && pendingCheckoutRef.current) {
      const plan = pendingCheckoutRef.current;
      pendingCheckoutRef.current = null;
      openCheckout({ planType: plan, email: user.email ?? undefined, userId: user.uid, onSuccess: () => reloadSubscription() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // M04: settings live-apply via settingsStore.merge; persist split (syncStore + cloud).
  const settings = useSettingsStore((s) => s.settings);
  const mergeSettings = useSettingsStore((s) => s.merge);
  // Global light/dark appearance: mirror the persisted setting onto <html>.
  useEffect(() => { applyAppearance(settings.appearance); }, [settings.appearance]);

  // M04: plan-limit notice + pricing billing-period state.
  const [limitNoticeOpen, setLimitNoticeOpen] = useState(false);
  // Which item id has already triggered the over-cap notice + 'Free Limit' analytics.
  // With auto-save ON, save() runs every 15s; without this guard the over-limit branch
  // (which intentionally never markSaved()s, so dirty stays true) would re-pop the
  // dismissed LimitReachedNotice and re-fire the analytics envelope on every tick.
  // We notify once per cap-hit episode; it resets when a save actually succeeds.
  const limitNotifiedRef = useRef<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  // REQ-PST (M02 Task 16): library panel — items list from hook.
  const itemsState = useItems();
  const itemsOwned = itemsState.owner === (user?.uid ?? null);
  const items = itemsOwned ? itemsState.items : [];
  const itemsLoading = !itemsOwned || itemsState.loading;
  const library = useLibraryReader({ ...itemsState, uid: user?.uid ?? null });
  const fileImportBusy = useImportBusy();
  // REQ-LIB-6: folders for the library panel (sign-in gated; [] + no-op when signed-out).
  const { folders, loading: foldersLoading, error: foldersError, retry: retryFolders, createFolder, renameFolder, deleteFolder } = useFolders();

  // REQ-PRV-6: console entries accumulate across re-renders.
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  // Last auth provider now comes from useAuth (reactive, limited to Google/GitHub).

  // §11 keyboard shortcuts: Ctrl+L clears the console; Ctrl/Cmd+Shift+? opens the
  // keyboard-shortcuts help (REQ-KB-1). '?' is Shift+'/', so match either key form.
  useEffect(() => {
    // REQ-EMB-1: embed mode disables ALL global keyboard shortcuts. Don't register the
    // listener at all in embed so a shortcut can't open a modal that embed never renders.
    if (isEmbed) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && useUiStore.getState().fullscreen) {
        e.preventDefault();
        useUiStore.getState().toggleFullscreen();
        return;
      }
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setConsoleEntries([]); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void saveRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        useUiStore.getState().openModal('shortcuts');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEmbed]);

  // M04 one-time trigger: Support-pledge on version upgrade (REQ-MOD-3). On boot,
  // semver-compare the stored lastSeenVersion against APP_VERSION; if behind, open
  // the pledge. A first visit establishes the version baseline silently.
  useEffect(() => {
    // REQ-EMB-1: embed mode shows NO modals — skip the version-upgrade pledge trigger.
    if (isEmbed) return;
    void (async () => {
      const seen = await syncStore.get<string>(LS_KEYS.lastSeenVersion, '');
      // pledgeModalSeen latch (legacy parity: app.jsx:331 `!window.localStorage.
      // pledgeModalSeen`). A user MIGRATING from legacy who already dismissed the
      // pledge has pledgeModalSeen=true (set by legacy on dismiss) but a still-behind
      // lastSeenVersion (legacy bumps lastSeenVersion on initial use or
      // notification-click, NOT on pledge dismiss). Reading this flag prevents a
      // spurious one-time re-show to that already-served audience (REQ-MOD-3) and
      // makes pledgeModalSeen a live latch instead of dead state.
      const pledgeSeen = await localStore.get<boolean>(LS_KEYS.pledgeModalSeen, false);
      if (useUiStore.getState().activeModal) return; // don't replace another open modal
      if (pledgeSeen) return;
      // The pledge is an upgrade prompt. Establish a baseline silently for a new
      // user, so the first visit cannot be mistaken for an upgrade.
      if (!seen) {
        void syncStore.set(LS_KEYS.lastSeenVersion, APP_VERSION);
        return;
      }
      if (semverCompare(seen, APP_VERSION) < 0) {
        openModal('pledge');
        // Latch pledgeModalSeen at the moment the pledge OPENS (legacy parity:
        // app.jsx:334 sets window.localStorage.pledgeModalSeen = true right after
        // openSupportDeveloperModal()). Stamping on open — not only on dismiss —
        // means a user who reloads or closes the tab WITHOUT dismissing the pledge
        // is not re-shown it on the next boot (REQ-MOD-3 one-time prompt). Stays on
        // localStore to match legacy's window.localStorage (NOT chrome.storage.sync;
        // not in contract §7.2's sync-key list).
        void localStore.set(LS_KEYS.pledgeModalSeen, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: the signed-in user's settings are loaded ONCE on sign-in by useAuth's
  // onAuthChange handler (getUserSettings → settingsStore.merge). That IS the
  // load-once apply (OQ-5); no remote settings subscription. M04 only adds the
  // settings UI + the per-change persist split (handleSettingChange below).

  // Boot: load synced prefs UNCONDITIONALLY (adversarial review). Legacy reads
  // db.getSettings(defaultSettings) in componentDidMount, NOT gated by login
  // (app.jsx:220). handleSettingChange persists every change to syncStore — but
  // nothing read it back at startup, so a signed-out user's theme/fontSize/keymap/
  // preserveLastCode/etc. were silently discarded on reload (settingsStore re-inits
  // to DEFAULT_SETTINGS). This restores REQ-SET persistence parity for anonymous
  // users (and underpins preserveLastCode's synced boot behavior). For a signed-in
  // user this runs too, and useAuth's getUserSettings mergeCloud applies cloud values
  // as the authoritative layer. This loop uses mergeLocalBase, which only fills keys
  // cloud has NOT claimed — so cloud wins REGARDLESS of arrival order (adversarial
  // review: the prior plain `merge` had no ordering guarantee, so a cloud merge that
  // resolved first could be clobbered by this serial local loop key-by-key). Both
  // merges are key-wise so unknown keys are untouched.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
      const loaded: Partial<Settings> = {};
      for (const k of keys) {
        const v = await syncStore.get<Settings[typeof k] | undefined>(k, undefined);
        if (v !== undefined) (loaded as Record<string, unknown>)[k] = v;
      }
      if (!cancelled && Object.keys(loaded).length > 0) {
        useSettingsStore.getState().mergeLocalBase(loaded);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // REQ-PRV-4 (lazy transpile): plain CSS stays synchronous; transpiled modes
  // (scss/sass/less/stylus/acss) compute asynchronously into local state. For ACSS
  // the source is the HTML (atomizer scans markup for utility classes). Full
  // transpiled-mode rendering is verified by E2E when those modes are exercised.
  const [transpiledCss, setTranspiledCss] = useState(item?.css ?? '');
  // REQ-ED-7: transpile errors surface as inline lint markers in the CSS editor.
  const [cssErrors, setCssErrors] = useState<{ lineNumber: number; message: string }[]>([]);
  useEffect(() => {
    if (!item || item.cssMode === 'css') { setCssErrors([]); return; }
    let cancelled = false;
    computeCss(item.cssMode === 'acss' ? item.html : item.css, item.cssMode, item.cssSettings)
      .then((r) => { if (!cancelled) { setTranspiledCss(r.code); setCssErrors(r.errors ?? []); } })
      .catch((e) => { if (!cancelled) { setTranspiledCss(''); setCssErrors([{ lineNumber: 0, message: String(e) }]); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.css, item?.html, item?.cssMode, item?.cssSettings]);

  // State for the one-time "saved locally, sign in to sync" notice (signed-out first save)
  const [noticeOpen, setNoticeOpen] = useState(false);
  // REQ-LIB-8: surface a parse/import failure instead of swallowing it (advisor fix #6).


  // ItemService — created once, injects auth/online context lazily via getState()
  const itemService = useMemo(
    () => makeItemService(() => ({
      uid: useAuthStore.getState().user?.uid ?? null,
      online: useAuthStore.getState().online,
    })),
    [],
  );

  // Import-on-login: when the user signs in with local diagrams, offer to import them.
  const importPlanRetryArmed = useRef<string | null>(null);
  const {
    pending: importPending,
    count: importCount,
    doImport,
    dismiss: dismissImport,
    busy: importBusy,
    error: importErrorMessage,
    failedAction: importFailedAction,
    checkError: importCheckError,
    retryCheck: retryImportCheck,
  } = useImportOnLogin(useCallback((records, guard) => {
    if (!guard) throw new ImportPreflightError('check');
    if (subLoading) {
      importPlanRetryArmed.current = guard.uid;
      throw new ImportPreflightError('check');
    }
    if (subLoadFailed && importPlanRetryArmed.current !== guard.uid) {
      importPlanRetryArmed.current = guard.uid;
      throw new ImportPreflightError('check');
    }
    const token = library.identity.current();
    return (async () => {
      let checkedSubscription = subscription;
      if (subLoadFailed) {
        try {
          checkedSubscription = await retrySubscriptionLoad(guard.uid);
        } catch {
          throw new ImportPreflightError('check');
        }
      }
      importPlanRetryArmed.current = null;
      let ownedIds: string[];
      try {
        ownedIds = await getUserItemIds(guard.uid);
      } catch {
        // A failed ownership read cannot prove the batch fits. Keep local records
        // intact and let the user retry when the count can be read.
        throw new ImportPreflightError('check');
      }
      if (token.uid !== guard.uid || !library.identity.isCurrent(token) || useAuthStore.getState().user?.uid !== guard.uid) {
        throw new Error('Account changed during import preflight');
      }
      if (isImportOverFileLimit({ subscription: checkedSubscription, ownedIds, importedIds: Object.keys(records) })) {
        throw new ImportPreflightError('quota');
      }
      await itemService.saveItems(records, {
        expectedUid: guard.uid,
        isCurrent: () => token.uid === guard.uid && library.identity.isCurrent(token),
      });
    })();
  }, [itemService, library.identity, subscription, subLoading, subLoadFailed, retrySubscriptionLoad]));

  // Read URL params reactively via TanStack Router so navigation (e.g. goHome) triggers a re-render.
  const search = useSearch({ from: indexRoute.id });
  const idParam = search.id ?? null;
  const viewParam = search.view ?? null;
  const shareToken = search['share-token'] ?? null;

  // Editor-as-landing (2026-06-13): the hub is now OPT-IN via ?view=diagrams.
  // Bare "/" falls through to useBootItem (resume last-code, else sample) — the
  // legacy landing behavior. id/share-token/embed still take precedence: a deep
  // link with both ?view=diagrams and ?id= opens the diagram, not the hub.
  const isHomeMode =
    viewParam === 'diagrams' && !idParam && !shareToken && !runtime.embedCode && !isEmbed;

  // Editor-as-landing telemetry: fire hub_opened{landing-param} once per hub ARRIVAL.
  // The ref guards against re-firing on incidental re-renders while already on the hub,
  // and goHome sets it true up-front so a breadcrumb-initiated arrival is attributed to
  // 'breadcrumb' only (not also 'landing-param'). Crucially we RE-ARM it on leaving the
  // hub, so a later return (e.g. browser Back to ?view=diagrams) counts as a fresh
  // arrival — otherwise hub demand is under-counted, an asymmetric bias against the hub.
  const hubLandingFired = useRef(false);
  useEffect(() => {
    if (isHomeMode) {
      if (!hubLandingFired.current) {
        hubLandingFired.current = true;
        track('hub_opened', { category: 'navigation', label: 'landing-param' });
      }
    } else {
      hubLandingFired.current = false; // left the hub → re-arm for the next arrival
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHomeMode]);

  // M05 (REQ-EMB-1): embed-by-value — ?embed&code=<inline DSL>. When present we render
  // the diagram BY VALUE (no Firestore read) by seeding a transient read-only item from
  // the inline code; the normal boot resolution is skipped (skipBoot) so getItem/
  // getSharedItem are never called. Shared embed (?embed&id=&share-token=) has no
  // embedCode and still flows through useBootItem (read-only shared item).
  const embedByValue = isEmbed && runtime.embedCode != null;

  // Boot: resolve the item to load (replaces the old STARTER seeding effect).
  // authReady gates resolution so a ?id= URL works for signed-in users (FIX 1 — boot race).
  const { shareError, clearShareError, itemError, clearItemError, shareStatus, retryShare } = useBootItem({
    idParam,
    shareToken,
    // Finding 1: full-app boot honours ?code= so the embed's "Open in ZenUML"
    // link (which forwards ?code=&title= WITHOUT ?embed) seeds the diagram in the
    // editable editor. Embed itself ignores this branch — its seed runs via the
    // skip=embedByValue path below — so we null it out when isEmbed.
    codeParam: isEmbed ? null : runtime.embedCode,
    codeTitle: isEmbed ? null : runtime.embedTitle,
    preserveLastCode,
    getItem: itemService.getItem,
    getSharedItem,
    getLastCode: () => localStore.get<Item | null>(LS_KEYS.code, null),
    // Editor-as-landing telemetry: one event per editor boot, tagged with how the
    // diagram was resolved. Skipped on the hub (boot is skipped when isHomeMode) and
    // on embed-by-value — so this fires only when the editor is the landing surface.
    onResolved: (bootKind) =>
      track('landed_in_editor', { category: 'navigation', label: bootKind }),
  // Hub: skip boot when on home — we don't want newItem() seeding a blank diagram there.
  }, authReady, isHomeMode || embedByValue);

  // M05 (REQ-EMB-1): seed the embed-by-value item from the inline DSL exactly once.
  // The item is read-only (embed has no save/auth UI) and never persisted. Runs
  // independently of authReady (no account needed to view an inline embed).
  const embedSeeded = useRef(false);
  useEffect(() => {
    if (!embedByValue || embedSeeded.current) return;
    embedSeeded.current = true;
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID() : `embed-${Date.now()}`;
    // Backward compat (adversarial review finding 3): legacy embed links carry a
    // JSON-encoded item in ?code=, not raw DSL. parseEmbedCode accepts both shapes.
    const payload = parseEmbedCode(runtime.embedCode ?? '', runtime.embedTitle ?? null);
    useEditorStore.getState().loadItem(migrateToPages({
      id,
      title: payload.title ?? 'Untitled',
      js: payload.js,
      css: payload.css, html: payload.html,
      // Finding 1 (adversarial review): honour the pre-processor modes the legacy
      // JSON item carried. Hardcoding cssMode:'css' rendered scss/less/etc. embeds
      // as raw source — the preview branch (item.cssMode === 'css' ? raw : transpiled)
      // only transpiles when the real mode survives here.
      htmlMode: payload.htmlMode, cssMode: payload.cssMode, jsMode: payload.jsMode,
      cssSettings: payload.cssSettings,
      pages: [], currentPageId: '',
      isReadOnly: true,
    } as Item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedByValue]);

  // Lifecycle: save last code on tab hide / window unload (REQ-PST)
  useEffect(() => {
    function persist() {
      const current = useEditorStore.getState().currentItem;
      // FIX 2: skip persisting read-only items so the next cold boot doesn't restore
      // an isReadOnly item into the last-code slot.
      if (current && !current.isReadOnly) itemService.saveLastCode(current);
    }
    function onVisibilityChange() {
      if (document.hidden) persist();
    }
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', persist);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [itemService]);

  async function save(): Promise<boolean> {
    const it = useEditorStore.getState().currentItem;
    if (!it || it.isReadOnly || saveAttempt.current) return false;
    const attempt = {};
    saveAttempt.current = attempt;
    const generation = saveGeneration.current;
    const uid = useAuthStore.getState().user?.uid ?? null;
    const online = useAuthStore.getState().online;
    const contextCurrent = () => saveGeneration.current === generation &&
      (useAuthStore.getState().user?.uid ?? null) === uid && useEditorStore.getState().currentItem?.id === it.id;
    const current = () => saveAttempt.current === attempt && contextCurrent();
    const guard = {expectedUid:uid, isCurrent:current};
    const itemToSave: Item = {...it, updatedOn:Date.now()};
    useEditorStore.getState().setSaving(true);
    setSaveFeedback({error:false, queued:false});
    track('saveBtnClick', {category:'ui', label:!uid ? 'not-logged-in' : itemToSave.id ? 'saved' : 'new'});
    try {
      // Preserve the legacy fail-open cap check, sampled before membership insertion.
      let overLimit = false;
      if (uid && online && !subLoading) {
        try {
          const ownedIds = await getUserItemIds(uid);
          overLimit = isOverFileLimit({subscription, ownedIds, itemId:itemToSave.id});
        } catch { /* count read failure must not withhold an otherwise valid save */ }
      }
      if (!current()) return false;
      if (uid && online && !overLimit) await ensureUser(uid);
      if (!current()) return false;
      const outcome = await itemService.setItem(itemToSave.id, itemToSave, {skipCloud:overLimit, guard});
      if (!current()) return false;
      if (overLimit) {
        // A local-only retry must never inherit a previous clean cloud-success label.
        useEditorStore.setState({dirty:true});
        setCloudConfirmed(false);
        setSaveFeedback({error:false, queued:false, withheld:true});
        if (limitNotifiedRef.current !== itemToSave.id) {
          limitNotifiedRef.current = itemToSave.id;
          setLimitNoticeOpen(true);
          track('Free Limit', {category:'3 diagrams limit', label:'Save'});
        }
        return false; // locally retained, deliberately not cloud-synced or clean
      }
      if (uid) {
        if (outcome?.status === 'queued') {
          // Preserve queued cloud persistence without blocking local feedback on an offline user read.
          void (async () => {
            await ensureUser(uid);
            if (contextCurrent()) await setItemForUser(uid, itemToSave.id);
          })().catch(() => {});
        } else {
          try { await setItemForUser(uid, itemToSave.id); } catch { /* membership best-effort */ }
        }
      }
      if (!current()) return false;
      limitNotifiedRef.current = null;
      setSaveFeedback({error:false, queued:outcome?.status === 'queued'});
      setCloudConfirmed(outcome?.status === 'cloud');
      // The saved snapshot owns this completion. Edits made while it waited stay dirty.
      if (useEditorStore.getState().currentItem === it) useEditorStore.getState().markSaved();
      if (!uid) {
        // Informational notice preferences are separate from document persistence.
        // If acknowledgement storage fails, defer the notice to a later successful save.
        try {
          const seen = await localStore.get<boolean>(LS_KEYS.loginAndSaveMessageSeen, false);
          if (!current()) return false;
          if (!seen) {
            await localStore.set(LS_KEYS.loginAndSaveMessageSeen, true);
            if (current()) setNoticeOpen(true);
          }
        } catch { /* the document remains successfully saved */ }
      }
      return outcome?.status !== 'queued';
    } catch {
      if (current()) setSaveFeedback({error:true, queued:false});
      return false;
    } finally {
      if (saveAttempt.current === attempt) {
        saveAttempt.current = null;
        useEditorStore.getState().setSaving(false);
      }
    }
  }

  // M04 §8: custom-CSS is Plus-only. Returns true if the attempted CSS change is
  // GATED (caller must NOT apply it). Anonymous → prompt sign-in (one-time notice);
  // signed-in non-Plus → open pricing. While the subscription is still loading the
  // change is HELD BACK without a modal: a Plus user mid-load must not be shown
  // pricing, and a free user must not get a Plus-only change applied (and saved)
  // just by acting before the plan resolves. Plus users edit freely.
  const cssHeldWhileLoading = useRef(false);
  useEffect(() => {
    if (subLoading || !cssHeldWhileLoading.current) return;
    cssHeldWhileLoading.current = false;
    if (useAuthStore.getState().user && !isPlus(subscription)) openModal('pricing');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openModal is a stable store action
  }, [subLoading, subscription]);

  function cssGated(): boolean {
    if (useEditorStore.getState().currentItem?.isReadOnly) return true;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      setLoginModalOpen(true); // anonymous → open sign-in (plan §8)
      // NOTE (adversarial review, REQ-ANL-1): no analytics emitted here. Legacy has
      // NO 'Free Limit' (or any) event on the custom-CSS gate — that envelope is
      // reserved for the '3 diagrams limit' storage cap. Emitting a custom-css
      // 'Free Limit' invented a payload with no legacy analog, polluting the
      // existing limit-reached segment. A dedicated custom-css gate event would be a
      // NEW analytics requirement (out of M04 scope) — deferred, not faked here.
      return true;
    }
    if (subLoading) {
      // Unresolved → hold the change back, no modal yet. The effect below opens
      // pricing once the plan resolves to non-Plus, so a free user still gets feedback.
      cssHeldWhileLoading.current = true;
      return true;
    }
    if (isPlus(subscription)) return false;
    openModal('pricing');
    // See note above: no legacy 'Free Limit' analog for the custom-CSS gate.
    return true;
  }

  // The CSS editor asks this BEFORE an edit lands, so a gated keystroke never
  // reaches the buffer (cssGated opens the sign-in / pricing modal).
  function cssEditAllowed(): boolean {
    return !cssGated();
  }

  function handleSetCss(css: string) {
    if (cssGated()) return;
    setCss(css);
  }

  function handleSetCssMode(mode: CssMode) {
    if (useEditorStore.getState().currentItem?.isReadOnly) return;
    // Custom (non-plain) CSS modes are Plus-only; plain 'css' is always allowed.
    if (mode !== 'css' && cssGated()) return;
    setCssMode(mode);
  }

  // M04: settings change — live-apply (settingsStore.merge) + persist split
  // (syncStore always; cloud when signed-in). REQ-SET-1/4, REQ-PST.
  function handleSettingChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    mergeSettings({ [key]: value } as Partial<Settings>);
    void syncStore.set(key, value);
    const uid = useAuthStore.getState().user?.uid;
    if (uid) void setUserSetting(uid, key, value).catch(() => {});
    // REQ-ANL-1: legacy category is 'ui' (app.jsx:989 trackEvent('ui',
    // 'updatePref-'+settingName, value)); the value is the label. Match the
    // envelope so updatePref-* reports keep matching after cutover (adversarial review).
    track('updatePref-' + key, { category: 'ui', label: String(value) });
  }

  // M04: Paddle checkout from the pricing modal. Non-logged-in upgrade → sign-in
  // first (close pricing; the header login affordance is the entry). Guarded by the
  // payment feature flag at the call site (pricing isn't reachable when off).
  function handleUpgrade(plan: PlanType) {
    if (plan === 'free' || plan === 'enterprise') return;
    const checkoutPlan = plan as CheckoutPlanType;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      // Defer to sign-in: capture the plan, close pricing, open the login dialog. The
      // null→user effect above resumes the Paddle checkout once authenticated.
      pendingCheckoutRef.current = checkoutPlan;
      closeModal();
      setLoginModalOpen(true);
      return;
    }
    openCheckout({
      planType: checkoutPlan,
      email: currentUser.email ?? undefined,
      userId: currentUser.uid,
      onSuccess: () => reloadSubscription(),
    });
  }

  // M04: manage plan → open the Paddle-hosted cancel URL in a new tab (REQ-SUB-4).
  function handleManagePlan() {
    const url = (subscription as { cancel_url?: string } | null)?.cancel_url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  // M04: Create-New → load the chosen template as a fresh owned item.
  function handleCreateNew(partial: Partial<Item>) {
    const base = useEditorStore.getState().currentItem;
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID() : String(Date.now());
    useEditorStore.getState().loadItem(migrateToPages({
      ...(base ?? {}),
      id,
      title: 'Untitled',
      js: '', css: '', html: '',
      htmlMode: 'html', cssMode: 'css', jsMode: 'js',
      pages: [], currentPageId: '',
      createdBy: undefined,
      isReadOnly: false,
      ...partial,
    } as Item));
    setActivePanel('editor');
  }

  // Create a diagram from a template payload AND open it in the editor (navigate to
  // ?id=). Shared by the CreateNewModal's onSelect and the hub's template quick-picks
  // so both paths create-and-open identically (the quick-picks must not reopen the
  // picker — a template click should land the user straight in the editor).
  function handleCreateAndOpen(partial: Partial<Item>) {
    handleCreateNew(partial);
    const newId = useEditorStore.getState().currentItem?.id;
    if (newId) void navigate({ to: '/', search: (prev) => ({
      id: newId,
      view: undefined,
      'share-token': prev['share-token'],
      embed: prev.embed,
      code: prev.code,
      title: prev.title,
      stickyOffset: prev.stickyOffset,
    }) });
  }

  // M02 Task 16: library panel handlers (presentational — ItemListStub receives these).
  // Hub: also navigates to /?id= so the URL reflects which diagram is open.
  function handleOpenItem(it: Item) {
    useEditorStore.getState().loadItem(migrateToPages(it));
    setActivePanel('editor');
    void navigate({ to: '/', search: (prev) => ({
      id: it.id,
      view: undefined,
      'share-token': prev['share-token'],
      embed: prev.embed,
      code: prev.code,
      title: prev.title,
      stickyOffset: prev.stickyOffset,
    }) });
  }

  // Create a blank diagram and open it in the editor (?id=). Shared by the hub's
  // New diagram and the editor toolbar's New, so both create the same document.
  function handleNewDiagram() {
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID() : String(Date.now());
    useEditorStore.getState().loadItem(migrateToPages({
      id: newId,
      title: 'Untitled',
      js: '', css: '', html: '',
      htmlMode: 'html', cssMode: 'css', jsMode: 'js',
      pages: [], currentPageId: '',
      isReadOnly: false,
    } as Item));
    setActivePanel('editor');
    // The blank diagram is not the shared or ?code=-seeded one: drop those params
    // so a reload does not look the new id up as a share or re-seed the old code.
    void navigate({ to: '/', search: (prev) => ({
      id: newId,
      view: undefined,
      'share-token': undefined,
      embed: prev.embed,
      code: undefined,
      title: undefined,
      stickyOffset: prev.stickyOffset,
    }) });
  }

  // Editor-as-landing: return to the hub by setting ?view=diagrams (and clearing
  // the editor params). Previously this cleared everything to bare "/", which now
  // lands in the editor.
  function goHome() {
    track('hub_opened', { category: 'navigation', label: 'breadcrumb' });
    // Mark the landing-param event consumed: navigating here flips isHomeMode true and
    // re-runs the landing effect on the still-mounted AppRoot. Without this, a breadcrumb
    // click would ALSO emit hub_opened{landing-param}, corrupting the source dimension.
    hubLandingFired.current = true;
    void navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        view: 'diagrams',
        id: undefined,
        'share-token': undefined,
        embed: undefined,
        code: undefined,
        title: undefined,
        stickyOffset: undefined,
      }),
    });
  }

  // first_edit: fires once per mount on the first user-initiated DSL change.
  // Wraps setDsl so the event emits from AppRoot's boundary (not from the store
  // action). CSS/HTML editors use separate handlers and are NOT tracked here.
  const firstEditFired = useRef(false);
  function handleDslChange(next: string) {
    if (useEditorStore.getState().currentItem?.isReadOnly) return;
    if (!firstEditFired.current) {
      firstEditFired.current = true;
      track('first_edit', { category: 'fn' });
    }
    setDsl(next);
  }

  async function handleDeleteItem(id: string) {
    await itemService.removeItem(id);
    const uid = useAuthStore.getState().user?.uid;
    if (uid) {
      try { await unsetItemForUser(uid, id); } catch { /* best-effort */ }
    }
  }

  // M03 Task 14: remaining library handlers (open/delete are above).
  function handleForkItem(it: Item) {
    // Load the chosen item, then fork it into an owned, editable copy (forkCurrent
    // clears createdBy + isReadOnly). Switch to the editor so the fork is visible.
    useEditorStore.getState().loadItem(migrateToPages(it));
    useEditorStore.getState().forkCurrent();
    const fork = useEditorStore.getState().currentItem;
    setActivePanel('editor');
    if (fork) void navigate({ to: '/', search: (prev) => ({
      id: fork.id, view: undefined, 'share-token': undefined, code: undefined, title: undefined,
      embed: prev.embed, stickyOffset: prev.stickyOffset,
    }) });
  }

  // Move-to-folder passes the HELD item (advisor fix B) — never re-fetch from
  // localStore, which is empty for cloud-only items delivered by onSnapshot.
  async function handleMoveItem(it: Item, folderId: string | null) {
    await itemService.moveToFolder(it, folderId);
  }

  function handleExportAll() {
    return runExportAll({
      identity: library.identity,
      getItems: library.getLibraryItems,
      download: (name, json) => downloadText(name, json, 'application/json'),
      onStart: () => track('exportItems', { category: 'fn' }),
    });
  }

  function handleExportHtml(it: Item) {
    const html = buildStandaloneHtml(it);
    const safe = (it.title || 'diagram').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    downloadText(`${safe}.html`, html, 'text/html');
  }

  async function handleImport(text: string, context?: ImportFileContext) {
    await runImport(text, {
      existingIds: library.getExistingIds,
      identity: library.identity,
      token: context?.token,
      saveItems: (records, guard) => itemService.saveItems(records, guard),
      onItemsAdded: (count) => track('itemsImported', { category: 'fn', label: String(count) }),
    });
  }

  // REQ-SHR-1/2/5: share the CURRENT item. Read the id via getState() so a fresh
  // save (which may rotate nothing but keeps the same id) is always reflected.
  const share = useShare({
    // Reactive id so url/error reset when the user switches items (advisor fix #8).
    itemId: item?.id ?? null,
    getItemId: () => useEditorStore.getState().currentItem?.id ?? null,
    createShare,
    stopSharing: itemService.stopSharing,
    onBeforeShare: async () => {
      // Sharing requires a confirmed save; manual/automatic save failures stay handled.
      if (!await save()) throw new Error('Save the diagram before creating its shared link.');
    },
  });

  // ShareButton rules (#4): the only DEAD-disabled case is a read-only item (a
  // shared/embed copy can't be re-shared). The two cases that were previously
  // silently-disabled are now live actions:
  //   - signed-out  → requiresAuth: clicking Share opens the login modal (createShare
  //     needs a signed-in ID token). After sign-in the button shares normally.
  //   - signed-in + never-saved → enabled: useShare.share() runs onBeforeShare (=save)
  //     before createShare, so it saves-then-shares with no extra wiring.
  const shareReadOnly = !!item?.isReadOnly;
  const shareRequiresAuth = !shareReadOnly && !user;

  // REQ-PRV-3: stickyOffset comes from the HOST's real URL (the main app is at the
  // real location; only the iframe is srcdoc). validateSearch already coerces to Number.
  const stickyOffset = search.stickyOffset ?? 0;

  // ─── M05 (RM-2 / REQ-EMB-1): embed branch ────────────────────────────────────
  // A minimal, read-mostly view: NO main header, NO sidebar, NO modals, shortcuts off
  // (gated above). Only the embed header + the preview render. The "Open in ZenUML"
  // link reproduces the diagram in the full editor at the canonical app origin:
  //  - by-value embed (?code/?title)  → ${origin}/?code=<dsl>&title=<title>
  //  - shared embed   (?id/?share-token) → ${origin}/?id=<id>&share-token=<token>
  // Placed BEFORE the `if (!item)` guard but AFTER all hooks ran, so hook order is
  // stable (every useEffect/useShare/etc. is above this point).
  if (isEmbed) {
    const openUrl = (() => {
      const q = new URLSearchParams();
      if (embedByValue) {
        q.set('code', runtime.embedCode ?? '');
        if (runtime.embedTitle) q.set('title', runtime.embedTitle);
      } else if (runtime.itemId && runtime.shareToken) {
        q.set('id', runtime.itemId);
        q.set('share-token', runtime.shareToken);
      } else if (runtime.itemId) {
        q.set('id', runtime.itemId);
      }
      const query = q.toString();
      return query ? `${CANONICAL_APP_ORIGIN}/?${query}` : `${CANONICAL_APP_ORIGIN}/`;
    })();

    return (
      <div data-testid="embed-root" className="flex flex-col h-full w-full surface-paper">
        <EmbedHeader title={item?.title ?? runtime.embedTitle ?? undefined} openUrl={openUrl} />
        {/* Render the diagram on paper inside a hairline + shadow card so the embed
            reads as an intentional framed surface, not an unstyled white box on cream.
            PreviewFrame posts a 'contentSize' message after each render (embed-only)
            and sets an explicit pixel width + height on the iframe, so the card
            (width/height:auto, i.e. shrink-to-fit) hugs the diagram on both axes.
            The wrapper's items-center/justify-center centers the card in both axes.
            max-w/max-h cap + overflow-auto ensure a large diagram scrolls rather than
            bleeding beyond the viewport. */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          {item ? (
            <div className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] rounded-lg border border-paper-line bg-paper-50 shadow-pop overflow-auto">
              <PreviewFrame
                ref={previewRef}
                code={item.js}
                css={item.cssMode === 'css' ? item.css : transpiledCss}
                stickyOffset={stickyOffset}
                autoPreview={settings.autoPreview}
              />
            </div>
          ) : (
            // REQ-EMB: a bad ?code/?id leaves item null. Surface an on-paper empty
            // state (serif display face + onlight tokens, matching the modal empty
            // states) instead of returning null and stranding the user on blank cream.
            <div
              data-testid="embed-empty"
              className="mx-auto max-w-md rounded-lg border border-paper-line bg-paper-50 shadow-pop px-8 py-10 text-center"
            >
              <h2 className="font-serif text-[22px] leading-tight text-onlight-strong">
                Diagram unavailable
              </h2>
              <p className="mt-2 text-[13px] text-onlight-muted">
                This embedded diagram could not be loaded. The link may be broken or the
                diagram is no longer shared.
              </p>
              <a
                data-testid="embed-empty-link"
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center h-8 px-3 rounded text-[13px] font-medium bg-accent-press text-white hover:bg-accent ring-draft shadow-inset"
              >
                Open ZenUML
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Hub: home mode — render the library grid; no item is needed here. All modals that
  // can fire from the home view (CreateNew, Settings, Login) are included so they remain
  // accessible even though AppHeader (which normally hosts them) is absent.
  if (isHomeMode) {
    return (
      <div className="flex flex-col h-full w-full">
        <SavedOnDeviceModal
          open={noticeOpen}
          onOpenChange={setNoticeOpen}
          onSignIn={() => setLoginModalOpen(true)}
        />
        <LibraryFeedback onImport={handleImport} onExportAll={handleExportAll} />
        <AskToImportModal
          open={importPending || importCheckError != null}
          onOpenChange={(o) => { if (!o) void dismissImport(); }}
          count={importCount}
          busy={importBusy}
          error={importErrorMessage}
          failedAction={importFailedAction}
          checkError={importCheckError}
          onRetryCheck={() => void retryImportCheck()}
          onImport={() => void doImport()}
          onDismiss={() => void dismissImport()}
        />
        <SettingsModal
          open={activeModal === 'settings'}
          onOpenChange={(o) => { if (!o) closeModal(); }}
          settings={settings}
          onChange={handleSettingChange}
          isExtension={detectFromEnv().isExtension}
        />
        <CreateNewModal
          open={activeModal === 'createNew'}
          onOpenChange={(o) => { if (!o) closeModal(); }}
          onSelect={handleCreateAndOpen}
        />
        <HelpModal
          open={activeModal === 'help'}
          onOpenChange={(o) => { if (!o) closeModal(); }}
          version={APP_VERSION}
        />
        {paymentEnabled && (
          <PricingModal
            open={activeModal === 'pricing'}
            onOpenChange={(o) => { if (!o) closeModal(); }}
            currentPlanType={planType}
            billingPeriod={billingPeriod}
            onPeriodChange={setBillingPeriod}
            onUpgrade={handleUpgrade}
            onContactEnterprise={() => window.open('https://zenuml.com/docs/about/contact-us', '_blank', 'noopener')}
          />
        )}
        <LoginModal
          open={loginModalOpen}
          onOpenChange={handleLoginOpenChange}
          onLogin={(provider) => { track('loggedIn', { category: 'fn', label: provider }); return login(provider); }}
          lastProvider={lastProvider}
          error={loginError}
          pendingProvider={pendingProvider}
          onOpenPricing={paymentEnabled ? () => { handleLoginOpenChange(false); openModal('pricing'); } : undefined}
        />
        <HomeView
          items={items}
          itemsLoading={itemsLoading}
          itemsError={itemsOwned && !!itemsState.error}
          onRetryItems={() => { itemsState.retry(); }}
          folders={folders}
          foldersLoading={foldersLoading}
          foldersError={foldersError}
          onRetryFolders={() => void retryFolders()}
          profile={{ subscribed, planType, paymentEnabled, onUpgrade: () => openModal('pricing'), onOpenPricing: () => openModal('pricing'), onManagePlan: handleManagePlan }}
          user={user}
          onOpen={handleOpenItem}
          onNewDiagram={handleNewDiagram}
          onBrowseTemplates={() => openModal('createNew')}
          onCreateFromTemplate={handleCreateAndOpen}
          onOpenSignIn={() => setLoginModalOpen(true)}
          onLogout={() => { track('loggedOut', { category: 'fn' }); logout(); }}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onDeleteItem={handleDeleteItem}
          onForkItem={handleForkItem}
          onMoveItem={handleMoveItem}
          onExportHtml={handleExportHtml}
          onExportAll={handleExportAll}
          onImport={handleImport}
          onImportFile={(file) => readImportFile(file, handleImport)}
          importPending={fileImportBusy}
          appearance={settings.appearance}
          onToggleAppearance={() => handleSettingChange('appearance', settings.appearance === 'dark' ? 'light' : 'dark')}
          reportBug={
            <ReportBugButton
              placement="inline"
              dsl=""
              appVersion={APP_VERSION}
              view="hub"
              signedIn={!!user}
              onOpen={() => track('bug_report_opened', { category: 'feedback', label: 'hub' })}
              onSubmitted={({ includedDsl }) =>
                track('bug_report_submitted', { category: 'feedback', label: 'hub', included_dsl: includedDsl })
              }
            />
          }
          readOnly={!user}
        />
      </div>
    );
  }

  // Shared-link visitor: a pending read or a temporary failure gets a real status
  // view (loading / Try again) instead of a blank screen. Explicitly unavailable
  // links fall through to ShareErrorNotice below. Both apply even when the store
  // still holds another item (browser Back from an owned diagram), so no other
  // document is ever shown under a share URL.
  if (shareStatus === 'loading' || shareStatus === 'retryable-error') {
    return (
      <ShareVisitorStatus
        status={shareStatus}
        onRetry={retryShare}
        appearance={settings.appearance}
        onToggleAppearance={() => handleSettingChange('appearance', settings.appearance === 'dark' ? 'light' : 'dark')}
        onGoHome={goHome}
        user={user}
        onLogout={() => { track('loggedOut', { category: 'fn' }); logout(); }}
        // No billing items here: PricingModal is only mounted with the editor/hub.
        profile={{ subscribed, planType, paymentEnabled: false }}
        login={{
          open: loginModalOpen,
          onOpenChange: handleLoginOpenChange,
          onLogin: (provider) => { track('loggedIn', { category: 'fn', label: provider }); return login(provider); },
          lastProvider,
          error: loginError,
          pendingProvider,
        }}
        editorCollapsed={editorCollapsed && !isMobile}
        onToggleEditor={isMobile ? undefined : toggleEditorCollapsed}
        sourceFooter={
          <ReportBugButton
            placement="inline"
            dsl=""
            appVersion={APP_VERSION}
            view="shared-link"
            signedIn={!!user}
            onOpen={() => track('bug_report_opened', { category: 'feedback', label: 'shared-link' })}
            onSubmitted={({ includedDsl }) =>
              track('bug_report_submitted', { category: 'feedback', label: 'shared-link', included_dsl: includedDsl })
            }
          />
        }
      />
    );
  }
  // REQ-SHR-4: a dead boot share-link seeds NO item (currentItem stays null), so
  // surface the error here at the guard instead of silently returning null. Start
  // fresh clears the flag and seeds a blank diagram.
  if (!item || shareError || itemError) {
    if (shareError) {
      return (
        <ShareErrorNotice
          open
          // Every exit abandons the unavailable URL without creating an editable document.
          onOpenChange={(o) => { if (!o) { goHome(); clearShareError(); } }}
          onGoHome={() => { goHome(); clearShareError(); }}
        />
      );
    }
    if (itemError) {
      return (
        <ShareErrorNotice
          open
          title="This diagram can't be opened"
          message="It is not stored on this device. Sign in with the account that owns it, or ask for a share link."
          onOpenChange={(o) => { if (!o) { goHome(); clearItemError(); } }}
          onGoHome={() => { goHome(); clearItemError(); }}
        />
      );
    }
    return null;
  }

  // item is non-null here — the isHomeMode and !item early returns above guard this.
  const previewCss = item.cssMode === 'css' ? item.css : transpiledCss;

  // Editor chrome driven by the user's Settings (REQ-SET). The Settings modal writes
  // these via handleSettingChange → settingsStore; thread them into BOTH CodeEditors
  // so theme/font/size/keymap changes actually take effect (they were previously
  // no-ops — the editors fell back to component defaults). The font field carries the
  // sentinel 'other' when a custom family is in use; resolve it to the real family
  // (literal 'other' is not a CSS font and would silently fall back to FiraCode).
  const editorFontFamily =
    settings.editorFont === 'other' ? settings.editorCustomFont : settings.editorFont;

  // Signed-out save state: itemService writes every save to localStore under the
  // item id, so "Saved locally" is only claimed once that record exists. Re-read on
  // each render; markSaved()/dirty changes re-render after every save.
  const savedLocally = (() => {
    try { return window.localStorage.getItem(item.id) !== null; } catch { return false; }
  })();

  return (
    <div data-testid="editor-shell" className="editor-hifi-shell flex flex-col h-full w-full">
      {/* One-time "saved locally" notice for signed-out users (REQ-PST) */}
      <SavedOnDeviceModal
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        onSignIn={() => setLoginModalOpen(true)}
      />
      {/* REQ-LIB-8: surface a malformed-import error (advisor fix #6). */}
      {/* Import local diagrams after login (REQ-AC) */}
      <AskToImportModal
        open={importPending || importCheckError != null}
        onOpenChange={(o) => { if (!o) void dismissImport(); }}
        count={importCount}
        busy={importBusy}
        error={importErrorMessage}
        failedAction={importFailedAction}
        checkError={importCheckError}
        onRetryCheck={() => void retryImportCheck()}
        onImport={() => void doImport()}
        onDismiss={() => void dismissImport()}
      />

      {/* M04 modal inventory — single-modal state via uiStore.activeModal. */}
      <SettingsModal
        open={activeModal === 'settings'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
        settings={settings}
        onChange={handleSettingChange}
        // Extension-only controls (Replace new tab page) render ONLY in the extension;
        // inert on the web app (adversarial review). detectFromEnv reads chrome-extension:
        // protocol / window.IS_EXTENSION — the same gate analytics uses.
        isExtension={detectFromEnv().isExtension}
      />
      <CreateNewModal
        open={activeModal === 'createNew'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
        onSelect={handleCreateNew}
      />
      <HelpModal
        open={activeModal === 'help'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
        version={APP_VERSION}
      />
      <KeyboardShortcutsModal
        open={activeModal === 'shortcuts'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
      />
      <SupportPledgeModal
        open={activeModal === 'pledge'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
        version={APP_VERSION}
        onDismiss={() => {
          // pledgeModalSeen stays on localStore (legacy uses window.localStorage:
          // app.jsx:334, NOT chrome.storage.sync). lastSeenVersion goes to syncStore
          // to match legacy db.sync (db.js:131-140) + contract §7.2 — see the boot
          // effects above. The two backends are identical on web (syncStore falls
          // back to localStorage); the split matters only in the extension.
          void localStore.set(LS_KEYS.pledgeModalSeen, true);
          void syncStore.set(LS_KEYS.lastSeenVersion, APP_VERSION);
          track('pledgeModalSeen', { category: 'ui', label: APP_VERSION });
          closeModal();
        }}
      />
      {item && (
        <AtomicCssSettingsModal
          open={activeModal === 'acss'}
          onOpenChange={(o) => { if (!o) closeModal(); }}
          value={(item.cssSettings as CssSettings | undefined) ?? {}}
          onChange={(next) => { useEditorStore.getState().setCssSettings(next); closeModal(); }}
        />
      )}
      {paymentEnabled && (
        <PricingModal
          open={activeModal === 'pricing'}
          onOpenChange={(o) => { if (!o) closeModal(); }}
          currentPlanType={planType}
          billingPeriod={billingPeriod}
          onPeriodChange={setBillingPeriod}
          onUpgrade={handleUpgrade}
          onContactEnterprise={() => window.open('https://zenuml.com/docs/about/contact-us', '_blank', 'noopener')}
        />
      )}
      <LimitReachedNotice
        open={limitNoticeOpen}
        onOpenChange={setLimitNoticeOpen}
        limit={limitFor(subscription)}
        onUpgrade={() => { setLimitNoticeOpen(false); if (paymentEnabled) openModal('pricing'); }}
      />

      <AppHeader
        title={item.title ?? ''}
        unsavedCount={unsavedCount}
        dirty={dirty}
        saving={saving}
        saveError={saveFeedback.error}
        syncPending={saveFeedback.queued}
        cloudWithheld={saveFeedback.withheld}
        cloudConfirmed={cloudConfirmed}
        onRetrySave={() => void save()}
        savedLocally={savedLocally}
        onPresent={toggleFullscreen}
        user={user}
        lastProvider={lastProvider}
        readOnly={!!item.isReadOnly}
        onTitleChange={setTitle}
        onNew={handleNewDiagram}
        onFork={() => handleForkItem(item)}
        onLogin={(provider) => { track('loggedIn', { category: 'fn', label: provider }); return login(provider); }}
        onLogout={() => { track('loggedOut', { category: 'fn' }); logout(); }}
        loginError={loginError}
        pendingProvider={pendingProvider}
        loginOpen={loginModalOpen}
        onLoginOpenChange={handleLoginOpenChange}
        subscribed={subscribed}
        planType={planType}
        paymentEnabled={paymentEnabled}
        onUpgrade={() => openModal('pricing')}
        onManagePlan={handleManagePlan}
        onOpenPricing={() => openModal('pricing')}
        onGoHome={goHome}
        // Desktop only: mobile already switches Edit | Preview with its tabs.
        editorCollapsed={editorCollapsed}
        onToggleEditor={isMobile ? undefined : toggleEditorCollapsed}
        appearance={settings.appearance}
        onToggleAppearance={() => handleSettingChange('appearance', settings.appearance === 'dark' ? 'light' : 'dark')}
        actions={!item.isReadOnly &&
          <ShareButton
            disabled={shareReadOnly}
            disabledReason="This is a read-only copy — duplicate it to share"
            requiresAuth={shareRequiresAuth}
            onRequireAuth={() => setLoginModalOpen(true)}
            url={share.url}
            sharing={share.sharing}
            error={share.error}
            copied={share.copied}
            stopping={share.stopping}
            failure={share.failure}
            copyFailed={share.copyFailed}
            onShare={() => { track('shareLink', { category: 'ui' }); void share.share(); }}
            onStop={() => void share.stop()}
            onCopy={() => void share.copy()}
          />
        }
      />
      <div className="flex flex-1 min-h-0 w-full">
        {/* Hub model (Approach A): "no rail" — Library is the Home page, the editor is
            focused. The Sidebar icon rail (Editor/Library/Templates) is intentionally
            absent; navigation back to the library uses the "← Your diagrams" breadcrumb. */}
        <Layout
          presenting={fullscreen}
          editorCollapsed={editorCollapsed && !isMobile}
          editor={
            (
            <div className="editor-source-pane relative flex flex-col h-full">
              {/* Page tabs now live on the RENDERER side (preview slot), above the
                  diagram — pages are a property of the rendered document, not the DSL
                  (per design §02). The editor pane just edits whichever page is active. */}
              {/* The DSL editor fills the column (no redundant heading). The CSS pane
                  is a collapsible CssPanel row at the bottom ("Custom CSS" + Report a
                  bug), expanding to the editor + its pre-processor Select. CSS modes
                  are live (computeCss feeds previewCss); the DSL is rendered by
                  @zenuml/core and has no JS pre-processor, so no js-mode Select. */}
              <div className="editor-source-stack flex flex-1 min-h-0 flex-col">
                <div className="flex-1 min-h-0"><CodeEditor key={`dsl-${item.currentPageId}`} value={item.js} language="dsl" readOnly={!!item.isReadOnly} onChange={handleDslChange} testId="dsl-editor" themeId={settings.editorTheme} fontSize={settings.fontSize} fontFamily={editorFontFamily} keymap={settings.keymap} indentWith={settings.indentWith} indentSize={settings.indentSize} /></div>
              </div>
              {/* Shared code theme + font size for the DSL and CSS editors: one slot at
                  the bottom of this workspace, revealed on demand. */}
              {!item.isReadOnly && <CodeAppearanceBar
                appearance={settings.appearance}
                themeId={settings.editorTheme}
                fontSize={settings.fontSize}
                onThemeChange={(id) => handleSettingChange('editorTheme', id)}
                onFontSizeChange={(size) => handleSettingChange('fontSize', size)}
              />}
              {/* CSS pane → collapsible strip. Re-keyed per page so the collapsed
                  default re-derives from the new page's CSS emptiness (matches the
                  DSL editor's per-page remount). The pre-processor Select + acss
                  config button are passed as headerControls — untouched, still live. */}
              <CssPanel
                key={`css-panel-${item.currentPageId}`}
                isEmpty={!item.css || item.css.trim().length === 0}
                trailing={
                  <>
                  {/* Help: the existing Help dialog, between Custom CSS and Report a bug. */}
                  <button
                    type="button"
                    data-testid="footer-help"
                    onClick={() => openModal('help')}
                    className="editor-footer-help"
                  >
                    Help
                  </button>
                  <ReportBugButton
                    placement="inline"
                    dsl={item.js ?? ''}
                    appVersion={APP_VERSION}
                    view="editor"
                    signedIn={!!user}
                    onOpen={() => track('bug_report_opened', { category: 'feedback', label: 'editor' })}
                    onSubmitted={({ includedDsl }) =>
                      track('bug_report_submitted', { category: 'feedback', label: 'editor', included_dsl: includedDsl })
                    }
                  />
                  </>
                }
                headerControls={!item.isReadOnly &&
                  <>
                    {/* ACSS mode: the CSS editor is read-only (atomizer scans HTML); the
                        Atomizer config is edited via this affordance (REQ-ED-2). */}
                    {item.cssMode === 'acss' && (
                      <Button
                        size="sm"
                        variant="subtle"
                        surface="light"
                        className="editor-css-acss-button"
                        data-testid="acss-settings-open"
                        onClick={() => openModal('acss')}
                      >
                        Atomic CSS config
                      </Button>
                    )}
                    <Select value={item.cssMode} onValueChange={(v) => handleSetCssMode(v as CssMode)}>
                      <SelectTrigger
                        data-testid="css-mode-select"
                        aria-label="CSS pre-processor mode"
                        surface={settings.appearance}
                        className="editor-css-mode-select h-7"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent surface={settings.appearance} className="editor-hifi-select-menu">
                        {CSS_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                }
              >
                <CodeEditor key={`css-${item.currentPageId}`} value={item.css} language="css" onChange={handleSetCss} editGuard={cssEditAllowed} testId="css-editor" readOnly={!!item.isReadOnly || item.cssMode === 'acss'} diagnostics={cssErrors} themeId={settings.editorTheme} fontSize={settings.fontSize} fontFamily={editorFontFamily} keymap={settings.keymap} indentWith={settings.indentWith} indentSize={settings.indentSize} />
              </CssPanel>
            </div>
            )
          }
          preview={
            <div className={fullscreen ? 'fixed inset-0 z-50 surface-paper flex flex-col' : 'editor-preview-stage relative h-full flex flex-col'}>
              <div className={fullscreen ? 'editor-preview-panel editor-preview-panel--fullscreen flex flex-col h-full' : 'editor-preview-panel flex flex-col h-full'}>
              {/* Renderer header (diagram side): page tabs + download/refresh/zoom.
                  In Present (fullscreen) mode the chrome is hidden — only an Exit
                  affordance remains so the diagram presents clean. */}
              {fullscreen ? (
                <Button
                  data-testid="preview-fullscreen"
                  onClick={toggleFullscreen}
                  surface="light"
                  variant="subtle"
                  size="sm"
                  className="absolute right-2 top-2 z-10"
                >
                  Exit
                </Button>
              ) : (
                <RendererHeader
                  appearance={settings.appearance}
                  onDownload={openExport}
                  // Zoom applies to the desktop HTML preview. The mobile SVG preview
                  // already fits its width natively, so it shows no zoom group.
                  zoom={isMobile ? undefined : {
                    label: formatZoom(zoomScale),
                    onFitWidth: () => setPreviewZoom({ kind: 'fit-width' }),
                    onFitHeight: () => setPreviewZoom({ kind: 'fit-height' }),
                    onFitDiagram: () => setPreviewZoom({ kind: 'fit' }),
                    onZoomOut: () => setPreviewZoom(zoomOut(zoomScale)),
                    onZoomIn: () => setPreviewZoom(zoomIn(zoomScale)),
                    onActualSize: () => setPreviewZoom(ACTUAL_SIZE),
                  }}
                  // #824: surface a manual Refresh ONLY when auto-preview is off, so the
                  // default UI (auto-preview on) is unchanged. Forces a one-shot render.
                  onRefresh={settings.autoPreview ? undefined : () => previewRef.current?.render()}
                  pageTabs={
                    <PageTabs
                      surface="light"
                      appearance={settings.appearance}
                      pages={item.pages ?? []}
                      currentPageId={item.currentPageId ?? ''}
                      onSwitch={switchPageAction}
                      onAdd={addPageAction}
                      onDelete={deletePageAction}
                      onRename={renamePageAction}
                      readOnly={!!item.isReadOnly}
                    />
                  }
                />
              )}
              <div className="editor-preview-canvas flex-1 min-h-0 flex items-center justify-center">
                <PreviewFrame
                  ref={previewRef}
                  code={item.js}
                  readOnly={!!item.isReadOnly}
                  css={previewCss}
                  // Dark appearance renders the diagram with core's native dark theme;
                  // ExportDialog reads the same theme from the export snapshot.
                  theme={previewThemeFor(settings.appearance, item.css)}
                  zoom={isMobile ? ACTUAL_SIZE : previewZoom}
                  onZoomChange={setZoomScale}
                  // #824: gate the debounced auto re-render on the Settings toggle. When
                  // OFF, edits don't re-render until the manual Refresh control fires.
                  autoPreview={settings.autoPreview}
                  // Present (fullscreen) mode: scale-to-fit + center the diagram
                  // (CSS transform; @zenuml/core untouched).
                  fit={fullscreen}
                  onExitPresentation={() => {
                    if (useUiStore.getState().fullscreen) useUiStore.getState().toggleFullscreen();
                  }}
                  // Mobile editor preview: native SVG fit-to-width (see isMobile above).
                  svgMode={isMobile && !fullscreen}
                  stickyOffset={stickyOffset}
                  onCodeChange={handleDslChange}
                  onConsole={(e) => setConsoleEntries((prev) => [...prev, e])}
                  onError={(m) => setConsoleEntries((p) => [...p, { level: 'error', args: [m] }])}
                />
              </div>
              {/* Fix 2 (partial): hide the debug console in fullscreen — fullscreen is a
                  presentation surface, and the docked console band leaks low-contrast
                  debug chrome into it (audit Fix 2 / remediation board). */}
              {!fullscreen && (
                <Console
                  open={consoleOpen}
                  entries={filterStarterNoise(consoleEntries)}
                  onClear={() => setConsoleEntries([])}
                  onEval={(expr) => previewRef.current?.evalConsole(expr).then((r) => setConsoleEntries((p) => [...p, { level: r.ok ? 'log' : 'error', args: [String(r.value)] }]))}
                  onToggle={toggleConsole}
                />
              )}
              </div>
            </div>
          }
        />
      </div>
      <ExportDialog
        open={exportRequest !== null}
        onOpenChange={(open) => { if (!open) setExportRequest(null); }}
        snapshot={exportRequest?.snapshot ?? null}
        title={exportRequest?.title ?? 'diagram'}
        onExported={(format) => track(format === 'png' ? 'downloadPng' : 'downloadSvg', { category: 'ui' })}
      />
    </div>
  );
}
