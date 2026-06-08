import Split from 'split.js';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { cn } from '../ui/cn';

type MobileTab = 'edit' | 'preview';

export function Layout({ editor, preview }: { editor: React.ReactNode; preview: React.ReactNode }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const item = useEditorStore((s) => s.currentItem);
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<MobileTab>('edit');

  useEffect(() => {
    // Mobile renders a single pane (no split.js) — never instantiate Split there.
    // `isMobile` is in the dep array so split re-inits when crossing the breakpoint.
    if (isMobile) return;
    if (!leftRef.current || !rightRef.current) return;
    const sizes = item?.mainSizes ?? [40, 60];
    let inst: ReturnType<typeof Split> | undefined;
    try {
      inst = Split([leftRef.current, rightRef.current], {
        sizes, minSize: 240, gutterSize: 6, direction: 'horizontal',
        // FIX 5: use getState() to avoid stale closure over `item`; update store immutably.
        onDragEnd: (s) => useEditorStore.getState().setMainSizes(s.map(Number)),
      });
    } catch (e) {
      // split.js may throw in jsdom (zero-size layout APIs); skip splitting in test env
      console.warn('[Layout] Split() skipped:', e);
    }
    return () => inst?.destroy();
    // Intentionally read `mainSizes` once at init (desktop must stay identical — adding
    // `item` would re-init split on every page switch). Re-init only on breakpoint change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Mobile (< md): single pane with a segmented Edit | Preview control (design §03).
  if (isMobile) {
    return (
      <div className="flex h-full w-full flex-col">
        <div
          role="group"
          aria-label="Editor or preview"
          className="flex shrink-0 gap-1 px-3 py-2 bg-ink-900 border-b border-ink-line"
        >
          <SegTab label="Edit" testid="layout-tab-edit" active={tab === 'edit'} onClick={() => setTab('edit')} />
          <SegTab label="Preview" testid="layout-tab-preview" active={tab === 'preview'} onClick={() => setTab('preview')} />
        </div>
        {/* BOTH panes stay MOUNTED on mobile; the inactive one is hidden via CSS.
            Two reasons: (1) toggling Edit/Preview must NOT remount the PreviewFrame
            iframe (that reloads the heavy @zenuml bundle + loses render state), and
            (2) the fullscreen "Present" overlay lives inside the preview subtree —
            if that subtree unmounted on the Edit tab, the header Present button would
            be a dead control there. Keeping both mounted fixes both. */}
        <div
          data-testid="editor-region"
          aria-label="Editor"
          className={cn('min-h-0 flex-1 overflow-hidden', tab !== 'edit' && 'hidden')}
        >
          {editor}
        </div>
        <div
          data-testid="preview-region"
          aria-label="Preview"
          className={cn('min-h-0 flex-1 overflow-hidden', tab !== 'preview' && 'hidden')}
        >
          {preview}
        </div>
      </div>
    );
  }

  // Desktop (≥ md): unchanged split.js two-pane (editor | preview).
  return (
    <div className="flex h-full w-full">
      <div ref={leftRef} data-testid="editor-region" aria-label="Editor" className="h-full overflow-hidden">{editor}</div>
      <div ref={rightRef} data-testid="preview-region" aria-label="Preview" className="h-full overflow-hidden">{preview}</div>
    </div>
  );
}

// Segmented control pill per §03 mobile mock: two equal-width pills, active =
// accent-soft fill + strong ink text, inactive = faint. `ring-draft` keeps the
// design-system focus ring; `aria-pressed` exposes selection to AT.
function SegTab({
  label,
  testid,
  active,
  onClick,
}: {
  label: string;
  testid: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg px-3 py-1.5 text-center text-xs transition-colors duration-150 ease-draft ring-draft',
        active
          ? 'bg-accent-soft text-ondark-strong font-semibold'
          : 'text-ondark-faint hover:text-ondark-strong',
      )}
    >
      {label}
    </button>
  );
}
