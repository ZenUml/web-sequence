import { useCallback, useEffect, useRef, useState } from 'react';
import type { Folder, Item } from '../../domain/types';
import type { SidebarDrag } from './HomeSidebar';

// Moving a diagram between folders on the Diagrams page (Figma F48 "Drag to folder"
// and "Moved · undo"). One controller serves drag-and-drop and the Move to folder
// menu, so both complete immediately with the same result, failure and Undo rules:
//   - A move writes through onMoveItem; nothing changes on screen until the library
//     reports the new folder, so a failure leaves the diagram where it was.
//   - One write per diagram at a time; repeated drops or menu picks are ignored.
//   - Only the latest move can be undone. Undo restores the exact previous folderId
//     (including null) and is refused if the diagram has moved again since.

export type MoveStatus =
  | { kind: 'pending'; title: string; toName: string }
  | { kind: 'moved'; seq: number; itemId: string; title: string; from: string | null; to: string | null; fromName: string; toName: string }
  | { kind: 'move-failed'; itemId: string; title: string; to: string | null; toName: string }
  | { kind: 'undoing'; title: string; fromName: string }
  | { kind: 'undo-failed'; seq: number; itemId: string; title: string; from: string | null; to: string | null; fromName: string; toName: string }
  | { kind: 'undone'; title: string; fromName: string }
  | { kind: 'stale'; title: string };

type MovedStatus = Extract<MoveStatus, { kind: 'moved' | 'undo-failed' }>;
type FailedStatus = Extract<MoveStatus, { kind: 'move-failed' | 'undo-failed' }>;

interface Options {
  items: Item[];
  folders: Folder[];
  onMoveItem?(item: Item, folderId: string | null): Promise<void> | void;
}

const UNFILED_NAME = 'Not in a folder';

