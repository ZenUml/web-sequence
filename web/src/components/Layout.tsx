import Split from 'split.js';
import { useEffect, useRef } from 'react';
import { useEditorStore } from '../state/editorStore';

export function Layout({ editor, preview }: { editor: React.ReactNode; preview: React.ReactNode }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const item = useEditorStore((s) => s.currentItem);
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    const sizes = item?.mainSizes ?? [40, 60];
    let inst: ReturnType<typeof Split> | undefined;
    try {
      inst = Split([leftRef.current, rightRef.current], {
        sizes, minSize: 240, gutterSize: 6, direction: 'horizontal',
        onDragEnd: (s) => { if (item) item.mainSizes = s; }, // persisted on save in M02
      });
    } catch (e) {
      // split.js may throw in jsdom (zero-size layout APIs); skip splitting in test env
      console.warn('[Layout] Split() skipped:', e);
    }
    return () => inst?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex h-full w-full">
      <div ref={leftRef} data-testid="editor-region" aria-label="Editor" className="h-full overflow-hidden">{editor}</div>
      <div ref={rightRef} data-testid="preview-region" aria-label="Preview" className="h-full overflow-hidden">{preview}</div>
    </div>
  );
}
