import { useEffect, useRef } from 'react';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle } from '../preview/PreviewFrame';
import { useEditorStore } from '../state/editorStore';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';
import { Sidebar } from '../components/Sidebar';
import { Layout } from '../components/Layout';

const STARTER: Item = migrateToPages({
  id: 'starter', title: 'Untitled', js: 'A.SyncMessage\nA->B: AsyncMessage', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '',
});

export function AppRoot() {
  const item = useEditorStore((s) => s.currentItem);
  const loadItem = useEditorStore((s) => s.loadItem);
  const setDsl = useEditorStore((s) => s.setDsl);
  const setCss = useEditorStore((s) => s.setCss);
  const previewRef = useRef<PreviewHandle>(null);

  useEffect(() => { if (!item) loadItem(STARTER); }, [item, loadItem]);
  // REQ-PRV-3: stickyOffset comes from the HOST's real URL (the main app is at the
  // real location; only the iframe is srcdoc). Read once from window.location.search
  // and pass into the render message. (M00's router also validates this param.)
  const stickyOffset = Number(new URLSearchParams(window.location.search).get('stickyOffset') ?? 0) || 0;
  if (!item) return null;

  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <Layout
        editor={
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0"><CodeEditor value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" /></div>
            <div className="flex-1 min-h-0 border-t border-gray-200"><CodeEditor value={item.css} language="css" onChange={setCss} testId="css-editor" readOnly={item.cssMode === 'acss'} /></div>
          </div>
        }
        preview={<PreviewFrame ref={previewRef} code={item.js} css={item.css} stickyOffset={stickyOffset} onCodeChange={setDsl} />}
      />
    </div>
  );
}
