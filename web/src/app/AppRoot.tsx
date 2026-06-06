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
import { AppHeader } from '../components/header/AppHeader';
import { addCode } from '../editor/snippets';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useBootItem } from '../hooks/useBootItem';
import { makeItemService } from '../services/itemService';
import { getSharedItem } from '../services/cloudFunctions';
import { setItemForUser } from '../services/userService';
import { localStore } from '../services/storage';
import { LS_KEYS } from '../config/constants';

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
  const unsavedCount = useEditorStore((s) => s.unsavedCount);

  const user = useAuthStore((s) => s.user);

  const preserveLastCode = useSettingsStore((s) => s.settings.preserveLastCode);

  const previewRef = useRef<PreviewHandle>(null);
  const consoleOpen = useUiStore((s) => s.consoleOpen);
  const toggleConsole = useUiStore((s) => s.toggleConsole);
  const fullscreen = useUiStore((s) => s.fullscreen);
  const toggleFullscreen = useUiStore((s) => s.toggleFullscreen);

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

  // ItemService — created once, injects auth/online context lazily via getState()
  const itemService = useMemo(
    () => makeItemService(() => ({
      uid: useAuthStore.getState().user?.uid ?? null,
      online: useAuthStore.getState().online,
    })),
    [],
  );

  // Read URL params — following existing stickyOffset pattern (no router hook, safe in bare tests)
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  const shareToken = params.get('share-token');

  // Boot: resolve the item to load (replaces the old STARTER seeding effect)
  useBootItem({
    idParam,
    shareToken,
    preserveLastCode,
    getItem: itemService.getItem,
    getSharedItem,
    getLastCode: () => localStore.get<Item | null>(LS_KEYS.code, null),
  });

  // Lifecycle: save last code on tab hide / window unload (REQ-PST)
  useEffect(() => {
    function persist() {
      const current = useEditorStore.getState().currentItem;
      if (current) itemService.saveLastCode(current);
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

  // Minimal save handler (Task 13 will add import-on-login, login-and-save notice, plan-limit/trackEvent seams)
  async function save() {
    const it = useEditorStore.getState().currentItem;
    if (!it || it.isReadOnly) return;
    useEditorStore.getState().setSaving(true);
    try {
      await itemService.setItem(it.id, it);
      const uid = useAuthStore.getState().user?.uid;
      if (uid) {
        try { await setItemForUser(uid, it.id); } catch { /* membership best-effort */ }
      }
      useEditorStore.getState().markSaved();
    } finally {
      useEditorStore.getState().setSaving(false);
    }
    // Task 13: import-on-login, login-and-save notice. M04: enforce plan limit; trackEvent('fn','saved').
  }

  // REQ-PRV-3: stickyOffset comes from the HOST's real URL (the main app is at the
  // real location; only the iframe is srcdoc). Read once from window.location.search
  // and pass into the render message. (M00's router also validates this param.)
  const stickyOffset = Number(params.get('stickyOffset') ?? 0) || 0;

  if (!item) return null;

  const previewCss = item.cssMode === 'css' ? item.css : transpiledCss;

  return (
    <div className="flex flex-col h-full w-full">
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
      />
      <div className="flex flex-1 min-h-0 w-full">
        <Sidebar />
        <Layout
          editor={
            <div className="flex flex-col h-full">
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
              <div className="flex-1 min-h-0"><CodeEditor value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" /></div>
              <div className="flex-1 min-h-0 border-t border-gray-200"><CodeEditor value={item.css} language="css" onChange={setCss} testId="css-editor" readOnly={item.cssMode === 'acss'} diagnostics={cssErrors} /></div>
            </div>
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
