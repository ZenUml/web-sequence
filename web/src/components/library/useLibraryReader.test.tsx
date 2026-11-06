import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibraryReader } from './useLibraryReader';
import { LIBRARY_CANCELLED } from './libraryIdentity';
import { useImportFeedbackStore } from './importFeedbackStore';
import { useExportFeedbackStore } from './exportFeedbackStore';
import { LS_KEYS } from '../../config/constants';
import type { Item } from '../../domain/types';

// Local fixtures only.
const item = (id: string) => ({ id, title: id, js: '', css: '', updatedOn: 1, pages: [] }) as unknown as Item;

type Props = { items: Item[]; loading: boolean; uid: string | null };

function setup(initial: Props) {
  return renderHook((p: Props) => useLibraryReader(p), { initialProps: initial });
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useLibraryReader — signed out', () => {
  it('reads existing ids from the local storage index, not from a still-loading list', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ 'local-1': true, 'local-2': true }));
    // IE-F3: an id counts only when its record exists (dangling keys: see below).
    window.localStorage.setItem('local-1', JSON.stringify(item('local-1')));
    window.localStorage.setItem('local-2', JSON.stringify(item('local-2')));
    const { result } = setup({ items: [], loading: true, uid: null });
    const ids = (await result.current.getExistingIds()) as Set<string>;
    expect([...ids].sort()).toEqual(['local-1', 'local-2']);
  });

  it('reads the full library for export from storage, including writes the list has not reloaded yet', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ a: true, b: true }));
    window.localStorage.setItem('a', JSON.stringify(item('a')));
    window.localStorage.setItem('b', JSON.stringify(item('b')));
    const { result } = setup({ items: [item('a')], loading: false, uid: null });
    const items = (await result.current.getLibraryItems()) as Item[];
    expect(items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });
});

describe('useLibraryReader — signed in', () => {
  it('waits for the first snapshot before answering', async () => {
    const { result, rerender } = setup({ items: [], loading: true, uid: 'u1' });
    let answered: unknown;
    const pending = result.current.getExistingIds().then((ids) => { answered = ids; });
    await act(async () => {});
    expect(answered).toBeUndefined();
    rerender({ items: [item('cloud-1')], loading: false, uid: 'u1' });
    await act(async () => { await pending; });
    expect([...(answered as Set<string>)]).toEqual(['cloud-1']);
  });

  it('after sign-in, ignores the stale signed-out list until the new snapshot replaces it', async () => {
    const local = [item('local-only')];
    const { result, rerender } = setup({ items: local, loading: false, uid: null });
    // Sign-in: same (stale) array, loading already false — useItems does not reset it.
    rerender({ items: local, loading: false, uid: 'u1' });
    let answered: unknown;
    const pending = result.current.getLibraryItems().then((v) => { answered = v; });
    await act(async () => {});
    expect(answered).toBeUndefined();
    rerender({ items: [item('cloud-1'), item('cloud-2')], loading: false, uid: 'u1' });
    await act(async () => { await pending; });
    expect((answered as Item[]).map((i) => i.id)).toEqual(['cloud-1', 'cloud-2']);
  });

  it('answers immediately once loaded', async () => {
    const { result } = setup({ items: [item('x')], loading: false, uid: 'u1' });
    expect(await result.current.getLibraryItems()).toHaveLength(1);
  });

  it('gives up with null (unknown) when the library never loads, instead of hanging', async () => {
    vi.useFakeTimers();
    const { result } = setup({ items: [], loading: true, uid: 'u1' });
    const pending = result.current.getExistingIds();
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(await pending).toBeNull();
  });
});

