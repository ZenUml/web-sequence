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
import { ensureUser, setItemForUser, unsetItemForUser } from '../services/userService';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';
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
  // Auth + online status side-effects (no return value needed from useOnlineStatus)
  const { login, logout } = useAuth();
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

  // §11: Ctrl+L clears the console.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setConsoleEntries([]); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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

  // Boot: resolve the item to load (replaces the old STARTER seeding effect).
  // authReady gates resolution so a ?id= URL works for signed-in users (FIX 1 — boot race).
  const { shareError, clearShareError } = useBootItem({
    idParam,
    shareToken,
    preserveLastCode,
    getItem: itemService.getItem,
    getSharedItem,
    getLastCode: () => localStore.get<Item | null>(LS_KEYS.code, null),
  }, authReady);

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
    useEditorStore.getState().setSaving(true);
    try {
      // FIX 6: ensure user doc exists before any cloud write to prevent membership loss
      // on first save after login (ensureUser is memoized per-uid so repeat calls are cheap).
      const uid = useAuthStore.getState().user?.uid;
      if (uid) {
        await ensureUser(uid);
      }
      await itemService.setItem(itemToSave.id, itemToSave);
      if (uid) {
        try { await setItemForUser(uid, itemToSave.id); } catch { /* membership best-effort */ }
      }
      useEditorStore.getState().markSaved();
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
    // M04: enforce plan limit; trackEvent('fn','saved').
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
        onLogin={login}
        onLogout={logout}
        actions={
          <ShareButton
            disabled={shareDisabled}
            url={share.url}
            sharing={share.sharing}
            error={share.error}
            onShare={() => void share.share()}
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
                    onChange={(e) => setCssMode(e.target.value as CssMode)}
                    className="border border-gray-300 rounded px-1 py-0.5"
                  >
                    {CSS_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </label>
              </div>
              <Toolbox onInsert={(code) => setDsl(addCode(item.js, code))} />
              <div className="flex-1 min-h-0"><CodeEditor key={`dsl-${item.currentPageId}`} value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" /></div>
              <div className="flex-1 min-h-0 border-t border-gray-200"><CodeEditor key={`css-${item.currentPageId}`} value={item.css} language="css" onChange={setCss} testId="css-editor" readOnly={item.cssMode === 'acss'} diagnostics={cssErrors} /></div>
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
