import { useEffect, useRef } from 'react';
import { CodeEditor } from '../editor/CodeEditor';
import { PreviewFrame, type PreviewHandle } from '../preview/PreviewFrame';
import { useEditorStore } from '../state/editorStore';
import { migrateToPages } from '../domain/item';
import type { Item } from '../domain/types';

const STARTER: Item = migrateToPages({
  id: 'starter', title: 'Untitled', js: 'A.SyncMessage\nA->B: AsyncMessage', css: '', html: '',
  htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '',
});

export function AppRoot() {
  const item = useEditorStore((s) => s.currentItem);
  const loadItem = useEditorStore((s) => s.loadItem);
  const setDsl = useEditorStore((s) => s.setDsl);
  const previewRef = useRef<PreviewHandle>(null);

  useEffect(() => { if (!item) loadItem(STARTER); }, [item, loadItem]);
  // REQ-PRV-3: stickyOffset comes from the HOST's real URL (the main app is at the
  // real location; only the iframe is srcdoc). Read once from window.location.search
  // and pass into the render message. (M00's router also validates this param.)
  const stickyOffset = Number(new URLSearchParams(window.location.search).get('stickyOffset') ?? 0) || 0;
  if (!item) return null;

  return (
    <div className="flex h-full w-full">
      <section data-testid="editor-region" className="w-1/2 border-r border-gray-200" aria-label="Editor">
        <CodeEditor value={item.js} language="dsl" onChange={setDsl} testId="dsl-editor" />
      </section>
      <section data-testid="preview-region" className="w-1/2" aria-label="Preview">
        <PreviewFrame ref={previewRef} code={item.js} css={item.css} stickyOffset={stickyOffset} onCodeChange={setDsl} />
      </section>
    </div>
  );
}