export function useMoveController({ items, folders, onMoveItem }: Options) {
  const [status, setStatus] = useState<MoveStatus | null>(null);
  // A failure of an older operation that finished after a newer one started. It is
  // shown beside the newer status (with its own retry) instead of replacing it.
  const [earlier, setEarlier] = useState<FailedStatus | null>(null);
  // Each move/undo is an operation; the panel belongs to the latest one. An older
  // operation that settles later never replaces it: its success is dropped (the
  // library already shows where the diagram is) and its failure goes to `earlier`.
  // Dismissing the panel while the latest operation is pending hides its later
  // success; a failure is still shown because the user must know.
  const opRef = useRef(0);
  const dismissedOpRef = useRef(0);
  const statusRef = useRef<MoveStatus | null>(null);
  statusRef.current = status;
  const dismiss = useCallback(() => {
    dismissedOpRef.current = opRef.current;
    setStatus(null);
    setEarlier(null);
  }, []);
  const settle = (op: number, next: MoveStatus) => {
    const failed = next.kind === 'move-failed' || next.kind === 'undo-failed';
    if (op !== opRef.current) {
      if (!failed) return;
      if (statusRef.current) setEarlier(next as FailedStatus);
      else setStatus(next); // nothing on screen (dismissed): show the failure itself
      return;
    }
    if (!failed && dismissedOpRef.current === op) return;
    setStatus(next);
  };
  // A new operation for the same diagram replaces that diagram's earlier failure.
  const clearEarlierFor = (itemId: string) => setEarlier((e) => (e && e.itemId === itemId ? null : e));
  const [drag, setDrag] = useState<SidebarDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragItemRef = useRef<Item | null>(null);
  const pendingRef = useRef(new Set<string>());
  const seqRef = useRef(0);
  const lastSeqRef = useRef(new Map<string, number>());
  // Latest props for async continuations (Undo runs long after the move).
  const itemsRef = useRef(items);
  const foldersRef = useRef(folders);
  itemsRef.current = items;
  foldersRef.current = folders;

  // While dragging, entering any element outside a drop-target row clears the
  // highlight. Rows set it themselves on dragenter/dragover (they run after this
  // capture listener).
  useEffect(() => {
    if (!drag) return;
    const onEnter = (e: DragEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el?.closest('[data-drop-target]')) setDropTarget(null);
    };
    document.addEventListener('dragenter', onEnter, true);
    return () => document.removeEventListener('dragenter', onEnter, true);
  }, [drag]);

  const targetOf = useCallback(
    (item: Pick<Item, 'folderId'>) =>
      item.folderId && foldersRef.current.some((f) => f.id === item.folderId) ? item.folderId : 'unfiled',
    [],
  );
  const nameOf = (folderId: string | null | undefined) =>
    (folderId && foldersRef.current.find((f) => f.id === folderId)?.name) || UNFILED_NAME;
  const titleOf = (item: Item) => item.title || 'Untitled';
  const live = (id: string) => itemsRef.current.find((i) => i.id === id) ?? null;

  async function moveItem(item: Item, to: string | null) {
    if (!onMoveItem) return;
    const current = live(item.id) ?? item;
    if (targetOf(current) === (to ?? 'unfiled')) return;
    if (pendingRef.current.has(current.id)) return;
    pendingRef.current.add(current.id);
    const seq = ++seqRef.current;
    lastSeqRef.current.set(current.id, seq);
    const from = current.folderId ?? null;
    const title = titleOf(current);
    const op = ++opRef.current;
    clearEarlierFor(current.id);
    setStatus({ kind: 'pending', title, toName: nameOf(to) });
    try {
      await onMoveItem(current, to);
      settle(op, { kind: 'moved', seq, itemId: current.id, title, from, to, fromName: nameOf(from), toName: nameOf(to) });
    } catch {
      settle(op, { kind: 'move-failed', itemId: current.id, title, to, toName: nameOf(to) });
    } finally {
      pendingRef.current.delete(current.id);
    }
  }

  async function undo(moved: MovedStatus) {
    if (!onMoveItem) return;
    const current = live(moved.itemId);
    // Refuse a stale Undo: the diagram moved again (here or elsewhere) or is gone.
    const where = current ? targetOf(current) : null;
    const expected = [moved.to ?? 'unfiled', targetOf({ folderId: moved.from })];
    if (!current || lastSeqRef.current.get(moved.itemId) !== moved.seq || !expected.includes(where as string)) {
      setStatus({ kind: 'stale', title: moved.title });
      return;
    }
    if (pendingRef.current.has(current.id)) return;
    pendingRef.current.add(current.id);
    const op = ++opRef.current;
    clearEarlierFor(current.id);
    setStatus({ kind: 'undoing', title: moved.title, fromName: moved.fromName });
    try {
      await onMoveItem(current, moved.from);
      lastSeqRef.current.set(current.id, ++seqRef.current);
      settle(op, { kind: 'undone', title: moved.title, fromName: moved.fromName });
    } catch {
      settle(op, { ...moved, kind: 'undo-failed' });
    } finally {
      pendingRef.current.delete(current.id);
    }
  }

  function retry(failed: Extract<MoveStatus, { kind: 'move-failed' }>) {
    const current = live(failed.itemId);
    if (current) void moveItem(current, failed.to);
  }

  return {
    status,
    earlier,
    drag,
    dropTarget,
    setDropTarget,
    targetOf,
    moveItem,
    undo: (s: MovedStatus) => void undo(s),
    retry,
    dismiss,
    startDrag(item: Item) {
      dragItemRef.current = item;
      setDrag({ title: titleOf(item), currentTarget: targetOf(item) });
      setDropTarget(null);
    },
    endDrag() {
      dragItemRef.current = null;
      setDrag(null);
      setDropTarget(null);
    },
    dropOn(target: string) {
      const item = dragItemRef.current;
      dragItemRef.current = null;
      setDrag(null);
      setDropTarget(null);
      if (item) void moveItem(item, target === 'unfiled' ? null : target);
    },
  };
}

interface PanelProps {
  status: MoveStatus;
  earlier?: FailedStatus | null;
  onUndo(s: MovedStatus): void;
  onRetry(s: Extract<MoveStatus, { kind: 'move-failed' }>): void;
  onDismiss(): void;
}

