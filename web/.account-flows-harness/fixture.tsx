// Local visual/interaction fixture for the account-flow modals. Not shipped.
// URL: /.account-flows-harness/fixture.html?modal=login|saved|import|import-live
//        &state=default|lastused|pending|error   (login)
//        &state=default|one|pending|error          (import)
//        &appearance=light|dark
// No Firebase: LoginModal/AskToImportModal/SavedOnDeviceModal are presentational;
// import-live drives the REAL useImportOnLogin with a fake saveItems (no network).
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../src/styles/globals.css';
import { LoginModal } from '../src/components/auth/LoginModal';
import { describeLoginFailure } from '../src/components/auth/signInProviders';
import { AskToImportModal } from '../src/components/modals/AskToImportModal';
import { SavedOnDeviceModal } from '../src/components/modals/SavedOnDeviceModal';
import { useImportOnLogin } from '../src/hooks/useImportOnLogin';
import { useAuthStore } from '../src/state/authStore';
import { IMPORT_ERRORS } from '../src/hooks/useImportOnLogin';
import type { ProviderName } from '../src/services/types';
import type { Item } from '../src/domain/types';

const q = new URLSearchParams(location.search);
const modal = q.get('modal') ?? 'login';
const state = q.get('state') ?? 'default';
const appearance = q.get('appearance') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.appearance = appearance;
document.body.style.margin = '0';
document.body.style.minHeight = '100vh';
document.body.style.background = 'var(--editor-bg)';

const log: string[] = [];
(window as any).__afLog = log;

function LoginLive() {
  // Interactive: clicking a provider shows pending for 600ms, then fails
  // (popup closed) — exercises the real modal pending/error/retry path.
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState<ProviderName | null>(state === 'pending' ? 'google' : null);
  const [error, setError] = useState<string | null>(
    state === 'error' ? describeLoginFailure('google', undefined) : null,
  );
  return (
    <>
      <button style={{ margin: 16 }} onClick={() => setOpen(true)}>Open sign in</button>
      <LoginModal
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setPending(null); setError(null); } }}
        lastProvider={state === 'lastused' ? 'google' : null}
        pendingProvider={pending}
        error={error}
        onLogin={(p) => {
          log.push(`login:${p}`);
          setError(null);
          setPending(p);
          setTimeout(() => { setPending(null); setError(describeLoginFailure(p, 'auth/popup-closed-by-user')); }, 600);
        }}
      />
    </>
  );
}

function Saved() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <textarea aria-label="editor" defaultValue={'A->B: hello'} style={{ margin: 16, width: 300, height: 80 }} />
      <SavedOnDeviceModal
        open={open}
        onOpenChange={(o) => { log.push(`saved-open:${o}`); setOpen(o); }}
        onSignIn={() => log.push('saved-signin')}
      />
    </>
  );
}

function ImportStatic() {
  const count = state === 'one' ? 1 : 3;
  return (
    <AskToImportModal
      open
      onOpenChange={() => {}}
      count={count}
      busy={state === 'pending'}
      error={state === 'error' ? IMPORT_ERRORS.save : null}
      onImport={() => log.push('import')}
      onDismiss={() => log.push('dismiss')}
    />
  );
}

// Real hook: seeds 3 local records (+1 index ghost without a record), signs in a
// fake user, saveItems fails once after 800ms then succeeds after 800ms.
function seedLocal() {
  const items: Record<string, true> = {};
  for (const id of ['fx-a', 'fx-b', 'fx-c']) {
    const item = { id, title: id, js: 'A->B: hi', css: '', html: '', htmlMode: 'html', cssMode: 'css', jsMode: 'js', pages: [], currentPageId: '', updatedOn: Date.now() };
    localStorage.setItem(id, JSON.stringify(item));
    items[id] = true;
  }
  items['fx-ghost'] = true;
  localStorage.setItem('items', JSON.stringify(items));
  localStorage.removeItem('askedToImportCreations');
}
let saveCalls = 0;
async function fakeSaveItems(map: Record<string, Item>) {
  saveCalls += 1;
  log.push(`save#${saveCalls}:${Object.keys(map).sort().join(',')}`);
  await new Promise((r) => setTimeout(r, 800));
  if (saveCalls === 1) throw new Error('simulated network failure');
}
function ImportLive() {
  const { pending, count, doImport, dismiss, busy, error } = useImportOnLogin(fakeSaveItems);
  return (
    <>
      <p data-testid="live-state" style={{ margin: 16, font: '13px sans-serif', color: 'var(--editor-text)' }}>
        pending={String(pending)} busy={String(busy)} asked={String(localStorage.getItem('askedToImportCreations'))}
      </p>
      <AskToImportModal
        open={pending}
        onOpenChange={(o) => { if (!o) void dismiss(); }}
        count={count}
        busy={busy}
        error={error}
        onImport={() => void doImport()}
        onDismiss={() => void dismiss()}
      />
    </>
  );
}

function App() {
  if (modal === 'saved') return <Saved />;
  if (modal === 'import') return <ImportStatic />;
  if (modal === 'import-live') return <ImportLive />;
  return <LoginLive />;
}

if (modal === 'import-live') {
  seedLocal();
  useAuthStore.setState({ user: { uid: 'fixture-user', email: 'fixture@local', displayName: 'Fixture', photoURL: null } });
}
createRoot(document.getElementById('root')!).render(<App />);