// Identity-bound reads (identity-cancellation review). A read started under one
// identity/generation must never answer with another identity's library.
describe('useLibraryReader — bound to the identity that started the read', () => {
  it('deferred A read → B becomes ready: A read is CANCELLED, never answered with B', async () => {
    const { result, rerender } = setup({ items: [], loading: true, uid: 'A' });
    const tokenA = result.current.identity.current();
    let answered: unknown = 'pending';
    const pending = result.current.getExistingIds(tokenA).then((v) => { answered = v; });
    rerender({ items: [], loading: true, uid: 'B' });
    rerender({ items: [item('b-only')], loading: false, uid: 'B' });
    await act(async () => { await pending; });
    expect(answered).toBe(LIBRARY_CANCELLED);
    expect(result.current.identity.isCurrent(tokenA)).toBe(false);
  });

  it('deferred A read → sign out: CANCELLED, never answered from the local index', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ 'local-1': true }));
    const { result, rerender } = setup({ items: [], loading: true, uid: 'A' });
    const tokenA = result.current.identity.current();
    const pending = result.current.getLibraryItems(tokenA);
    rerender({ items: [], loading: false, uid: null });
    await act(async () => {});
    expect(await pending).toBe(LIBRARY_CANCELLED);
  });

  it('A → B → A: a read from the first A generation stays cancelled when A returns', async () => {
    const { result, rerender } = setup({ items: [], loading: true, uid: 'A' });
    const firstA = result.current.identity.current();
    const pending = result.current.getExistingIds(firstA);
    rerender({ items: [], loading: true, uid: 'B' });
    rerender({ items: [], loading: true, uid: 'A' });
    rerender({ items: [item('a2')], loading: false, uid: 'A' });
    await act(async () => {});
    expect(await pending).toBe(LIBRARY_CANCELLED);
    const secondA = result.current.identity.current();
    expect(secondA.uid).toBe('A');
    expect(secondA.generation).not.toBe(firstA.generation);
    expect(result.current.identity.isCurrent(firstA)).toBe(false);
    expect(result.current.identity.isCurrent(secondA)).toBe(true);
  });

  it('a stale token is cancelled immediately, even when the library is ready', async () => {
    const { result, rerender } = setup({ items: [item('a')], loading: false, uid: 'A' });
    const tokenA = result.current.identity.current();
    rerender({ items: [item('b')], loading: false, uid: 'B' });
    rerender({ items: [item('b2')], loading: false, uid: 'B' });
    expect(await result.current.getLibraryItems(tokenA)).toBe(LIBRARY_CANCELLED);
  });

  it('signed-out storage read that finishes after sign-in is cancelled', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ x: true }));
    const { result, rerender } = setup({ items: [], loading: false, uid: null });
    const token = result.current.identity.current();
    const pending = result.current.getExistingIds(token);
    rerender({ items: [], loading: true, uid: 'B' });
    expect(await pending).toBe(LIBRARY_CANCELLED);
  });

  it('unmount mid-read: the read is cancelled and its token is no longer current', async () => {
    const { result, unmount } = setup({ items: [], loading: true, uid: 'A' });
    const token = result.current.identity.current();
    const identity = result.current.identity;
    const pending = result.current.getExistingIds(token);
    unmount();
    expect(await pending).toBe(LIBRARY_CANCELLED);
    expect(identity.isCurrent(token)).toBe(false);
  });

  it('account switch drops a failed import retry and clears a finished export result', () => {
    const { rerender } = setup({ items: [item('a')], loading: false, uid: 'A' });
    useImportFeedbackStore.setState({
      phase: 'saveFailed', text: '{}', fileName: 'a.json',
      prepared: { items: {}, total: 1, countsKnown: true, added: 1, updated: 0, token: { uid: 'A', generation: 1 } },
    });
    useExportFeedbackStore.setState({ phase: 'started' });
    rerender({ items: [item('a')], loading: false, uid: 'B' });
    expect(useImportFeedbackStore.getState()).toMatchObject({ phase: 'cancelled', prepared: null, text: null });
    expect(useExportFeedbackStore.getState().phase).toBe('idle');
    useImportFeedbackStore.getState().reset();
  });

  it('no identity change: stores are left alone on ordinary re-renders', () => {
    const { rerender } = setup({ items: [item('a')], loading: false, uid: 'A' });
    useImportFeedbackStore.setState({ phase: 'saveFailed', text: '{}' });
    rerender({ items: [item('a'), item('b')], loading: false, uid: 'A' });
    expect(useImportFeedbackStore.getState().phase).toBe('saveFailed');
    useImportFeedbackStore.getState().reset();
  });
});

