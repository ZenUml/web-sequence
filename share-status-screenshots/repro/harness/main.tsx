// Validation harness: the REAL ShareButton / SharePopover / useShare inside the real
// Editor header classes and global tokens. Only the backend calls are fixtures that
// the Playwright script resolves/rejects (window.__share). No network, no Firebase.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/web/src/styles/globals.css';
import { ShareButton } from '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/web/src/components/share/ShareButton';
import { useShare } from '/Users/pengxiao/.codex/worktrees/share-visitor-claude/web-sequence/web/src/hooks/useShare';

type Pending = { resolve: (v?: unknown) => void; reject: (e: unknown) => void };
const ctl = { create: [] as Pending[], stop: [] as Pending[] };
(window as unknown as { __share: typeof ctl }).__share = ctl;
const createShare = () => new Promise<{ url: string; md5: string }>((resolve, reject) =>
  ctl.create.push({ resolve: resolve as Pending['resolve'], reject }));
const stopSharing = () => new Promise<void>((resolve, reject) =>
  ctl.stop.push({ resolve: resolve as Pending['resolve'], reject }));

const appearance = new URLSearchParams(location.search).get('appearance') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.appearance = appearance;

function Harness() {
  const share = useShare({ itemId: 'demo', getItemId: () => 'demo', createShare, stopSharing });
  return (
    <div data-testid="editor-shell" className="editor-hifi-shell flex flex-col h-full w-full">
      <header className="editor-hifi-header">
        <div className="editor-header-nav"><strong style={{ fontSize: 13 }}>ZenUML</strong></div>
        <div className="editor-document-chrome">
          <span className="editor-breadcrumb-link" style={{ lineHeight: '32px' }}>Diagrams</span>
          <span className="editor-breadcrumb-separator">/</span>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Untitled</span>
        </div>
        <div className="editor-header-spacer" />
        <div className="editor-document-actions editor-header-actions">
          <div className="editor-document-share">
            <ShareButton
              url={share.url} sharing={share.sharing} error={share.error} copied={share.copied}
              stopping={share.stopping} failure={share.failure} copyFailed={share.copyFailed}
              onShare={() => void share.share()} onStop={() => void share.stop()} onCopy={() => void share.copy()}
            />
          </div>
        </div>
      </header>
      <div style={{ flex: 1, background: 'var(--editor-bg)' }} />
    </div>
  );
}
createRoot(document.getElementById('app')!).render(<StrictMode><Harness /></StrictMode>);
