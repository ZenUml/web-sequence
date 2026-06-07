import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle } from '../preview/PreviewFrame';
import { Console, type ConsoleEntry } from '../preview/Console';
import { useEditorStore } from '../state/editorStore';
import { useAuthStore } from '../state/authStore';
import { useSettingsStore } from '../state/settingsStore';
import { useUiStore } from '../state/uiStore';
import type { Item, JsMode, CssMode } from '../domain/types';
import { computeCss } from '../preview/transpilers';
import { Sidebar } from '../components/Sidebar';
import { Layout } from '../components/Layout';
import { Toolbox } from '../components/Toolbox';
import { PageTabs } from '../components/pages/PageTabs';
import { AppHeader } from '../components/header/AppHeader';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { AskToImportModal } from '../components/modals/AskToImportModal';
import { addCode } from '../editor/snippets';
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
import { LibraryPanel } from '../components/library/LibraryPanel';
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

const JS_MODES: { value: JsMode; label: string }[] = [
  { value: 'js', label: 'JavaScript' },
  { value: 'es6', label: 'ES6 (Babel)' },
  { value: 'coffeescript', label: 'CoffeeScript' },
  { value: 'typescript', label: 'TypeScript' },
];
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

  // Auth + online status side-effects (no return value needed from useOnlineStatus)
  const { login, logout, loginError } = useAuth();
  useOnlineStatus();

  const item = useEditorStore((s) => s.currentItem);
  const setDsl = useEditorStore((s) => s.setDsl);
  const setCss = useEditorStore((s) => s.setCss);
  const setJsMode = useEditorStore((s) => s.setJsMode);
  const setCssMode = useEditorStore((s) => s.setCssMode);
  const setTitle = useEditorStore((s) => s.setTitle);
  const addPageAction = useEditorStore((s) => s.addPage);
  const deletePageAction = useEditorStore((s) => s.deletePage);
  const switchPageAction = useEditorStore((s) => s.switchPage);
  const renamePageAction = useEditorStore((s) => s.renamePage);
  const unsavedCount = useEditorStore((s) => s.unsavedCount);

  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.authReady);

  const preserveLastCode = useSettingsStore((s) => s.settings.preserveLastCode);
  const autoSave = useSettingsStore((s) => s.settings.autoSave);

  // REQ-PST-2: auto-save loop — fires every AUTO_SAVE_INTERVAL when enabled + unsaved edits exist.
  // `save` is defined later in this function; useAutoSave reads it via ref so no stale closure
  // (same pattern as PreviewFrame's cbRef — interval keyed only on `enabled`).
  useAutoSave({ enabled: autoSave, hasUnsaved: unsavedCount > 0, onSave: () => void save() });

  const previewRef = useRef<PreviewHandle>(null);
  const consoleOpen = useUiStore((s) => s.consoleOpen);
  const toggleConsole = useUiStore((s) => s.toggleConsole);
  const fullscreen = useUiStore((s) => s.fullscreen);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);
  const activePanel = useUiStore((s) => s.activePanel);
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

  // Read URL params — following existing stickyOffset pattern (no router hook, safe in bare tests)
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  const shareToken = params.get('share-token');

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
  }, authReady, embedByValue);

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
      htmlMode: 'html', cssMode: 'css', jsMode: 'js',
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
        if (overLimit) {
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
  function handleOpenItem(it: Item) {
    useEditorStore.getState().loadItem(migrateToPages(it));
    setActivePanel('editor');
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

  // ShareButton disabled rule (advisor fix 4): read-only items, signed-out users
  // (createShare needs a fresh ID token), and never-saved items (not yet in the
  // live list) cannot be shared. Membership in `items` is the save signal — after a
  // signed-in save, onSnapshot adds the item and the button enables.
  const shareDisabled =
    !!item?.isReadOnly || !user || !items.some((i) => i.id === item?.id);

  // REQ-PRV-3: stickyOffset comes from the HOST's real URL (the main app is at the
  // real location; only the iframe is srcdoc). Read once from window.location.search
  // and pass into the render message. (M00's router also validates this param.)
  const stickyOffset = Number(params.get('stickyOffset') ?? 0) || 0;

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
      <div data-testid="embed-root" className="flex flex-col h-full w-full bg-paper-50">
        <EmbedHeader title={item?.title ?? runtime.embedTitle ?? undefined} openUrl={openUrl} />
        <div className="flex-1 min-h-0">
          {item ? (
            <PreviewFrame
              ref={previewRef}
              code={item.js}
              css={item.cssMode === 'css' ? item.css : transpiledCss}
              stickyOffset={stickyOffset}
            />
          ) : null}
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

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

  const previewCss = item.cssMode === 'css' ? item.css : transpiledCss;

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
      <AtomicCssSettingsModal
        open={activeModal === 'acss'}
        onOpenChange={(o) => { if (!o) closeModal(); }}
        value={(item.cssSettings as CssSettings | undefined) ?? {}}
        onChange={(next) => { useEditorStore.getState().setCssSettings(next); closeModal(); }}
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
      <LimitReachedNotice
        open={limitNoticeOpen}
        onOpenChange={setLimitNoticeOpen}
        limit={limitFor(subscription)}
        onUpgrade={() => { setLimitNoticeOpen(false); if (paymentEnabled) openModal('pricing'); }}
      />

      <AppHeader
        title={item.title ?? ''}
        unsavedCount={unsavedCount}
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
        actions={
          <ShareButton
            disabled={shareDisabled}
            url={share.url}
            sharing={share.sharing}
            error={share.error}
            onShare={() => { track('shareLink', { category: 'ui' }); void share.share(); }}
            onStop={() => void share.stop()}
            onCopy={() => void share.copy()}
          />
        }
      />
      <div className="flex flex-1 min-h-0 w-full">
        <Sidebar />
        <Layout
          editor={
            activePanel === 'library' ? (
              <LibraryPanel
                items={items}
                folders={folders}
                onOpen={handleOpenItem}
                onFork={handleForkItem}
                onDelete={(id) => void handleDeleteItem(id)}
                onMove={(it, folderId) => void handleMoveItem(it, folderId)}
                onExportAll={handleExportAll}
                onImport={(text) => void handleImport(text)}
                onExportHtml={handleExportHtml}
                onCreateFolder={(name) => void createFolder(name)}
                onRenameFolder={(id, name) => void renameFolder(id, name)}
                onDeleteFolder={(id) => void deleteFolder(id)}
                readOnly={!user}
              />
            ) : (
            <div className="flex flex-col h-full">
              <PageTabs
                pages={item.pages ?? []}
                currentPageId={item.currentPageId ?? ''}
                onSwitch={switchPageAction}
                onAdd={addPageAction}
                onDelete={deletePageAction}
                onRename={renamePageAction}
                readOnly={!!item.isReadOnly}
              />
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 text-xs">
                <label className="flex items-center gap-1">
                  <span className="text-gray-500">JS</span>
                  <select
                    data-testid="js-mode-select"
                    value={item.jsMode}
                    onChange={(e) => setJsMode(e.target.value as JsMode)}
                    className="border border-gray-300 rounded px-1 py-0.5"
                  >
                    {JS_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-gray-500">CSS</span>
                  <select
                    data-testid="css-mode-select"
                    value={item.cssMode}
                    onChange={(e) => handleSetCssMode(e.target.value as CssMode)}
                    className="border border-gray-300 rounded px-1 py-0.5"
                  >
                    {CSS_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </label>
                {/* ACSS mode: the CSS editor is read-only (atomizer scans HTML); the
                    Atomizer config is edited via this affordance (REQ-ED-2). */}
                {item.cssMode === 'acss' && (
                  <button
                    type="button"
                    data-testid="acss-settings-open"
                    onClick={() => openModal('acss')}
                    className="border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50"
                  >
                    Atomic CSS config
                  </button>
                )}
              </div>
              <Toolbox onInsert={(code) => setDsl(addCode(item.js, code))} />
              <div className="flex-1 min-h-0"><CodeEditor key={`dsl-${item.currentPageId}`} value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" /></div>
              <div className="flex-1 min-h-0 border-t border-gray-200"><CodeEditor key={`css-${item.currentPageId}`} value={item.css} language="css" onChange={handleSetCss} testId="css-editor" readOnly={item.cssMode === 'acss'} diagnostics={cssErrors} /></div>
            </div>
            )
          }
          preview={
            <div className={fullscreen ? 'fixed inset-0 z-50 bg-white flex flex-col' : 'relative h-full flex flex-col'}>
              <button
                data-testid="preview-fullscreen"
                onClick={toggleFullscreen}
                className="absolute right-2 top-2 z-10 rounded bg-gray-800/70 px-2 py-1 text-xs text-white"
              >
                {fullscreen ? 'Exit' : 'Fullscreen'}
              </button>
              <div className="flex-1 min-h-0">
                <PreviewFrame
                  ref={previewRef}
                  code={item.js}
                  css={previewCss}
                  stickyOffset={stickyOffset}
                  onCodeChange={setDsl}
                  onConsole={(e) => setConsoleEntries((prev) => [...prev, e])}
                  onError={(m) => setConsoleEntries((p) => [...p, { level: 'error', args: [m] }])}
                />
              </div>
              <Console
                open={consoleOpen}
                entries={consoleEntries}
                onClear={() => setConsoleEntries([])}
                onEval={(expr) => previewRef.current?.evalConsole(expr).then((r) => setConsoleEntries((p) => [...p, { level: r.ok ? 'log' : 'error', args: [String(r.value)] }]))}
                onToggle={toggleConsole}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