// IE-F2 / IE-F3: read provenance. Only a successful read of the starting owner is an
// authoritative library; a failed read is unknown, never an empty library.
describe('useLibraryReader — read errors are unknown, not empty (IE-F2)', () => {
  type Src = { items: Item[]; loading: boolean; uid: string | null; owner?: string | null; error?: unknown; attempt?: number; retry?: () => number };
  const setupSrc = (p: Src) => renderHook((q: Src) => useLibraryReader(q), { initialProps: p });

  it('subscription error for the owner: ids and items are null (unknown), not []', async () => {
    const { result } = setupSrc({ items: [], loading: false, uid: 'u1', owner: 'u1', error: new Error('denied'), attempt: 1 });
    expect(await result.current.getExistingIds()).toBeNull();
    expect(await result.current.getLibraryItems()).toBeNull();
  });

  it('only a successful snapshot establishes known-empty', async () => {
    const { result } = setupSrc({ items: [], loading: false, uid: 'u1', owner: 'u1', error: null, attempt: 1 });
    expect(await result.current.getLibraryItems()).toEqual([]);
    expect([...((await result.current.getExistingIds()) as Set<string>)]).toEqual([]);
  });

  it('a read during an error retries once; a later successful snapshot answers truthfully', async () => {
    const retry = vi.fn(() => 2);
    const err = { items: [] as Item[], loading: false, uid: 'u1', owner: 'u1', error: new Error('unavailable'), attempt: 1, retry };
    const { result, rerender } = setupSrc(err);
    let answered: unknown = 'pending';
    const pending = result.current.getExistingIds().then((v) => { answered = v; });
    await act(async () => {});
    expect(retry).toHaveBeenCalledTimes(1);
    expect(answered).toBe('pending'); // the old error is not the answer to the retry
    rerender({ ...err, items: [item('e1')], error: null, attempt: 2 });
    await act(async () => { await pending; });
    expect([...(answered as Set<string>)]).toEqual(['e1']);
  });

  it('the retried subscription fails again: unknown (null), no further retry loop', async () => {
    const retry = vi.fn(() => 2);
    const err = { items: [] as Item[], loading: false, uid: 'u1', owner: 'u1', error: new Error('unavailable'), attempt: 1, retry };
    const { result, rerender } = setupSrc(err);
    const pending = result.current.getLibraryItems();
    await act(async () => {});
    rerender({ ...err, error: new Error('still unavailable'), attempt: 2 });
    await act(async () => {});
    expect(await pending).toBeNull();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('a snapshot or error owned by a previous uid is never this owner\'s answer', async () => {
    const { result, rerender } = setupSrc({ items: [item('a')], loading: false, uid: 'A', owner: 'A', error: null, attempt: 1 });
    rerender({ items: [item('a')], loading: false, uid: 'B', owner: 'A', error: null, attempt: 1 });
    let answered: unknown = 'pending';
    const pending = result.current.getLibraryItems().then((v) => { answered = v; });
    await act(async () => {});
    expect(answered).toBe('pending');
    rerender({ items: [], loading: false, uid: 'B', owner: 'B', error: null, attempt: 2 });
    await act(async () => { await pending; });
    expect(answered).toEqual([]);
  });
});

describe('useLibraryReader — signed-out ids come from extant records (IE-F3)', () => {
  it('a dangling index key (no record) is not an existing id', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ valid: true, dangling: true }));
    window.localStorage.setItem('valid', JSON.stringify(item('valid')));
    const { result } = setup({ items: [], loading: true, uid: null });
    expect([...((await result.current.getExistingIds()) as Set<string>)]).toEqual(['valid']);
    expect(((await result.current.getLibraryItems()) as Item[]).map((i) => i.id)).toEqual(['valid']);
  });

  it('an unreadable record makes ids unknown (null) and export unreadable (null)', async () => {
    window.localStorage.setItem(LS_KEYS.items, JSON.stringify({ valid: true, broken: true }));
    window.localStorage.setItem('valid', JSON.stringify(item('valid')));
    window.localStorage.setItem('broken', '{not json');
    const { result } = setup({ items: [], loading: true, uid: null });
    expect(await result.current.getExistingIds()).toBeNull();
    expect(await result.current.getLibraryItems()).toBeNull();
  });
});
