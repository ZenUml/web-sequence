import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle } from '../preview/PreviewFrame';
import { useEditorStore } from '../state/editorStore';
import { migrateToPages } from '../domain/item';
import type { Item, JsMode, CssMode } from '../domain/types';
import { computeCss } from '../preview/transpilers';
import { Sidebar } from '../components/Sidebar';
import { Layout } from '../components/Layout';

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

const STARTER: Item = migrateToPages({
  id: 'starter', title: 'Untitled', js: 'A.SyncMessage\nA->B: AsyncMessage', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '',
});

export function AppRoot() {
  const item = useEditorStore((s) => s.currentItem);
  const loadItem = useEditorStore((s) => s.loadItem);
  const setDsl = useEditorStore((s) => s.setDsl);
  const setCss = useEditorStore((s) => s.setCss);
  const setJsMode = useEditorStore((s) => s.setJsMode);
  const setCssMode = useEditorStore((s) => s.setCssMode);
  const previewRef = useRef<PreviewHandle>(null);

  // REQ-PRV-4 (lazy transpile): plain CSS stays synchronous; transpiled modes
  // (scss/sass/less/stylus/acss) compute asynchronously into local state. For ACSS
  // the source is the HTML (atomizer scans markup for utility classes). Full
  // transpiled-mode rendering is verified by E2E when those modes are exercised.
  const [transpiledCss, setTranspiledCss] = useState(item?.css ?? '');
  useEffect(() => {
    if (!item || item.cssMode === 'css') return;
    let cancelled = false;
    computeCss(item.cssMode === 'acss' ? item.html : item.css, item.cssMode, item.cssSettings)
      .then((r) => { if (!cancelled) setTranspiledCss(r.code); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.css, item?.html, item?.cssMode, item?.cssSettings]);

  useEffect(() => { if (!item) loadItem(STARTER); }, [item, loadItem]);
  // REQ-PRV-3: stickyOffset comes from the HOST's real URL (the main app is at the
  // real location; only the iframe is srcdoc). Read once from window.location.search
  // and pass into the render message. (M00's router also validates this param.)
  const stickyOffset = Number(new URLSearchParams(window.location.search).get('stickyOffset') ?? 0) || 0;
  if (!item) return null;

  const previewCss = item.cssMode === 'css' ? item.css : transpiledCss;

  return (
    <div className="flex h-full w-full">
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
            <div className="flex-1 min-h-0"><CodeEditor value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" /></div>
            <div className="flex-1 min-h-0 border-t border-gray-200"><CodeEditor value={item.css} language="css" onChange={setCss} testId="css-editor" readOnly={item.cssMode === 'acss'} /></div>
          </div>
        }
        preview={<PreviewFrame ref={previewRef} code={item.js} css={previewCss} stickyOffset={stickyOffset} onCodeChange={setDsl} />}
      />
    </div>
  );
}
