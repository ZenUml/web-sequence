import Split from 'split.js';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { cn } from '../ui/cn';

type MobileTab = 'edit' | 'preview';

export function Layout({
  editor,
  preview,
  editorCollapsed = false,
  presenting = false,
}: {
  editor: React.ReactNode;
  preview: React.ReactNode;
  /** Desktop only: hide the code pane and give the preview the full width. */
  editorCollapsed?: boolean;
  presenting?: boolean;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const item = useEditorStore((s) => s.currentItem);
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<MobileTab>('edit');

  useEffect(() => {
    // Mobile renders a single pane (no split.js) — never instantiate Split there.
    // `isMobile` is in the dep array so split re-inits when crossing the breakpoint.
    if (isMobile || editorCollapsed) return;
    if (!leftRef.current || !rightRef.current) return;
    // The editor design gives the renderer the larger working area: at a 1440px
    // desktop viewport the code area spans x16..368 and the preview card begins
    // at x392 (12px gutter). A persisted drag still wins.
    const sizes = useEditorStore.getState().currentItem?.mainSizes ?? item?.mainSizes ?? [26.8056, 73.1944];
    let inst: ReturnType<typeof Split> | undefined;
    try {
      inst = Split([leftRef.current, rightRef.current], {
        // A 12px gutter: wide enough to grab, invisible until hover/focus.
        sizes, minSize: 240, gutterSize: 12, direction: 'horizontal',
        gutter: (_index, direction) => {
          const gutter = document.createElement('div');
          gutter.className = `editor-split-gutter gutter gutter-${direction}`;
          gutter.setAttribute('role', 'separator');
          gutter.setAttribute('aria-label', 'Resize editor and preview');
          gutter.tabIndex = 0;
          gutter.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const width = leftRef.current?.parentElement?.clientWidth ?? 0;
            if (!inst || width <= 0) return;
            event.preventDefault();
            const minimum = Math.min(50, 240 / width * 100);
            const delta = (event.key === 'ArrowRight' ? 1 : -1) * 20 / width * 100;
            const left = Math.max(minimum, Math.min(100 - minimum, inst.getSizes()[0] + delta));
            const next = [left, 100 - left];
            inst.setSizes(next);
            useEditorStore.getState().setMainSizes(next);
          });
          gutter.setAttribute('aria-orientation', direction === 'horizontal' ? 'vertical' : 'horizontal');
          return gutter;
        },
        // FIX 5: use getState() to avoid stale closure over `item`; update store immutably.
        onDragEnd: (s) => useEditorStore.getState().setMainSizes(s.map(Number)),
      });
    } catch (e) {
      // split.js may throw in jsdom (zero-size layout APIs); skip splitting in test env
      console.warn('[Layout] Split() skipped:', e);
    }
    return () => inst?.destroy();
    // Intentionally read `mainSizes` once at init (desktop must stay identical — adding
    // `item` would re-init split on every page switch). Re-init on breakpoint change and
    // when the code pane is shown again (restoring the persisted split sizes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, editorCollapsed]);

  // Mobile (< md): single pane with a segmented Edit | Preview control (design §03).
  if (isMobile) {
    return (
      <div className="editor-layout-mobile flex h-full w-full flex-col">
        <div
          role="group"
          aria-label="Editor or preview"
          className="editor-mobile-tabs flex shrink-0 gap-1 px-3 py-2 bg-ink-900 border-b border-ink-line"
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
          className={cn('min-h-0 flex-1 overflow-hidden', tab !== 'preview' && !presenting && 'hidden')}
        >
          {preview}
        </div>
      </div>
    );
  }

  // Desktop (≥ md): unchanged split.js two-pane (editor | preview).
  return (
    <div className={cn('editor-layout flex h-full w-full', editorCollapsed && 'editor-layout--collapsed')}>
      {/* Collapsed: the code pane stays mounted (editor state survives) but hidden. */}
      <div ref={leftRef} data-testid="editor-region" aria-label="Editor" hidden={editorCollapsed} className={cn('editor-region h-full min-w-0 overflow-hidden', editorCollapsed && 'hidden')}>{editor}</div>
      <div ref={rightRef} data-testid="preview-region" aria-label="Preview" className={cn('preview-region h-full min-w-0 overflow-hidden', editorCollapsed && 'w-full')}>{preview}</div>
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
