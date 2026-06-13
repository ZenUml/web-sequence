import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { indexRoute } from './router';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle } from '../preview/PreviewFrame';
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
import { CssPanel } from '../components/editor/CssPanel';
import { AppHeader } from '../components/header/AppHeader';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { AskToImportModal } from '../components/modals/AskToImportModal';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useBootItem } from '../hooks/useBootItem';
import { useAutoSave } from '../hooks/useAutoSave';
import { useImportOnLogin } from '../hooks/useImportOnLogin';
import { makeItemService } from '../services/itemService';
import { getSharedItem, createShare } from '../services/cloudFunctions';
import { ensureUser, setItemForUser, unsetItemForUser, getUserItemIds, setUserSetting } from '../services/userService';
import { localStore, syncStore } from '../services/storage';
import { LS_KEYS, APP_VERSION } from '../config/constants';
import type { ProviderName } from '../services/types';
import { useItems } from '../hooks/useItems';
import { useFolders } from '../hooks/useFolders';
import { useShare } from '../hooks/useShare';
import { migrateToPages } from '../domain/item';
// LibraryPanel removed — Library is now the Home page (isHomeMode), not a side panel.
import { ShareButton } from '../components/share/ShareButton';
import { ShareErrorNotice } from '../components/modals/ShareErrorNotice';
import { exportAllItemsJson, parseImportJson, buildStandaloneHtml } from '../services/exportImport';
import { downloadText } from '../services/download';
// M04 — subscription / settings / modals / analytics
import { useSubscription } from '../hooks/useSubscription';
import { useAnalytics } from '../hooks/useAnalytics';
import { usePaddle, type CheckoutPlanType } from '../hooks/usePaddle';
import { isOverFileLimit, limitFor } from '../domain/planLimit';
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
import { CheatSheetModal } from '../components/modals/CheatSheetModal';
import { KeyboardShortcutsModal } from '../components/modals/KeyboardShortcutsModal';
import { OnboardingModal } from '../components/modals/OnboardingModal';
import { SupportPledgeModal } from '../components/modals/SupportPledgeModal';
import { AtomicCssSettingsModal, type CssSettings } from '../components/modals/AtomicCssSettingsModal';
import { PricingModal, type BillingPeriod } from '../components/subscription/PricingModal';
import { LimitReachedNotice } from '../components/subscription/LimitReachedNotice';
import { LoginModal } from '../components/auth/LoginModal';
import { HomeView } from '../components/home/HomeView';

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
  const { login, logout, loginError } = useAuth();
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

  const previewRef = useRef<PreviewHandle>(null);
  const consoleOpen = useUiStore((s) => s.consoleOpen);
  const toggleConsole = useUiStore((s) => s.toggleConsole);
  const fullscreen = useUiStore((s) => s.fullscreen);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const setActivePanel = useUiStore((s) => s.setActivePanel);

  // M04: single-modal state + open/close. Login modal is separate shared state so
  // the anonymous custom-CSS gate can open sign-in.
  const activeModal = useUiStore((s) => s.activeModal);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const loginModalOpen = useUiStore((s) => s.loginModalOpen);
  const setLoginModalOpen = useUiStore((s) => s.setLoginModalOpen);

  // M04: subscription (load + derive plan on auth) — `loading` gates the plan-limit
  // race guard (§1). analytics.track binds the current userId. paddle = checkout.
  const { subscription, planType, subscribed, loading: subLoading, reload: reloadSubscription } =
    useSubscription();
  const { track } = useAnalytics();
  const { openCheckout } = usePaddle();
  const paymentEnabled = appConfig.features.payment;

  // M04: settings live-apply via settingsStore.merge; persist split (syncStore + cloud).
  const settings = useSettingsStore((s) => s.settings);
  const mergeSettings = useSettingsStore((s) => s.merge);

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
  const { items } = useItems();
  // REQ-LIB-6: folders for the library panel (sign-in gated; [] + no-op when signed-out).
  const { folders, createFolder, renameFolder, deleteFolder } = useFolders();

  // REQ-PRV-6: console entries accumulate across re-renders.
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  // Last auth provider — read once from local storage (stable value, not reactive)
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  useEffect(() => {
    void localStore.get<string | null>(LS_KEYS.lastAuthProvider, null).then(setLastProvider);
  }, []);

  // §11 keyboard shortcuts: Ctrl+L clears the console; Ctrl/Cmd+Shift+? opens the
  // keyboard-shortcuts help (REQ-KB-1). '?' is Shift+'/', so match either key form.
  useEffect(() => {
    // REQ-EMB-1: embed mode disables ALL global keyboard shortcuts. Don't register the
    // listener at all in embed so a shortcut can't open a modal that embed never renders.
    if (isEmbed) return;
    function onKeyDown(e: KeyboardEvent) {
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

  // M04 one-time trigger: first-run Onboarding (REQ-MOD-3). Opens on boot when the
  // `onboarded` flag is unset; dismissing marks it (handled at the modal's onDismiss).
  useEffect(() => {
    // REQ-EMB-1: embed mode shows NO modals — skip the first-run onboarding trigger.
    if (isEmbed) return;
    void (async () => {
      const seen = await localStore.get<boolean>(LS_KEYS.onboarded, false);
      // Legacy parity (adversarial review, REQ-MOD-3): legacy gated onboarding ONLY
      // on `!lastSeenVersion` (app.jsx:314) — it NEVER used a localStorage `onboarded`
      // key (that name was a COOKIE used solely to dedupe the analytics event,
      // app.jsx:318-320). A user migrating from the legacy app has lastSeenVersion set
      // (in chrome.storage.sync → read via syncStore) but NO localStorage `onboarded`,
      // so gating on `onboarded` alone re-onboards every existing user. Also suppress
      // when a stored lastSeenVersion is present so a migrating user is treated as a
      // returning user, not a first-timer.
      const priorVersion = await syncStore.get<string>(LS_KEYS.lastSeenVersion, '');
      if (!seen && !priorVersion) {
        openModal('onboarding');
        // Stamp lastSeenVersion for a brand-new user the moment onboarding is shown
        // (legacy parity: app.jsx:322 setUserLastSeenVersion(version) in the
        // new-user branch). Persisted via syncStore to match legacy db.sync =
        // chrome.storage.sync (db.js:131-140) and contract §7.2 — so a user
        // migrating from the legacy extension (whose lastSeenVersion lives in
        // chrome.storage.sync) is read back correctly and not re-onboarded.
        // Without this, lastSeenVersion stays '' and the pledge
        // effect would treat a first-time user as an "upgrade" on their NEXT boot
        // (semverCompare('0.0.0', APP_VERSION) < 0), showing them a version-upgrade
        // prompt they have no baseline for (wrong audience — REQ-MOD-3). The pledge
        // effect additionally gates on a truthy lastSeenVersion (below). We are in
        // the `!priorVersion` branch, so lastSeenVersion is known empty here.
        void syncStore.set(LS_KEYS.lastSeenVersion, APP_VERSION);
      }
    })();
    // openModal is a stable zustand action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // M04 one-time trigger: Support-pledge on version upgrade (REQ-MOD-3). On boot,
  // semver-compare the stored lastSeenVersion against APP_VERSION; if behind, open
  // the pledge. Does NOT pre-empt Onboarding (only one modal is open at a time — the
  // onboarding open above runs first; the pledge opens once onboarding is dismissed
  // on the next boot, matching legacy's at-most-one-per-session behavior).
  useEffect(() => {
    // REQ-EMB-1: embed mode shows NO modals — skip the version-upgrade pledge trigger.
    if (isEmbed) return;
    void (async () => {
      const seen = await syncStore.get<string>(LS_KEYS.lastSeenVersion, '');
      // pledgeModalSeen latch (legacy parity: app.jsx:331 `!window.localStorage.
      // pledgeModalSeen`). A user MIGRATING from legacy who already dismissed the
      // pledge has pledgeModalSeen=true (set by legacy on dismiss) but a still-behind
      // lastSeenVersion (legacy bumps lastSeenVersion only on new-user onboarding /
      // notification-click, NOT on pledge dismiss). Reading this flag prevents a
      // spurious one-time re-show to that already-served audience (REQ-MOD-3) and
      // makes pledgeModalSeen a live latch instead of dead state.
      const pledgeSeen = await localStore.get<boolean>(LS_KEYS.pledgeModalSeen, false);
      if (useUiStore.getState().activeModal) return; // don't replace onboarding
      if (pledgeSeen) return;
      // Truthiness gate (legacy parity: app.jsx:329 `lastSeenVersion &&`). A
      // brand-new user has no stored lastSeenVersion — the pledge is an UPGRADE
      // prompt and must never fire for someone who has no prior version baseline.
      // Without this guard, `semverCompare('0.0.0', APP_VERSION) < 0` is true and a
      // first-time user is shown a "we just shipped a new version" prompt (wrong
      // audience, REQ-MOD-3). The onboarding effect stamps lastSeenVersion for new
      // users, so by their next boot this is truthy and the pledge stays suppressed.
      if (!seen) return;
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
  const [importError, setImportError] = useState<string | null>(null);

  // ItemService — created once, injects auth/online context lazily via getState()
  const itemService = useMemo(
    () => makeItemService(() => ({
      uid: useAuthStore.getState().user?.uid ?? null,
      online: useAuthStore.getState().online,
    })),
    [],
  );

  // Import-on-login: when the user signs in with local diagrams, offer to import them.
  const { pending: importPending, count: importCount, doImport, dismiss: dismissImport } =
    useImportOnLogin(itemService.saveItems);

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
  const { shareError, clearShareError } = useBootItem({
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

  async function save() {
    const it = useEditorStore.getState().currentItem;
    if (!it || it.isReadOnly) return;
    // Stamp updatedOn so the local copy reflects the save time.
    const itemToSave: Item = { ...it, updatedOn: Date.now() };
    const uid = useAuthStore.getState().user?.uid;

    // M04 save analytics (legacy parity): label = not-logged-in / saved / new.
    track('saveBtnClick', {
      category: 'ui',
      label: !uid ? 'not-logged-in' : itemToSave.id ? 'saved' : 'new',
    });

    // M04 plan-limit seam (REQ-SUB-5, legacy-exact). Sample the owned ids PRE-INSERT
    // (before setItem/setItemForUser register this item) so the predicate
    // `ownedIds.length > limitFor(sub)` matches legacy checkItemsLimit. RACE GUARD:
    // only enforce when signed-in AND the subscription read has RESOLVED (!subLoading)
    // — an unresolved subscription transiently derives to 'free', so enforcing would
    // falsely block a paying user and silently skip their cloud write.
    // The owned-id read drives ONE withhold-the-cloud-write condition:
    //  - overLimit: a GENUINE plan-cap hit (owned-count read SUCCEEDED and exceeds
    //    the cap). This is the only case that shows LimitReachedNotice + fires the
    //    'Free Limit' analytics event.
    //
    // FAIL OPEN on a read error (adversarial review, finding 1): if getUserItemIds
    // THROWS (offline blip / Firestore permission error / an uncached users-doc read
    // — the persistent cache only serves docs it has already cached, so a first save
    // after login while offline rejects), we DO NOT withhold the cloud write. Legacy
    // checkItemsLimit (src/components/app.jsx:467-482) derives the count from the
    // in-memory state.user.items loaded at auth time and performs NO I/O read at save,
    // so a save is NEVER blocked by a read error there. Failing CLOSED here was a NEW
    // failure surface with no legacy analog: an under-cap free/basic user whose read
    // blips would have their cloud write + ownership-membership silently dropped with
    // NO user signal (no notice, no analytics) — they believe the diagram is synced
    // across devices when it lives only in localStorage. Crucially the firestore rules
    // do NOT enforce the 3/20 count (C-RULES-1), so proceeding cannot "bypass" any
    // real server enforcement: at worst a free user momentarily holds a limit+1 cloud
    // diagram during an offline blip — exactly what legacy already permits (stale
    // in-memory count admits the limit+1 item) and which self-corrects on next load.
    // Withholding a confirmed-under-cap user's data is the strictly worse outcome.
    let overLimit = false;
    if (uid && !subLoading) {
      try {
        const ownedIds = await getUserItemIds(uid);
        overLimit = isOverFileLimit({ subscription, ownedIds, itemId: itemToSave.id });
      } catch {
        // Fail open: read error → do NOT withhold (legacy never blocks a save on a
        // read; rules don't enforce the count). overLimit stays false.
      }
    }
    const withholdCloud = overLimit;

    useEditorStore.getState().setSaving(true);
    try {
      if (uid && !withholdCloud) {
        // FIX 6: ensure user doc exists before any cloud write to prevent membership
        // loss on first save after login (ensureUser is memoized per-uid).
        await ensureUser(uid);
      }
      if (withholdCloud) {
        // Softened enforcement: keep the LOCAL copy, withhold the cloud write +
        // membership. The notice + 'Free Limit' analytics fire ONLY for a genuine
        // cap hit (overLimit), never for a transient read failure (readFailed).
        await itemService.setItem(itemToSave.id, itemToSave, { skipCloud: true });
        // Fire the notice + analytics ONCE per cap-hit episode (not on every 15s
        // auto-save tick): only when this item id hasn't already been notified.
        if (overLimit && limitNotifiedRef.current !== itemToSave.id) {
          limitNotifiedRef.current = itemToSave.id;
          setLimitNoticeOpen(true);
          // REQ-ANL-1: preserve the legacy 'Free Limit' envelope EXACTLY so the
          // existing limit-reached Mixpanel funnel keeps matching. Legacy
          // (app.jsx:496-500) fires {event:'Free Limit', category:'3 diagrams
          // limit', label:'Save'} on the save-cap hit. Diverging the category/label
          // (the prior 'storage'/planType) silently sends this to a different
          // segment, zeroing out the existing save-path report (adversarial review).
          track('Free Limit', { category: '3 diagrams limit', label: 'Save' });
        }
        // DO NOT markSaved() here (adversarial review): the cloud write was
        // deliberately withheld, so the diagram is NOT synced. Calling markSaved
        // would clear dirty + reset unsavedCount to 0, presenting the item as a
        // clean cloud save and risking silent data loss (the user believes it is
        // synced across devices when it lives only in localStorage). Legacy returns
        // early BEFORE saveItem on the over-cap path, so dirty/unsaved state is
        // never cleared and the user keeps being prompted to resolve the cap.
      } else {
        await itemService.setItem(itemToSave.id, itemToSave);
        if (uid) {
          try { await setItemForUser(uid, itemToSave.id); } catch { /* membership best-effort */ }
        }
        // A genuine save succeeded → clear the cap-hit latch so if the user later goes
        // back over the limit on this item they get notified again.
        limitNotifiedRef.current = null;
        useEditorStore.getState().markSaved();
      }
    } finally {
      useEditorStore.getState().setSaving(false);
    }
    // Signed-out first save: show one-time notice prompting sign-in.
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      const seen = await localStore.get<boolean>(LS_KEYS.loginAndSaveMessageSeen, false);
      if (!seen) {
        await localStore.set(LS_KEYS.loginAndSaveMessageSeen, true);
        setNoticeOpen(true);
      }
    }
  }

  // M04 §8: custom-CSS is Plus-only. Returns true if the attempted CSS change is
  // GATED (caller must NOT apply it). Anonymous → prompt sign-in (one-time notice);
  // signed-in non-Plus → open pricing. RACE GUARD: while the subscription is still
  // loading we do NOT gate (a Plus user mid-load must not be treated as Free). Plus
  // users edit freely.
  function cssGated(): boolean {
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
    if (subLoading) return false; // unresolved → not gated (race guard)
    if (isPlus(subscription)) return false;
    openModal('pricing');
    // See note above: no legacy 'Free Limit' analog for the custom-CSS gate.
    return true;
  }

  function handleSetCss(css: string) {
    if (cssGated()) return;
    setCss(css);
  }

  function handleSetCssMode(mode: CssMode) {
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
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) { closeModal(); return; }
    if (plan === 'free' || plan === 'enterprise') return;
    openCheckout({
      planType: plan as CheckoutPlanType,
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

  // Hub: create a blank diagram from the home view and navigate to the editor.
  function handleNewDiagramFromHome() {
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
    void navigate({ to: '/', search: (prev) => ({
      id: newId,
      view: undefined,
      'share-token': prev['share-token'],
      embed: prev.embed,
      code: prev.code,
      title: prev.title,
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
    setActivePanel('editor');
  }

  // Move-to-folder passes the HELD item (advisor fix B) — never re-fetch from
  // localStore, which is empty for cloud-only items delivered by onSnapshot.
  async function handleMoveItem(it: Item, folderId: string | null) {
    await itemService.moveToFolder(it, folderId);
  }

  function handleExportAll() {
    // REQ-ANL-1: legacy category is 'fn' (app.jsx:1211 trackEvent('fn','exportItems'))
    // and legacy sent NO label. Match the envelope so saved Mixpanel views filtering
    // exportItems by category='fn' keep matching after cutover (adversarial review).
    track('exportItems', { category: 'fn' });
    const json = exportAllItemsJson(items);
    downloadText('zenuml-diagrams.json', json, 'application/json');
  }

  function handleExportHtml(it: Item) {
    const html = buildStandaloneHtml(it);
    const safe = (it.title || 'diagram').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    downloadText(`${safe}.html`, html, 'text/html');
  }

  async function handleImport(text: string) {
    // parseImportJson throws on invalid JSON / wrong shape. Catch it so a malformed
    // file surfaces an error instead of a silent unhandled rejection (advisor fix #6).
    try {
      const parsed = parseImportJson(text);
      const map: Record<string, Item> = {};
      for (const it of parsed) map[it.id] = it;
      // saveItems already writes user-membership in its signed-in batch path, so no
      // separate setItemForUser loop is needed (advisor note 7).
      await itemService.saveItems(map);
      // REQ-ANL-1 (adversarial review, finding 4): legacy app.jsx:1280,1300 sends
      // mergedItemCount — the count of NEWLY added items (total minus ids that already
      // existed) — NOT the full parsed count, and fires the event ONLY when that count
      // is > 0. Sending String(parsed.length) unconditionally inflated any saved
      // Mixpanel report that reads itemsImported as a new-items-added metric whenever an
      // imported file overlapped existing items, and emitted a spurious itemsImported=N
      // for an all-duplicate import that added nothing new. Compute the newly-added
      // count against the current item set and gate the event on it (legacy-exact).
      const existingIds = new Set(items.map((i) => i.id));
      const mergedItemCount = parsed.filter((p) => !existingIds.has(p.id)).length;
      if (mergedItemCount > 0) {
        track('itemsImported', { category: 'fn', label: String(mergedItemCount) });
      }
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Could not import this file.');
    }
  }

  // REQ-SHR-1/2/5: share the CURRENT item. Read the id via getState() so a fresh
  // save (which may rotate nothing but keeps the same id) is always reflected.
  const share = useShare({
    // Reactive id so url/error reset when the user switches items (advisor fix #8).
    itemId: item?.id ?? null,
    getItemId: () => useEditorStore.getState().currentItem?.id ?? null,
    createShare,
    stopSharing: itemService.stopSharing,
    onBeforeShare: save, // createShare reads the cloud doc — item must be saved first.
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
        <ConfirmDialog
          open={noticeOpen}
          onOpenChange={setNoticeOpen}
          title="Saved on this device"
          message="Sign in to save and sync across devices."
          confirmLabel="Sign in"
          cancelLabel="Not now"
          onConfirm={() => login((lastProvider as ProviderName | null) ?? 'google')}
        />
        <ConfirmDialog
          open={importError != null}
          onOpenChange={(o) => { if (!o) setImportError(null); }}
          title="Import failed"
          message={importError ?? ''}
          confirmLabel="OK"
          cancelLabel="Dismiss"
          onConfirm={() => setImportError(null)}
        />
        <AskToImportModal
          open={importPending}
          onOpenChange={(o) => { if (!o) void dismissImport(); }}
          count={importCount}
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
          onSelect={(partial) => {
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
          }}
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
          onOpenChange={setLoginModalOpen}
          onLogin={(provider) => { track('loggedIn', { category: 'fn', label: provider }); login(provider); }}
          lastProvider={lastProvider}
          error={loginError}
        />
        <HomeView
          items={items}
          folders={folders}
          user={user}
          onOpen={handleOpenItem}
          onNewDiagram={handleNewDiagramFromHome}
          onBrowseTemplates={() => openModal('createNew')}
          onOpenSignIn={() => setLoginModalOpen(true)}
          onLogout={() => { track('loggedOut', { category: 'fn' }); logout(); }}
          onCreateFolder={(name) => void createFolder(name)}
          onRenameFolder={(id, name) => void renameFolder(id, name)}
          onDeleteFolder={(id) => void deleteFolder(id)}
          onDeleteItem={(id) => void handleDeleteItem(id)}
          onForkItem={handleForkItem}
          onMoveItem={(it, folderId) => void handleMoveItem(it, folderId)}
          onExportHtml={handleExportHtml}
          onExportAll={handleExportAll}
          onImport={(text) => void handleImport(text)}
          readOnly={!user}
        />
      </div>
    );
  }

  // REQ-SHR-4: a dead boot share-link seeds NO item (currentItem stays null), so
  // surface the error here at the guard instead of silently returning null. Start
  // fresh clears the flag and seeds a blank diagram.
  if (!item) {
    return shareError ? (
      <ShareErrorNotice
        open
        // Seed a fresh diagram on ANY close (Start-fresh, Escape, or overlay click)
        // so dismissing the notice never strands the user on a blank null screen.
        onOpenChange={(o) => { if (!o) { useEditorStore.getState().newItem(); clearShareError(); } }}
        onStartFresh={() => { useEditorStore.getState().newItem(); clearShareError(); }}
      />
    ) : null;
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* One-time "saved locally" notice for signed-out users (REQ-PST) */}
      <ConfirmDialog
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        title="Saved on this device"
        message="Sign in to save and sync across devices."
        confirmLabel="Sign in"
        cancelLabel="Not now"
        onConfirm={() => login((lastProvider as ProviderName | null) ?? 'google')}
      />
      {/* REQ-LIB-8: surface a malformed-import error (advisor fix #6). */}
      <ConfirmDialog
        open={importError != null}
        onOpenChange={(o) => { if (!o) setImportError(null); }}
        title="Import failed"
        message={importError ?? ''}
        confirmLabel="OK"
        cancelLabel="Dismiss"
        onConfirm={() => setImportError(null)}
      />
      {/* Import local diagrams after login (REQ-AC) */}
      <AskToImportModal
        open={importPending}
        onOpenChange={(o) => { if (!o) void dismissImport(); }}
        count={importCount}
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
      <CheatSheetModal
        open={activeModal === 'cheatsheet'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
      />
      <KeyboardShortcutsModal
        open={activeModal === 'shortcuts'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
      />
      <OnboardingModal
        open={activeModal === 'onboarding'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
        onDismiss={() => {
          void localStore.set(LS_KEYS.onboarded, true);
          track('onboardModalSeen', { category: 'ui', label: APP_VERSION });
          closeModal();
        }}
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
        onPresent={toggleFullscreen}
        user={user}
        lastProvider={lastProvider}
        readOnly={!!item.isReadOnly}
        onTitleChange={setTitle}
        onNew={() => useEditorStore.getState().newItem()}
        onFork={() => useEditorStore.getState().forkCurrent()}
        onSave={save}
        onLogin={(provider) => { track('loggedIn', { category: 'fn', label: provider }); login(provider); }}
        onLogout={() => { track('loggedOut', { category: 'fn' }); logout(); }}
        loginError={loginError}
        loginOpen={loginModalOpen}
        onLoginOpenChange={setLoginModalOpen}
        subscribed={subscribed}
        planType={planType}
        paymentEnabled={paymentEnabled}
        onUpgrade={() => openModal('pricing')}
        onManagePlan={handleManagePlan}
        onOpenSettings={() => { openModal('settings'); track('openSettingsModal', { category: 'ui' }); }}
        onOpenCreateNew={() => openModal('createNew')}
        onOpenHelp={() => openModal('help')}
        onOpenPricing={() => openModal('pricing')}
        onOpenCheatSheet={() => openModal('cheatsheet')}
        onOpenShortcuts={() => openModal('shortcuts')}
        onGoHome={goHome}
        actions={
          <ShareButton
            disabled={shareReadOnly}
            disabledReason="This is a read-only copy — duplicate it to share"
            requiresAuth={shareRequiresAuth}
            onRequireAuth={() => setLoginModalOpen(true)}
            url={share.url}
            sharing={share.sharing}
            error={share.error}
            copied={share.copied}
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
          editor={
            (
            <div className="flex flex-col h-full">
              {/* Page tabs now live on the RENDERER side (preview slot), above the
                  diagram — pages are a property of the rendered document, not the DSL
                  (per design §02). The editor pane just edits whichever page is active. */}
              {/* #6 / IA fix: each editor pane carries its OWN header so the two
                  stacked CodeMirror surfaces are unambiguous. The DSL pane is the
                  PRIMARY surface (mono "DSL" label leading, accent rule). The CSS pane
                  is a collapsible CssPanel: collapsed to a thin "Custom CSS ▸" strip
                  when empty, expanding to the editor + its pre-processor Select. CSS
                  modes are live (computeCss feeds previewCss); the DSL is rendered by
                  @zenuml/core and has no JS pre-processor, so no js-mode Select. */}
              <div className="flex flex-1 min-h-0 flex-col">
                {/* DSL pane header — primary surface marker */}
                <div className="flex items-center justify-between gap-3 px-2 py-1.5 border-b border-ink-line/40">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-onDark">
                    <span className="h-3 w-0.5 rounded-full bg-accent-onDark/70" aria-hidden="true" />
                    DSL
                  </span>
                </div>
                <div className="flex-1 min-h-0"><CodeEditor key={`dsl-${item.currentPageId}`} value={item.js} language="dsl" onChange={handleDslChange} testId="dsl-editor" themeId={settings.editorTheme} fontSize={settings.fontSize} fontFamily={editorFontFamily} keymap={settings.keymap} /></div>
              </div>
              {/* CSS pane → collapsible strip. Re-keyed per page so the collapsed
                  default re-derives from the new page's CSS emptiness (matches the
                  DSL editor's per-page remount). The pre-processor Select + acss
                  config button are passed as headerControls — untouched, still live. */}
              <CssPanel
                key={`css-panel-${item.currentPageId}`}
                isEmpty={!item.css || item.css.trim().length === 0}
                headerControls={
                  <>
                    {/* ACSS mode: the CSS editor is read-only (atomizer scans HTML); the
                        Atomizer config is edited via this affordance (REQ-ED-2). */}
                    {item.cssMode === 'acss' && (
                      <Button
                        size="sm"
                        variant="subtle"
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
                        surface="dark"
                        className="h-7"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CSS_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                }
              >
                <CodeEditor key={`css-${item.currentPageId}`} value={item.css} language="css" onChange={handleSetCss} testId="css-editor" readOnly={item.cssMode === 'acss'} diagnostics={cssErrors} themeId={settings.editorTheme} fontSize={settings.fontSize} fontFamily={editorFontFamily} keymap={settings.keymap} />
              </CssPanel>
            </div>
            )
          }
          preview={
            <div className={fullscreen ? 'fixed inset-0 z-50 surface-paper flex flex-col' : 'relative h-full flex flex-col'}>
              {/* Renderer header (diagram side): page tabs + zoom/Fit/Present controls.
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
                  onPresent={toggleFullscreen}
                  pageTabs={
                    <PageTabs
                      surface="light"
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
              {/* Center the rendered diagram with breathing room instead of clinging
                  to the top-left of the pane. */}
              <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                <PreviewFrame
                  ref={previewRef}
                  code={item.js}
                  css={previewCss}
                  // Present (fullscreen) mode: scale-to-fit + center the diagram
                  // (CSS transform; @zenuml/core untouched).
                  fit={fullscreen}
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
          }
        />
      </div>
    </div>
  );
}