// Result of the latest move, with Undo (design "Moved · undo"). Lives in the
// sidebar on wide screens; on narrow screens it docks to the bottom (home.css).
export function MoveStatusPanel({ status, earlier = null, onUndo, onRetry, onDismiss }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  // An earlier failure keeps the panel open until the user acts on it.
  const terminal = (status.kind === 'undone' || status.kind === 'stale') && !earlier;
  // Short-lived confirmations close themselves unless the user is in the panel.
  useEffect(() => {
    if (!terminal) return;
    const t = setTimeout(() => {
      if (!ref.current?.matches(':hover, :focus-within')) onDismiss();
    }, 5000);
    return () => clearTimeout(t);
  }, [status, terminal, onDismiss]);

  const close = (
    <button type="button" className="dh-status-close" aria-label="Dismiss" data-testid="move-status-dismiss" onClick={onDismiss}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );

  let body: React.ReactNode;
  switch (status.kind) {
    case 'pending':
      body = (
        <>
          <p className="dh-status-title">Moving…</p>
          <p className="dh-status-line">
            {status.title} → {status.toName}
          </p>
        </>
      );
      break;
    case 'moved':
    case 'undo-failed':
      body = (
        <>
          <p className="dh-status-title">{status.kind === 'moved' ? 'Diagram moved' : 'Couldn’t undo the move'}</p>
          <p className="dh-status-line" data-testid="move-status-route">
            {status.title} → {status.toName}
          </p>
          {status.kind === 'moved' ? (
            <>
              <p className="dh-status-meta">1 diagram moved</p>
              <p className="dh-status-meta">Diagram content is unchanged.</p>
            </>
          ) : (
            <p className="dh-status-error">Check your connection and try again.</p>
          )}
          <div className="dh-status-actions">
            <button type="button" className="dh-button dh-button--secondary dh-button--small" data-testid="move-undo" onClick={() => onUndo(status)}>
              {status.kind === 'moved' ? 'Undo' : 'Try again'}
            </button>
          </div>
        </>
      );
      break;
    case 'move-failed':
      body = (
        <>
          <p className="dh-status-title">Couldn’t move this diagram</p>
          <p className="dh-status-line">
            {status.title} stays where it was.
          </p>
          <p className="dh-status-error">Check your connection and try again.</p>
          <div className="dh-status-actions">
            <button type="button" className="dh-button dh-button--primary dh-button--small" data-testid="move-retry" onClick={() => onRetry(status)}>
              Try again
            </button>
          </div>
        </>
      );
      break;
    case 'undoing':
      body = (
        <>
          <p className="dh-status-title">Undoing…</p>
          <p className="dh-status-line">
            {status.title} → {status.fromName}
          </p>
        </>
      );
      break;
    case 'undone':
      body = (
        <>
          <p className="dh-status-title">Move undone</p>
          <p className="dh-status-line">
            {status.title} is back in {status.fromName}.
          </p>
        </>
      );
      break;
    case 'stale':
      body = (
        <>
          <p className="dh-status-title">Can’t undo</p>
          <p className="dh-status-line">{status.title} was moved again, so Undo was skipped.</p>
        </>
      );
      break;
  }

  const failed = status.kind === 'move-failed' || status.kind === 'undo-failed';
  return (
    <div
      ref={ref}
      className={failed ? 'dh-status is-error' : 'dh-status'}
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      data-testid="move-status"
      data-kind={status.kind}
    >
      {close}
      {body}
      {earlier && (
        <div className="dh-status-earlier" role="alert" data-testid="move-earlier-failure">
          <p className="dh-status-error">
            {earlier.kind === 'move-failed'
              ? `Couldn’t move ${earlier.title}. It stays where it was.`
              : `Couldn’t undo the move of ${earlier.title}.`}
          </p>
          <button
            type="button"
            className="dh-button dh-button--secondary dh-button--small"
            data-testid="move-earlier-retry"
            onClick={() => (earlier.kind === 'move-failed' ? onRetry(earlier) : onUndo(earlier))}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
